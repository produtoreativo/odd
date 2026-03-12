import { DashboardPlan } from '../../shared/types.js';
import { generateTerraformJson } from './ollama.js';

export async function buildDatadogDashboardTerraform(plan: DashboardPlan): Promise<Record<string, unknown>> {
  return generateTerraformJson(plan);
}
