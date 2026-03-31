import { DashboardBandPlan, DashboardPalette, DashboardPlan, DashboardWidgetPlan } from '../../shared/types.js';

type DynatraceMarkdownTile = {
  type: 'markdown';
  content: string;
};

type DynatraceDataTile = {
  title: string;
  type: 'data';
  query: string;
  visualization: 'singleValue' | 'lineChart';
  visualizationSettings: {
    autoSelectVisualization: false;
    thresholds?: Array<{
      id: number;
      field: 'count';
      title: '';
      isEnabled: true;
      rules: Array<{
        id: number;
        color: string;
        comparator: '≥';
        label: '';
        value: number;
      }>;
    }>;
    singleValue?: {
      labelMode: 'none';
      colorThresholdTarget?: 'background';
    };
    chartSettings?: {
      gapPolicy: 'gap';
      curve: 'linear';
      pointsDisplay: 'auto';
      xAxisScaling: 'analyzedTimeframe';
      hiddenLegendFields: ['interval'];
      colorPalette?: 'log-level' | 'categorical';
      seriesOverrides?: Array<{
        seriesId: ['count'];
        override: {
          color: {
            Default: string;
          };
        };
      }>;
    };
  };
  querySettings: {
    maxResultRecords: 1000;
    defaultScanLimitGbytes: 500;
    maxResultMegaBytes: 1;
    defaultSamplingRatio: 10;
    enableSampling: false;
  };
  davis: {
    enabled: false;
    davisVisualization: {
      isAvailable: true;
    };
  };
};

type DynatraceTile = DynatraceMarkdownTile | DynatraceDataTile;

type DynatraceLayout = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type DynatraceDashboardDocument = {
  version: 21;
  variables: [];
  tiles: Record<string, DynatraceTile>;
  layouts: Record<string, DynatraceLayout>;
  importedWithCode: false;
  settings: Record<string, never>;
  annotations: [];
};

const GRID = {
  totalColumns: 24,
  heroHeight: 4,
  rowHeight: 4,
  trendHeight: 5,
  sectionGap: 1
};

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

function truncateMarkdown(markdown: string): string {
  const limit = 4000;
  if (markdown.length <= limit) return markdown;
  return `${markdown.slice(0, limit - 24)}\n\n_Conteudo truncado pelo limite do tile._`;
}

function addTile(
  document: DynatraceDashboardDocument,
  id: number,
  tile: DynatraceTile,
  layout: DynatraceLayout
): void {
  document.tiles[String(id)] = tile;
  document.layouts[String(id)] = layout;
}

function markdownTile(content: string): DynatraceMarkdownTile {
  return {
    type: 'markdown',
    content: truncateMarkdown(content)
  };
}

function thresholdColor(palette: DashboardPalette): string | undefined {
  if (palette === 'alert') return '#dc172a';
  if (palette === 'success') return '#2f8f46';
  return undefined;
}

function singleValueThresholds(widget: DashboardWidgetPlan) {
  if (typeof widget.thresholdValue !== 'number' || !widget.thresholdDirection) return undefined;

  if (widget.thresholdDirection === 'at_least_good') {
    return [{
      id: 1,
      field: 'count' as const,
      title: '' as const,
      isEnabled: true as const,
      rules: [
        { id: 0, color: '#dc172a', comparator: '≥' as const, label: '' as const, value: 0 },
        { id: 1, color: '#2f8f46', comparator: '≥' as const, label: '' as const, value: widget.thresholdValue }
      ]
    }];
  }

  if (widget.thresholdDirection === 'above_bad') {
    return [{
      id: 1,
      field: 'count' as const,
      title: '' as const,
      isEnabled: true as const,
      rules: [
        { id: 0, color: '#2f8f46', comparator: '≥' as const, label: '' as const, value: 0 },
        { id: 1, color: '#dc172a', comparator: '≥' as const, label: '' as const, value: widget.thresholdValue + 1 }
      ]
    }];
  }

  return undefined;
}

function singleValueTile(title: string, query: string, widget: DashboardWidgetPlan): DynatraceDataTile {
  const color = thresholdColor(widget.palette);
  const thresholds = singleValueThresholds(widget);
  return {
    title,
    type: 'data',
    query,
    visualization: 'singleValue',
    visualizationSettings: {
      autoSelectVisualization: false,
      ...(thresholds ? { thresholds } : color ? {
        thresholds: [{
          id: 1,
          field: 'count',
          title: '' as const,
          isEnabled: true,
          rules: [{
            id: 0,
            color,
            comparator: '≥',
            label: '' as const,
            value: 0
          }]
        }]
      } : {}),
      singleValue: {
        labelMode: 'none',
        ...(color ? { colorThresholdTarget: 'background' } : {})
      }
    },
    querySettings: {
      maxResultRecords: 1000,
      defaultScanLimitGbytes: 500,
      maxResultMegaBytes: 1,
      defaultSamplingRatio: 10,
      enableSampling: false
    },
    davis: {
      enabled: false,
      davisVisualization: {
        isAvailable: true
      }
    }
  };
}

function lineChartTile(title: string, query: string, palette: DashboardPalette): DynatraceDataTile {
  const color = thresholdColor(palette);
  return {
    title,
    type: 'data',
    query,
    visualization: 'lineChart',
    visualizationSettings: {
      autoSelectVisualization: false,
      chartSettings: {
        gapPolicy: 'gap',
        curve: 'linear',
        pointsDisplay: 'auto',
        xAxisScaling: 'analyzedTimeframe',
        hiddenLegendFields: ['interval'],
        ...(palette === 'alert' ? { colorPalette: 'log-level' as const } : {}),
        ...(color ? {
          seriesOverrides: [{
            seriesId: ['count'],
            override: {
              color: {
                Default: color
              }
            }
          }]
        } : {})
      }
    },
    querySettings: {
      maxResultRecords: 1000,
      defaultScanLimitGbytes: 500,
      maxResultMegaBytes: 1,
      defaultSamplingRatio: 10,
      enableSampling: false
    },
    davis: {
      enabled: false,
      davisVisualization: {
        isAvailable: true
      }
    }
  };
}

function eventFilter(widget: DashboardWidgetPlan): string {
  const names = widget.sourceEventKeys;
  return names
    .map((name) => `(event.name == "${name}" or title == "${name}")`)
    .join(' or ');
}

function dqlForSingleValue(widget: DashboardWidgetPlan): string {
  const filters = eventFilter(widget);
  return [
    'fetch events',
    `| filter ${filters}`,
    '| summarize count = count()'
  ].join('\n');
}

function dqlForTimeseries(widget: DashboardWidgetPlan): string {
  const filters = eventFilter(widget);
  return [
    'fetch events',
    `| filter ${filters}`,
    '| makeTimeseries count = count(default: 0), interval: 5m'
  ].join('\n');
}

function headerMarkdown(title: string): string {
  return `# ${title}`;
}

function buildHeaderTile(
  document: DynatraceDashboardDocument,
  id: number,
  title: string,
  y: number,
  x: number,
  w: number,
  h: number
): void {
  addTile(document, id, markdownTile(headerMarkdown(title)), { x, y, w, h });
}

function buildHeroTile(
  document: DynatraceDashboardDocument,
  id: number,
  band: DashboardBandPlan
): number {
  const widget = band.widgets[0];
  if (!widget) {
    addTile(document, id, markdownTile('# Hero Alert\n\nSem dados disponiveis.'), {
      x: 0,
      y: 0,
      w: GRID.totalColumns,
      h: GRID.heroHeight
    });
    return GRID.heroHeight + GRID.sectionGap;
  }

  addTile(document, id, singleValueTile(widget.title, dqlForSingleValue(widget), widget), {
    x: 0,
    y: 0,
    w: GRID.totalColumns,
    h: GRID.heroHeight
  });

  return GRID.heroHeight + GRID.sectionGap;
}

function buildBandTiles(
  document: DynatraceDashboardDocument,
  startingId: number,
  band: DashboardBandPlan,
  sectionTitle: string,
  startTop: number,
  height: number
): { nextId: number; nextTop: number } {
  let id = startingId;

  buildHeaderTile(document, id, sectionTitle, startTop, 0, GRID.totalColumns, 2);
  id += 1;

  const widgets = band.widgets;
  const contentTop = startTop + 2;

  if (widgets.length === 0) {
    addTile(document, id, markdownTile(`## ${sectionTitle}\n\nSem widgets disponiveis para esta banda.`), {
      x: 0,
      y: contentTop,
      w: GRID.totalColumns,
      h: height
    });
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

    const tile = widget.widgetType === 'timeseries'
      ? lineChartTile(widget.title, dqlForTimeseries(widget), widget.palette)
      : singleValueTile(widget.title, dqlForSingleValue(widget), widget);

    addTile(document, id, tile, {
      x: left,
      y: contentTop + row * height,
      w: width,
      h: height
    });
    id += 1;
  });

  return { nextId: id, nextTop: contentTop + rows * height + GRID.sectionGap };
}

function buildDynatraceDashboardDocument(plan: DashboardPlan): DynatraceDashboardDocument {
  const [heroBand, failureKpis, failureTrends, successKpis, successTrends] = plan.bands;

  const document: DynatraceDashboardDocument = {
    version: 21,
    variables: [],
    tiles: {},
    layouts: {},
    importedWithCode: false,
    settings: {},
    annotations: []
  };

  let nextId = 0;
  let top = buildHeroTile(document, nextId, heroBand);
  nextId += 1;

  const failureKpisResult = buildBandTiles(document, nextId, failureKpis, 'Falhas por evento', top, GRID.rowHeight);
  nextId = failureKpisResult.nextId;
  top = failureKpisResult.nextTop;

  const failureTrendsResult = buildBandTiles(document, nextId, failureTrends, 'Falhas por etapa', top, GRID.trendHeight);
  nextId = failureTrendsResult.nextId;
  top = failureTrendsResult.nextTop;

  const successKpisResult = buildBandTiles(document, nextId, successKpis, 'Sucessos por evento', top, GRID.rowHeight);
  nextId = successKpisResult.nextId;
  top = successKpisResult.nextTop;

  const successTrendsResult = buildBandTiles(document, nextId, successTrends, 'Sucessos por etapa', top, GRID.trendHeight);
  nextId = successTrendsResult.nextId;
  top = successTrendsResult.nextTop;

  void nextId;
  void top;

  return document;
}

export async function buildDynatraceDashboardTerraform(plan: DashboardPlan): Promise<Record<string, unknown>> {
  const document = buildDynatraceDashboardDocument(plan);
  const name = resourceName(plan.dashboardTitle);

  return {
    resource: {
      dynatrace_document: {
        [name]: {
          name: plan.dashboardTitle,
          type: 'dashboard',
          content: JSON.stringify(document)
        }
      }
    }
  };
}
