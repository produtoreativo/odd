import { DashboardPlan, EventStormingRow } from '../../shared/types.js';
import { generateDashboardPlan } from './ollama.js';

export async function buildDashboardPlan(rows: EventStormingRow[], dashboardTitle: string): Promise<DashboardPlan> {
  return generateDashboardPlan(rows, dashboardTitle);
}
