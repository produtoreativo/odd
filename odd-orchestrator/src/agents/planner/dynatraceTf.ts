import { DashboardBandPlan, DashboardPlan, DashboardWidgetPlan } from '../../shared/types.js';

type DynatraceDocumentTile = {
  name: string;
  tileType: 'MARKDOWN';
  nameSize: 'small' | 'medium' | 'large';
  bounds: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  filterBy: {
    managementZone: null;
  };
  config: {
    markdown: string;
  };
};

type DynatraceDashboardDocument = {
  version: 1;
  page: {
    title: string;
    description: string;
    contents: DynatraceDocumentTile[];
  };
};

const GRID = {
  unit: 38,
  totalColumns: 32,
  heroHeight: 228,
  rowHeight: 152,
  trendHeight: 228,
  sectionGap: 38
};

function totalWidth(): number {
  return GRID.unit * GRID.totalColumns;
}

function resourceName(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'odd_dashboard';
}

function tileColumnUnits(columns: number, index: number): number {
  const baseUnits = Math.floor(GRID.totalColumns / columns);
  const usedUnits = baseUnits * (columns - 1);
  return index === columns - 1 ? GRID.totalColumns - usedUnits : baseUnits;
}

function severityLabel(widget: DashboardWidgetPlan): string {
  if (widget.palette === 'alert') return 'Criticidade: alta';
  if (widget.palette === 'warning') return 'Criticidade: media';
  if (widget.palette === 'success') return 'Criticidade: sucesso';
  return 'Criticidade: neutra';
}

function truncateMarkdown(markdown: string): string {
  const limit = 1000;
  if (markdown.length <= limit) return markdown;
  return `${markdown.slice(0, limit - 24)}\n\n_Conteudo truncado pelo limite do tile._`;
}

function widgetMarkdown(sectionTitle: string, widget: DashboardWidgetPlan): string {
  return truncateMarkdown([
    `## ${sectionTitle}`,
    '',
    `### ${widget.title}`,
    '',
    `- Tipo: ${widget.widgetType}`,
    `- Stage: ${widget.stage}`,
    `- ${severityLabel(widget)}`,
    '',
    '```txt',
    widget.query,
    '```'
  ].join('\n'));
}

function makeTile(
  name: string,
  markdown: string,
  top: number,
  left: number,
  width: number,
  height: number,
  nameSize: 'small' | 'medium' | 'large'
): DynatraceDocumentTile {
  return {
    name,
    tileType: 'MARKDOWN',
    nameSize,
    bounds: {
      top,
      left,
      width,
      height
    },
    filterBy: {
      managementZone: null
    },
    config: {
      markdown: truncateMarkdown(markdown)
    }
  };
}

function buildHeroTile(band: DashboardBandPlan): DynatraceDocumentTile {
  const widget = band.widgets[0];
  return makeTile(
    band.sectionType === 'problems' ? 'Alertas de Formacao de Grupos' : 'Saude do Fluxo de Formacao',
    widget ? widgetMarkdown('Hero Alert', widget) : '## Hero Alert\n\nSem dados disponiveis.',
    0,
    0,
    totalWidth(),
    GRID.heroHeight,
    'large'
  );
}

function buildBandTiles(
  band: DashboardBandPlan,
  sectionTitle: string,
  startTop: number,
  height: number
): { tiles: DynatraceDocumentTile[]; nextTop: number } {
  const widgets = band.widgets.length > 0 ? band.widgets : [];
  const columns = Math.max(1, Math.min(3, widgets.length || 1));
  const rows = widgets.length > 0 ? Math.ceil(widgets.length / columns) : 1;
  const tiles: DynatraceDocumentTile[] = [];

  if (widgets.length === 0) {
    tiles.push(makeTile(
      sectionTitle,
      `## ${sectionTitle}\n\nSem widgets disponiveis para esta banda.`,
      startTop,
      0,
      totalWidth(),
      height,
      'medium'
    ));

    return { tiles, nextTop: startTop + height + GRID.sectionGap };
  }

  widgets.forEach((widget, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const widthUnits = tileColumnUnits(columns, column);
    const width = widthUnits * GRID.unit;
    let left = 0;
    for (let current = 0; current < column; current += 1) {
      left += tileColumnUnits(columns, current) * GRID.unit;
    }

    tiles.push(makeTile(
      widget.title,
      widgetMarkdown(sectionTitle, widget),
      startTop + row * height,
      left,
      width,
      height,
      'medium'
    ));
  });

  return { tiles, nextTop: startTop + rows * height + GRID.sectionGap };
}

function buildDynatraceDashboardDocument(plan: DashboardPlan): DynatraceDashboardDocument {
  const [heroBand, failureKpis, failureTrends, successKpis, successTrends] = plan.bands;

  const heroTile = buildHeroTile(heroBand);
  let top = GRID.heroHeight + GRID.sectionGap;

  const failureKpiTiles = buildBandTiles(failureKpis, 'Falhas por evento', top, GRID.rowHeight);
  top = failureKpiTiles.nextTop;

  const failureTrendTiles = buildBandTiles(failureTrends, 'Falhas por etapa', top, GRID.trendHeight);
  top = failureTrendTiles.nextTop;

  const successKpiTiles = buildBandTiles(successKpis, 'Sucessos por evento', top, GRID.rowHeight);
  top = successKpiTiles.nextTop;

  const successTrendTiles = buildBandTiles(successTrends, 'Sucessos por etapa', top, GRID.trendHeight);

  return {
    version: 1,
    page: {
      title: plan.dashboardTitle,
      description: 'Generated by odd-orchestrator for Dynatrace new dashboards',
      contents: [
        heroTile,
        ...failureKpiTiles.tiles,
        ...failureTrendTiles.tiles,
        ...successKpiTiles.tiles,
        ...successTrendTiles.tiles
      ]
    }
  };
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
