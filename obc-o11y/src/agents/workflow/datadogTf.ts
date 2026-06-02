import { DashboardPlan, DashboardWidgetPlan } from '../../shared/types.js';
import { buildEventQueryHint } from '../../shared/query-hint.js';

type WidgetLayout = { x: number; y: number; width: number; height: number };
type TerraformWidget = Record<string, unknown>;
type TerraformGroupWidget = Record<string, unknown>;

const GROUP_GRID = {
  width: 12,
  sectionGap: 1,
  cardHeight: 2,
  trendHeight: 2
};
const EVENT_METRIC = 'odd.workflow.event.count';

const EMPTY_QUERY = buildEventQueryHint('__odd_empty__');

function createEventSearchQuery(searchQuery: string): string {
  const match = searchQuery.match(/^tags:\((.*)\)$/);
  return match ? match[1] : searchQuery;
}

function createMetricTagFilter(searchQuery: string): string {
  return createEventSearchQuery(searchQuery)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(',');
}

function createEventMetricQuery(searchQuery: string, widgetType: DashboardWidgetPlan['widgetType']): string {
  const filter = createMetricTagFilter(searchQuery);
  if (widgetType === 'timeseries') {
    return `sum:${EVENT_METRIC}{${filter}}.as_count()`;
  }

  return `sum:${EVENT_METRIC}{${filter}}.rollup(sum, 300)`;
}

function paletteForQueryValue(widget: DashboardWidgetPlan): string {
  if (widget.palette === 'alert') return 'white_on_red';
  if (widget.palette === 'warning') return 'white_on_yellow';
  if (widget.palette === 'success') return 'white_on_green';
  return 'white_on_gray';
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
      { comparator: '<', value: 1, palette: 'white_on_gray' }
    ];
  }

  return [{ comparator: '>=', value: 0, palette: 'white_on_gray' }];
}

function createQueryValueDefinition(widget: DashboardWidgetPlan, title: string): Record<string, unknown> {
  return {
    title,
    title_size: '16',
    title_align: 'left',
    precision: 0,
    autoscale: true,
    request: [
      {
        q: createEventMetricQuery(widget.query, 'query_value'),
        aggregator: 'sum',
        conditional_formats: conditionalFormats(widget)
      }
    ]
  };
}

function createTimeseriesDefinition(widget: DashboardWidgetPlan, title: string): Record<string, unknown> {
  return {
    title,
    show_legend: false,
    legend_layout: 'horizontal',
    legend_columns: ['value', 'avg', 'sum'],
    request: [
      {
        q: createEventMetricQuery(widget.query, 'timeseries'),
        display_type: 'line',
        style: [
          {
            palette: linePalette(widget),
            line_type: 'solid',
            line_width: 'normal'
          }
        ]
      }
    ]
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

function widgetHeight(widget: DashboardWidgetPlan): number {
  return widget.widgetType === 'timeseries' ? GROUP_GRID.trendHeight : GROUP_GRID.cardHeight;
}

function flowKeyFromBandId(bandId: string): string {
  return bandId.replace(/_(negative|positive)_(kpis|trends)$/, '');
}

function flowTitleFromBandTitle(title: string): string {
  return title.split(' | ')[0] ?? title;
}

function eventTitle(widget: DashboardWidgetPlan, groupTitle: string): string {
  const title = widget.title;
  const suffix = ` | ${groupTitle}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
}

function createTerraformWidget(
  widget: DashboardWidgetPlan,
  title: string,
  layout: WidgetLayout
): TerraformGroupWidget {
  const definitionKey = widget.widgetType === 'timeseries' ? 'timeseries_definition' : 'query_value_definition';
  const definition = widget.widgetType === 'timeseries'
    ? createTimeseriesDefinition(widget, title)
    : createQueryValueDefinition(widget, title);

  return {
    [definitionKey]: [definition],
    widget_layout: [layout]
  };
}

function buildBandWidgets(
  band: DashboardPlan['bands'][number],
  startY: number,
  groupTitle: string
): { widgets: TerraformGroupWidget[]; nextY: number } {
  const rendered: TerraformGroupWidget[] = [];
  const bandWidgets = band.widgets.length > 0
    ? band.widgets
    : [createEmptyWidget(`${band.id}_empty`, `${band.title} sem dados`, 'query_value', 'neutral')];
  const widgets = bandWidgets.filter((widget) => widget.visualRole !== 'hero_alert');
  let y = startY;

  if (widgets.length === 0) {
    return { widgets: rendered, nextY: y };
  }

  const columns = Math.max(1, widgets.length);
  const width = Math.floor(GROUP_GRID.width / columns);

  for (let index = 0; index < widgets.length; index += columns) {
    const rowWidgets = widgets.slice(index, index + columns);
    const rowHeight = Math.max(...rowWidgets.map(widgetHeight));

    rowWidgets.forEach((widget, column) => {
      rendered.push(createTerraformWidget(
        widget,
        eventTitle(widget, groupTitle),
        {
          x: column * width,
          y,
          width: column === columns - 1 ? GROUP_GRID.width - ((columns - 1) * width) : width,
          height: rowHeight
        }
      ));
    });

    y += rowHeight + GROUP_GRID.sectionGap;
  }

  return { widgets: rendered, nextY: y };
}

function buildGroupWidgets(plan: DashboardPlan): TerraformWidget[] {
  const groups = new Map<string, { title: string; bands: DashboardPlan['bands'] }>();

  for (const band of plan.bands) {
    const key = flowKeyFromBandId(band.id);
    const existing = groups.get(key);
    if (existing) {
      existing.bands.push(band);
      continue;
    }

    groups.set(key, {
      title: flowTitleFromBandTitle(band.title),
      bands: [band]
    });
  }

  return Array.from(groups.values()).map(({ title, bands }) => {
    const nestedWidgets: TerraformGroupWidget[] = [];
    let y = 0;

    for (const band of bands) {
      const bandLayout = buildBandWidgets(band, y, title);
      nestedWidgets.push(...bandLayout.widgets);
      y = bandLayout.nextY;
    }

    return {
      group_definition: [
        {
          title,
          layout_type: 'ordered',
          widget: nestedWidgets
        }
      ]
    };
  });
}

function validate(terraformJson: Record<string, unknown>, dashboardName: string): void {
  const resource = terraformJson.resource;
  if (!resource || typeof resource !== 'object') throw new Error('Missing resource');

  const dashboardResources = (resource as Record<string, unknown>).datadog_dashboard;
  if (!dashboardResources || typeof dashboardResources !== 'object') throw new Error('Missing datadog_dashboard');

  const dashboard = (dashboardResources as Record<string, unknown>)[dashboardName];
  if (!dashboard || typeof dashboard !== 'object') throw new Error(`Missing ${dashboardName}`);

  const layoutType = (dashboard as Record<string, unknown>).layout_type;
  if (layoutType !== 'ordered') throw new Error('Invalid layout_type');

  const widgets = (dashboard as Record<string, unknown>).widget;
  if (!Array.isArray(widgets)) throw new Error('Missing dashboard widgets');

  for (const widget of widgets as Record<string, unknown>[]) {
    if (!Array.isArray(widget.group_definition)) throw new Error('Missing group_definition');
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
  const name = resourceName(dashboardKey);
  const terraformJson = {
    resource: {
      datadog_dashboard: {
        [name]: {
          title: plan.dashboardTitle,
          description: 'Generated from Event Storming workflow by observability orchestrator',
          layout_type: 'ordered',
          widget: buildGroupWidgets(plan)
        }
      }
    }
  };

  validate(terraformJson, name);
  return terraformJson;
}
