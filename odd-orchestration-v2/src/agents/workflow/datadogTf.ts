import { DashboardPlan, DashboardWidgetPlan } from '../../shared/types.js';

type WidgetDefinition = Record<string, unknown>;
type WidgetLayout = { x: number; y: number; width: number; height: number };
type DashboardWidget = {
  definition: WidgetDefinition;
  layout: WidgetLayout;
};

const GRID = {
  width: 72,
  heroY: 0,
  heroPadding: 6,
  heroHeight: 12,
  sectionGap: 2,
  cardHeight: 10,
  trendHeight: 10
};

const EMPTY_QUERY = 'tags:(event_key:__odd_empty__ source:odd)';

function createEventQuery(name: string, searchQuery: string) {
  return {
    data_source: 'events',
    name,
    indexes: [],
    compute: { aggregation: 'count' },
    search: { query: searchQuery },
    group_by: []
  };
}

function paletteForQueryValue(widget: DashboardWidgetPlan): string {
  if (widget.palette === 'alert') return 'white_on_red';
  if (widget.palette === 'warning') return 'white_on_yellow';
  if (widget.palette === 'success') return 'white_on_green';
  return 'white_on_grey';
}

function linePalette(widget: DashboardWidgetPlan): string {
  if (widget.palette === 'alert') return 'warm';
  if (widget.palette === 'warning') return 'orange';
  if (widget.palette === 'success') return 'cool';
  return 'dog_classic';
}

function conditionalFormats(widget: DashboardWidgetPlan): Record<string, unknown>[] {
  if (widget.thresholdDirection === 'at_least_good' && typeof widget.thresholdValue === 'number') {
    return [
      { comparator: '<', value: widget.thresholdValue, palette: 'black_on_light_red' },
      { comparator: '>=', value: widget.thresholdValue, palette: 'black_on_light_green' }
    ];
  }

  if (widget.thresholdDirection === 'above_bad' && typeof widget.thresholdValue === 'number') {
    return [
      { comparator: '>', value: widget.thresholdValue, palette: 'black_on_light_red' },
      { comparator: '<=', value: widget.thresholdValue, palette: 'black_on_light_green' }
    ];
  }

  if (widget.thresholdDirection === 'below_bad' && typeof widget.thresholdValue === 'number') {
    return [
      { comparator: '<', value: widget.thresholdValue, palette: 'black_on_light_red' },
      { comparator: '>=', value: widget.thresholdValue, palette: 'black_on_light_green' }
    ];
  }

  if (widget.palette === 'alert') {
    return [
      { comparator: '>', value: 0, palette: 'black_on_light_red' },
      { comparator: '<=', value: 0, palette: 'black_on_light_green' }
    ];
  }

  if (widget.palette === 'warning') {
    return [
      { comparator: '>', value: 0, palette: 'black_on_light_yellow' },
      { comparator: '<=', value: 0, palette: 'white_on_green' }
    ];
  }

  if (widget.palette === 'success') {
    return [
      { comparator: '>=', value: 1, palette: 'black_on_light_green' },
      { comparator: '<', value: 1, palette: 'white_on_grey' }
    ];
  }

  return [
    { comparator: '>=', value: 0, palette: 'white_on_grey' }
  ];
}

function createQueryValueDefinition(widget: DashboardWidgetPlan, title: string): WidgetDefinition {
  return {
    type: 'query_value',
    title,
    autoscale: true,
    precision: 0,
    title_align: 'left',
    title_size: '16',
    requests: [
      {
        response_format: 'scalar',
        queries: [createEventQuery('query1', widget.query)],
        formulas: [{ formula: 'query1' }],
        conditional_formats: conditionalFormats(widget)
      }
    ]
  };
}

function createTimeseriesDefinition(widget: DashboardWidgetPlan, title: string): WidgetDefinition {
  return {
    type: 'timeseries',
    title,
    show_legend: false,
    legend_layout: 'horizontal',
    legend_columns: ['value', 'avg', 'sum'],
    requests: [
      {
        response_format: 'timeseries',
        display_type: 'line',
        style: {
          palette: linePalette(widget),
          line_type: 'solid',
          line_width: 'normal'
        },
        queries: [createEventQuery('query1', widget.query)],
        formulas: [{ formula: 'query1' }]
      }
    ]
  };
}

function createDataWidget(widget: DashboardWidgetPlan, title: string, layout: WidgetLayout): DashboardWidget {
  return {
    definition: widget.widgetType === 'timeseries' ? createTimeseriesDefinition(widget, title) : createQueryValueDefinition(widget, title),
    layout
  };
}

function createEmptyWidget(id: string, title: string, widgetType: 'query_value' | 'timeseries', palette: DashboardWidgetPlan['palette']): DashboardWidgetPlan {
  return {
    id,
    title,
    widgetType,
    query: EMPTY_QUERY,
    stage: 'empty',
    sectionType: palette === 'success' ? 'normal' : 'problems',
    sourceEventKeys: ['__odd_empty__'],
    visualRole: widgetType === 'timeseries' ? 'trend' : 'kpi',
    palette
  };
}

function buildHeroWidget(plan: DashboardPlan): DashboardWidget {
  const hero = plan.bands[0].widgets[0] ?? createEmptyWidget('hero_empty', 'Sem dados no período', 'query_value', 'neutral');
  const titlePrefix = hero.sectionType === 'problems' ? 'Alerta Critico' : 'Saude do Fluxo';
  const width = GRID.width - GRID.heroPadding * 2;
  return createDataWidget(hero, `${titlePrefix} | ${hero.title}`, {
    x: GRID.heroPadding,
    y: GRID.heroY,
    width,
    height: GRID.heroHeight
  });
}

function computeBalancedColumns(count: number): number {
  if (count <= 1) return 1;
  if (count === 2) return 2;
  if (count <= 3) return 3;
  return Math.ceil(count / 2);
}

function buildKpiWidgets(widgets: DashboardWidgetPlan[], sectionLabel: string, startY: number, emptyTitle: string, emptyPalette: DashboardWidgetPlan['palette']): { widgets: DashboardWidget[]; nextY: number } {
  const data = widgets.length > 0 ? widgets : [createEmptyWidget(`${sectionLabel}_kpi_empty`, emptyTitle, 'query_value', emptyPalette)];
  const columns = computeBalancedColumns(data.length);
  const width = Math.floor(GRID.width / columns);
  const laidOut = data.map((widget, index) =>
    createDataWidget(widget, `${sectionLabel} | ${widget.title}`, {
      x: (index % columns) * width,
      y: startY + Math.floor(index / columns) * GRID.cardHeight,
      width: index % columns === columns - 1 ? GRID.width - ((columns - 1) * width) : width,
      height: GRID.cardHeight
    })
  );
  return { widgets: laidOut, nextY: startY + Math.ceil(data.length / columns) * GRID.cardHeight };
}

function buildTrendWidgets(widgets: DashboardWidgetPlan[], sectionLabel: string, startY: number, emptyTitle: string, emptyPalette: DashboardWidgetPlan['palette']): { widgets: DashboardWidget[]; nextY: number } {
  const data = widgets.length > 0 ? widgets.slice(0, 3) : [createEmptyWidget(`${sectionLabel}_trend_empty`, emptyTitle, 'timeseries', emptyPalette)];
  const columns = data.length;
  const width = Math.floor(GRID.width / columns);
  const laidOut = data.map((widget, index) =>
    createDataWidget(widget, `${sectionLabel} | ${widget.title}`, {
      x: index * width,
      y: startY,
      width: index === columns - 1 ? GRID.width - ((columns - 1) * width) : width,
      height: GRID.trendHeight
    })
  );
  return { widgets: laidOut, nextY: startY + GRID.trendHeight };
}

function buildDashboardWidgets(plan: DashboardPlan): DashboardWidget[] {
  const widgets: DashboardWidget[] = [buildHeroWidget(plan)];
  const failureKpis = plan.bands[1];
  const failureTrends = plan.bands[2];
  const successKpis = plan.bands[3];
  const successTrends = plan.bands[4];

  let y = GRID.heroY + GRID.heroHeight + GRID.sectionGap;

  const failureKpiLayout = buildKpiWidgets(
    failureKpis.widgets,
    'Falhas na Formacao | KPI',
    y,
    'Falhas por evento',
    'neutral'
  );
  widgets.push(...failureKpiLayout.widgets);
  y = failureKpiLayout.nextY + GRID.sectionGap;

  const failureTrendLayout = buildTrendWidgets(
    failureTrends.widgets,
    'Falhas na Formacao | Tendencia',
    y,
    'Sem tendencia no periodo',
    'alert'
  );
  widgets.push(...failureTrendLayout.widgets);
  y = failureTrendLayout.nextY + GRID.sectionGap;

  const successKpiLayout = buildKpiWidgets(
    successKpis.widgets,
    'Formacao de Grupos | KPI',
    y,
    'Sucessos por evento',
    'success'
  );
  widgets.push(...successKpiLayout.widgets);
  y = successKpiLayout.nextY + GRID.sectionGap;

  const successTrendLayout = buildTrendWidgets(
    successTrends.widgets,
    'Formacao de Grupos | Tendencia',
    y,
    'Sem tendencia no periodo',
    'success'
  );
  widgets.push(...successTrendLayout.widgets);

  return widgets;
}

function buildDashboardObject(plan: DashboardPlan): Record<string, unknown> {
  return {
    title: plan.dashboardTitle,
    description: 'Generated from Event Storming workflow by observability orchestrator',
    layout_type: 'free',
    template_variables: [],
    widgets: buildDashboardWidgets(plan)
  };
}

function validate(terraformJson: Record<string, unknown>, dashboardName: string): void {
  const resource = terraformJson.resource;
  if (!resource || typeof resource !== 'object') throw new Error('Missing resource');

  const ddJson = (resource as Record<string, unknown>).datadog_dashboard_json;
  if (!ddJson || typeof ddJson !== 'object') throw new Error('Missing datadog_dashboard_json');

  const dashboardResource = (ddJson as Record<string, unknown>)[dashboardName];
  if (!dashboardResource || typeof dashboardResource !== 'object') throw new Error(`Missing ${dashboardName}`);

  const dashboardStr = (dashboardResource as Record<string, unknown>).dashboard;
  if (typeof dashboardStr !== 'string') throw new Error('dashboard field is not a string');

  const dashboard = JSON.parse(dashboardStr) as Record<string, unknown>;
  if (dashboard.layout_type !== 'free') throw new Error('Invalid layout_type');
  if (!Array.isArray(dashboard.widgets)) throw new Error('Missing widgets array');

  for (const widget of dashboard.widgets as Record<string, unknown>[]) {
    if (!widget.definition || typeof widget.definition !== 'object') throw new Error('Missing widget definition');
    if (!widget.layout || typeof widget.layout !== 'object') throw new Error('Missing widget layout');
    const type = (widget.definition as Record<string, unknown>).type;
    if (type !== 'query_value' && type !== 'timeseries') {
      throw new Error(`Invalid widget type: ${String(type)}`);
    }
  }
}

function resourceName(key: string): string {
  return key
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'odd_dashboard';
}

export async function buildDatadogDashboardTerraform(plan: DashboardPlan, dashboardKey: string): Promise<Record<string, unknown>> {
  const dashboardObject = buildDashboardObject(plan);
  const name = resourceName(dashboardKey);
  const terraformJson = {
    resource: {
      datadog_dashboard_json: {
        [name]: {
          dashboard: JSON.stringify(dashboardObject)
        }
      }
    }
  };

  validate(terraformJson, name);
  return terraformJson;
}
