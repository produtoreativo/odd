import { DashboardBandPlan, DashboardPalette, DashboardPlan, DashboardWidgetPlan } from '../../shared/types.js';

type GrafanaPanel = {
  id: number;
  title: string;
  type: 'stat' | 'timeseries' | 'text';
  gridPos: { x: number; y: number; w: number; h: number };
  datasource?: { type: string; uid: string };
  targets?: Array<{
    datasource: { type: string; uid: string };
    matchAny: boolean;
    tags: string[];
    type: 'tags';
    refId: string;
  }>;
  options?: Record<string, unknown>;
  fieldConfig?: Record<string, unknown>;
};

const GRID = {
  totalColumns: 24,
  heroHeight: 4,
  rowHeight: 6,
  trendHeight: 8,
  sectionGap: 1,
  headerHeight: 2
};

const ANNOTATION_DS = { type: 'datasource', uid: '-- Grafana --' };

function resourceName(title: string): string {
  return title
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'odd_dashboard';
}

function tileColumnUnits(columns: number, index: number): number {
  const baseUnits = Math.floor(GRID.totalColumns / columns);
  const usedUnits = baseUnits * (columns - 1);
  return index === columns - 1 ? GRID.totalColumns - usedUnits : baseUnits;
}

function thresholdColor(palette: DashboardPalette): string {
  if (palette === 'alert') return '#dc172a';
  if (palette === 'warning') return '#ff9830';
  if (palette === 'success') return '#2f8f46';
  return '#8e8e8e';
}

function annotationTags(widget: DashboardWidgetPlan): string[] {
  return widget.sourceEventKeys.map((key) => `event_key:${key}`);
}

function statPanel(id: number, widget: DashboardWidgetPlan, gridPos: GrafanaPanel['gridPos']): GrafanaPanel {
  const color = thresholdColor(widget.palette);
  return {
    id,
    title: widget.title,
    type: 'stat',
    gridPos,
    datasource: ANNOTATION_DS,
    targets: [{
      datasource: ANNOTATION_DS,
      matchAny: true,
      tags: annotationTags(widget),
      type: 'tags',
      refId: 'A'
    }],
    options: {
      reduceOptions: { calcs: ['count'], fields: '', values: false },
      colorMode: 'background',
      graphMode: 'none',
      textMode: 'auto'
    },
    fieldConfig: {
      defaults: {
        color: { mode: 'fixed', fixedColor: color },
        thresholds: {
          mode: 'absolute',
          steps: [{ color, value: null }]
        }
      },
      overrides: []
    }
  };
}

function timeseriesPanel(id: number, widget: DashboardWidgetPlan, gridPos: GrafanaPanel['gridPos']): GrafanaPanel {
  const color = thresholdColor(widget.palette);
  return {
    id,
    title: widget.title,
    type: 'timeseries',
    gridPos,
    datasource: ANNOTATION_DS,
    targets: [{
      datasource: ANNOTATION_DS,
      matchAny: true,
      tags: annotationTags(widget),
      type: 'tags',
      refId: 'A'
    }],
    options: {
      legend: { displayMode: 'list', placement: 'bottom' },
      tooltip: { mode: 'single' }
    },
    fieldConfig: {
      defaults: {
        color: { mode: 'fixed', fixedColor: color },
        custom: {
          lineWidth: 2,
          fillOpacity: 10,
          pointSize: 5,
          spanNulls: false
        }
      },
      overrides: []
    }
  };
}

function textPanel(id: number, content: string, gridPos: GrafanaPanel['gridPos']): GrafanaPanel {
  return {
    id,
    title: '',
    type: 'text',
    gridPos,
    options: { mode: 'markdown', content }
  };
}

function buildHeroPanel(panels: GrafanaPanel[], nextId: number, band: DashboardBandPlan): { nextId: number; nextTop: number } {
  const widget = band.widgets[0];
  if (!widget) {
    panels.push(textPanel(nextId, '# Hero Alert\n\nSem dados disponiveis.', {
      x: 0, y: 0, w: GRID.totalColumns, h: GRID.heroHeight
    }));
    return { nextId: nextId + 1, nextTop: GRID.heroHeight + GRID.sectionGap };
  }

  panels.push(statPanel(nextId, widget, {
    x: 0, y: 0, w: GRID.totalColumns, h: GRID.heroHeight
  }));
  return { nextId: nextId + 1, nextTop: GRID.heroHeight + GRID.sectionGap };
}

function buildBandPanels(
  panels: GrafanaPanel[],
  startingId: number,
  band: DashboardBandPlan,
  sectionTitle: string,
  startTop: number,
  height: number
): { nextId: number; nextTop: number } {
  let id = startingId;

  panels.push(textPanel(id, `# ${sectionTitle}`, {
    x: 0, y: startTop, w: GRID.totalColumns, h: GRID.headerHeight
  }));
  id += 1;

  const contentTop = startTop + GRID.headerHeight;
  const widgets = band.widgets;

  if (widgets.length === 0) {
    panels.push(textPanel(id, `## ${sectionTitle}\n\nSem widgets disponiveis para esta banda.`, {
      x: 0, y: contentTop, w: GRID.totalColumns, h: height
    }));
    return { nextId: id + 1, nextTop: contentTop + height + GRID.sectionGap };
  }

  const columns = Math.max(1, Math.min(3, widgets.length));
  const rows = Math.ceil(widgets.length / columns);

  widgets.forEach((widget, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const width = tileColumnUnits(columns, column);
    let left = 0;
    for (let current = 0; current < column; current += 1) {
      left += tileColumnUnits(columns, current);
    }

    const gridPos = { x: left, y: contentTop + row * height, w: width, h: height };
    const panel = widget.widgetType === 'timeseries'
      ? timeseriesPanel(id, widget, gridPos)
      : statPanel(id, widget, gridPos);

    panels.push(panel);
    id += 1;
  });

  return { nextId: id, nextTop: contentTop + rows * height + GRID.sectionGap };
}

function buildGrafanaDashboard(plan: DashboardPlan): Record<string, unknown> {
  const [heroBand, failureKpis, failureTrends, successKpis, successTrends] = plan.bands;
  const panels: GrafanaPanel[] = [];

  let { nextId, nextTop } = buildHeroPanel(panels, 1, heroBand);

  const failureKpisResult = buildBandPanels(panels, nextId, failureKpis, 'Falhas por evento', nextTop, GRID.rowHeight);
  nextId = failureKpisResult.nextId;
  nextTop = failureKpisResult.nextTop;

  const failureTrendsResult = buildBandPanels(panels, nextId, failureTrends, 'Falhas por etapa', nextTop, GRID.trendHeight);
  nextId = failureTrendsResult.nextId;
  nextTop = failureTrendsResult.nextTop;

  const successKpisResult = buildBandPanels(panels, nextId, successKpis, 'Sucessos por evento', nextTop, GRID.rowHeight);
  nextId = successKpisResult.nextId;
  nextTop = successKpisResult.nextTop;

  const successTrendsResult = buildBandPanels(panels, nextId, successTrends, 'Sucessos por etapa', nextTop, GRID.trendHeight);
  void successTrendsResult;

  return {
    title: plan.dashboardTitle,
    tags: ['odd', 'generated'],
    timezone: 'browser',
    schemaVersion: 39,
    version: 0,
    panels,
    annotations: {
      list: [{
        datasource: ANNOTATION_DS,
        enable: true,
        name: 'ODD Events',
        iconColor: 'rgba(0, 211, 255, 1)',
        type: 'tags',
        tags: ['source:odd']
      }]
    },
    refresh: '30s',
    time: { from: 'now-6h', to: 'now' }
  };
}

function validate(terraformJson: Record<string, unknown>, name: string): void {
  const resource = terraformJson.resource as Record<string, unknown> | undefined;
  if (!resource?.grafana_dashboard) {
    throw new Error('Terraform JSON inválido: falta resource.grafana_dashboard');
  }
  const dashboard = (resource.grafana_dashboard as Record<string, unknown>)[name] as Record<string, unknown> | undefined;
  if (!dashboard?.config_json || typeof dashboard.config_json !== 'string') {
    throw new Error('Terraform JSON inválido: falta config_json no recurso');
  }
  const parsed = JSON.parse(dashboard.config_json as string) as { panels?: unknown[] };
  if (!Array.isArray(parsed.panels) || parsed.panels.length === 0) {
    throw new Error('Dashboard JSON inválido: nenhum panel encontrado');
  }
}

export async function buildGrafanaDashboardTerraform(plan: DashboardPlan): Promise<Record<string, unknown>> {
  const dashboard = buildGrafanaDashboard(plan);
  const name = resourceName(plan.dashboardTitle);
  const terraformJson = {
    resource: {
      grafana_dashboard: {
        [name]: {
          config_json: JSON.stringify(dashboard)
        }
      }
    }
  };

  validate(terraformJson, name);
  return terraformJson;
}
