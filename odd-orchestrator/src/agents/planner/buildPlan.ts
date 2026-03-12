import { DashboardPlan, DashboardGroupPlan, DashboardWidgetPlan, EventStormingRow } from '../../shared/types.js';
import { generateDashboardPlan, toDisplayTitle } from './ollama.js';

export async function buildDashboardPlan(rows: EventStormingRow[], dashboardTitle: string): Promise<DashboardPlan> {
  const llmPlan = await generateDashboardPlan(rows, dashboardTitle);
  if (llmPlan) return llmPlan;

  return buildDashboardPlanDeterministic(rows, dashboardTitle);
}

function buildDashboardPlanDeterministic(rows: EventStormingRow[], dashboardTitle: string): DashboardPlan {
  const sorted = [...rows].sort((a, b) => a.ordem - b.ordem);
  const groupsMap = new Map<string, EventStormingRow[]>();

  for (const row of sorted) {
    const list = groupsMap.get(row.stage) ?? [];
    list.push(row);
    groupsMap.set(row.stage, list);
  }

  const groups: DashboardGroupPlan[] = [];
  for (const [stage, stageRows] of groupsMap.entries()) {
    const title = toDisplayTitle(stage);
    const widgets: DashboardWidgetPlan[] = stageRows.map((row) => ({
      id: row.eventKey,
      title: row.eventTitle,
      widgetType: row.dashboardWidget,
      query: row.queryHint,
      stage: row.stage
    }));

    groups.push({ stage, title, widgets });
  }

  const customEvents = sorted.map((row) => ({
    title: row.eventKey,
    text: `Business event emitted from Event Storming row ${row.ordem}`,
    tags: [
      `event_key:${row.eventKey}`,
      `stage:${row.stage}`,
      `actor:${row.actor}`,
      `service:${row.service}`,
      ...row.tags,
      'source:odd'
    ]
  }));

  return {
    dashboardTitle,
    groups,
    customEvents
  };
}
