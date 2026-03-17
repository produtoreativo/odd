import { DashboardBandId, DashboardBandPlan, DashboardPlan, DashboardWidgetPlan, EventStormingRow, CategorizedEvents } from '../../shared/types.js';
import { LlmExecutor } from '../../shared/llm/index.js';

const BAND_ORDER: DashboardBandId[] = [
  'hero_alert',
  'failure_kpis',
  'failure_trends',
  'success_kpis',
  'success_trends'
];

const PROBLEM_HINTS = ['timeout', 'error', 'failed', 'failure', 'reject', 'rejected', 'alert', 'warning', 'falha', 'erro', 'rejeitado', 'alerta'];
const FINAL_STAGE_HINTS = ['checkout', 'payment', 'approval', 'completed', 'conclusao', 'conclusão', 'adesao', 'adesão', 'grupo', 'order'];

function toStageTitle(stage: string): string {
  return stage
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildEventQuery(event: EventStormingRow): string {
  if (event.queryHint.trim() !== '') {
    return event.queryHint.includes('source:odd')
      ? event.queryHint
      : `${event.queryHint.replace(/\)\s*$/, '')} source:odd)`;
  }
  return `tags:(event_key:${event.eventKey} source:odd)`;
}

function buildStageQuery(stage: string, events?: EventStormingRow[]): string {
  if (events && events.length > 0) {
    const clauses = events
      .map((event) => `event_key:${event.eventKey}`)
      .join(' OR ');
    return `tags:(${clauses} source:odd)`;
  }
  return `tags:(stage:${stage} source:odd)`;
}

function scoreProblem(event: EventStormingRow): number {
  const haystack = `${event.eventKey} ${event.eventTitle} ${event.stage} ${event.tags.join(' ')}`.toLowerCase();
  let score = 0;

  for (const hint of PROBLEM_HINTS) {
    if (haystack.includes(hint)) score += 10;
  }

  for (const hint of FINAL_STAGE_HINTS) {
    if (haystack.includes(hint)) score += 4;
  }

  return score - event.ordem / 1000;
}

function buildHeroWidget(problems: EventStormingRow[], normal: EventStormingRow[]): DashboardWidgetPlan {
  if (problems.length > 0) {
    const topProblem = [...problems].sort((left, right) => scoreProblem(right) - scoreProblem(left))[0];
    return {
      id: 'hero_alert_primary',
      title: `${topProblem.eventTitle} nos últimos 5m`,
      widgetType: 'query_value',
      query: buildEventQuery(topProblem),
      stage: topProblem.stage,
      sectionType: 'problems',
      sourceEventKeys: [topProblem.eventKey],
      visualRole: 'hero_alert',
      palette: 'alert'
    };
  }

  const allNormal = normal.length > 0 ? normal : [];
  const stage = allNormal[0]?.stage ?? 'overview';
  return {
    id: 'hero_alert_clear',
    title: 'Sem falhas críticas | volume saudável nos últimos 5m',
    widgetType: 'query_value',
    query: allNormal.length > 0 ? buildStageQuery(stage, allNormal) : 'tags:(source:odd)',
    stage,
    sectionType: 'normal',
    sourceEventKeys: allNormal.map((event) => event.eventKey),
    visualRole: 'hero_alert',
    palette: 'success'
  };
}

function buildKpiWidgets(events: EventStormingRow[], sectionType: 'problems' | 'normal'): DashboardWidgetPlan[] {
  return events
    .slice()
    .sort((left, right) => left.ordem - right.ordem)
    .map((event, index) => ({
      id: `${sectionType}_kpi_${index + 1}_${event.eventKey}`,
      title: event.eventTitle,
      widgetType: 'query_value',
      query: buildEventQuery(event),
      stage: event.stage,
      sectionType,
      sourceEventKeys: [event.eventKey],
      visualRole: 'kpi',
      palette: sectionType === 'problems' ? (index === 0 ? 'alert' : 'warning') : 'success'
    }));
}

function buildTrendWidgets(events: EventStormingRow[], sectionType: 'problems' | 'normal'): DashboardWidgetPlan[] {
  const grouped = new Map<string, EventStormingRow[]>();
  const firstSeen = new Map<string, number>();

  for (const event of events.slice().sort((left, right) => left.ordem - right.ordem)) {
    if (!grouped.has(event.stage)) grouped.set(event.stage, []);
    grouped.get(event.stage)?.push(event);
    if (!firstSeen.has(event.stage)) firstSeen.set(event.stage, event.ordem);
  }

  return [...grouped.entries()]
    .sort((left, right) => {
      const countDelta = right[1].length - left[1].length;
      if (countDelta !== 0) return countDelta;
      return (firstSeen.get(left[0]) ?? 0) - (firstSeen.get(right[0]) ?? 0);
    })
    .slice(0, 3)
    .map(([stage, stageEvents], index) => ({
      id: `${sectionType}_trend_${index + 1}_${stage}`,
      title: `${sectionType === 'problems' ? 'Falhas' : 'Sucessos'} em ${toStageTitle(stage)}`,
      widgetType: 'timeseries',
      query: buildStageQuery(stage, stageEvents),
      stage,
      sectionType,
      sourceEventKeys: stageEvents.map((event) => event.eventKey),
      visualRole: 'trend',
      palette: sectionType === 'problems' ? 'alert' : 'success'
    }));
}

function buildBands(categorized: CategorizedEvents): DashboardBandPlan[] {
  return [
    {
      id: 'hero_alert',
      title: 'Hero Alert',
      sectionType: categorized.problems.length > 0 ? 'problems' : 'normal',
      widgets: [buildHeroWidget(categorized.problems, categorized.normal)]
    },
    {
      id: 'failure_kpis',
      title: 'Falhas por evento',
      sectionType: 'problems',
      widgets: buildKpiWidgets(categorized.problems, 'problems')
    },
    {
      id: 'failure_trends',
      title: 'Falhas por etapa',
      sectionType: 'problems',
      widgets: buildTrendWidgets(categorized.problems, 'problems')
    },
    {
      id: 'success_kpis',
      title: 'Sucessos por evento',
      sectionType: 'normal',
      widgets: buildKpiWidgets(categorized.normal, 'normal')
    },
    {
      id: 'success_trends',
      title: 'Sucessos por etapa',
      sectionType: 'normal',
      widgets: buildTrendWidgets(categorized.normal, 'normal')
    }
  ];
}

function buildTaggedEvent(event: EventStormingRow, outcome: 'problem' | 'normal') {
  const isProblem = outcome === 'problem';

  return {
    title: event.eventKey,
    text: isProblem
      ? `Exception event emitted from Event Storming row ${event.ordem}`
      : `Business event emitted from Event Storming row ${event.ordem}`,
    alert_type: isProblem ? 'error' as const : 'success' as const,
    priority: 'normal' as const,
    source_type_name: isProblem ? 'odd-exception' : 'odd-business-event',
    aggregation_key: `${outcome}:${event.stage}`,
    tags: [
      `event_key:${event.eventKey}`,
      `stage:${event.stage}`,
      `actor:${event.actor}`,
      `service:${event.service}`,
      `outcome:${outcome}`,
      isProblem ? 'exception:true' : 'success:true',
      isProblem ? 'event_type:exception' : 'event_type:business',
      ...event.tags,
      'source:odd'
    ]
  };
}

function buildCustomEvents(categorized: CategorizedEvents) {
  return [
    ...categorized.problems.map((event) => buildTaggedEvent(event, 'problem')),
    ...categorized.normal.map((event) => buildTaggedEvent(event, 'normal'))
  ]
    .slice()
    .sort((left, right) => {
      const leftOrder = Number.parseInt(left.text.match(/row (\d+)/)?.[1] ?? '0', 10);
      const rightOrder = Number.parseInt(right.text.match(/row (\d+)/)?.[1] ?? '0', 10);
      return leftOrder - rightOrder;
    });
}

function validate(plan: DashboardPlan, inputRows: EventStormingRow[]): void {
  if (plan.bands.length !== BAND_ORDER.length) {
    throw new Error(`Invalid number of dashboard bands: expected ${BAND_ORDER.length}, got ${plan.bands.length}`);
  }

  const inputKeys = new Set(inputRows.map((row) => row.eventKey));
  const referencedKeys = new Set<string>();
  const customEventKeys = new Set<string>();

  plan.bands.forEach((band, index) => {
    if (band.id !== BAND_ORDER[index]) throw new Error(`Unexpected band order at position ${index}: ${band.id}`);
    for (const widget of band.widgets) {
      if (widget.widgetType !== 'query_value' && widget.widgetType !== 'timeseries') {
        throw new Error(`Invalid widgetType: ${widget.widgetType}`);
      }
      if (!Array.isArray(widget.sourceEventKeys) || widget.sourceEventKeys.length === 0) {
        throw new Error(`Widget ${widget.id} must reference at least one source event`);
      }
      for (const eventKey of widget.sourceEventKeys) {
        if (!inputKeys.has(eventKey)) throw new Error(`Unknown source event key: ${eventKey}`);
        referencedKeys.add(eventKey);
      }
    }
  });

  for (const event of plan.customEvents) {
    customEventKeys.add(event.title);
    if (!event.tags.includes('source:odd')) throw new Error(`Missing source:odd tag on custom event ${event.title}`);
  }

  for (const eventKey of inputKeys) {
    if (!referencedKeys.has(eventKey)) throw new Error(`Event not represented in dashboard plan: ${eventKey}`);
    if (!customEventKeys.has(eventKey)) throw new Error(`Missing custom event payload for ${eventKey}`);
  }
}

export async function buildDashboardPlan(_llm: LlmExecutor, categorized: CategorizedEvents, dashboardTitle: string): Promise<DashboardPlan> {
  const plan: DashboardPlan = {
    dashboardTitle,
    bands: buildBands(categorized),
    customEvents: buildCustomEvents(categorized)
  };

  validate(plan, [...categorized.problems, ...categorized.normal]);
  return plan;
}
