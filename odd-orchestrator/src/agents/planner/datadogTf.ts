import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DashboardPlan } from '../../shared/types.js';
import { LlmExecutor } from '../../shared/llm/index.js';

function produceResponseFormat(dashboardTitle: string) {

  const dashboardName = `${dashboardTitle}`;

  return {
    type: 'object',
    properties: {
      resource: {
        type: 'object',
        properties: {
          datadog_dashboard_json: {
            type: 'object',
            properties: {
              [dashboardName]: {
                type: 'object',
                properties: {
                  dashboard: { type: 'string' }
                },
                required: ['dashboard']
              }
            },
            required: [dashboardName]
          }
        },
        required: ['datadog_dashboard_json']
      }
    },
    required: ['resource']
  };

}

const promptTemplatePath = path.join(__dirname, 'datadogTf.prompt.md');
let promptTemplatePromise: Promise<string> | null = null;

async function loadPromptTemplate(): Promise<string> {
  if (!promptTemplatePromise) {
    promptTemplatePromise = readFile(promptTemplatePath, 'utf-8');
  }
  return promptTemplatePromise;
}

async function buildPrompt(plan: DashboardPlan): Promise<string> {
  const template = await loadPromptTemplate();
  return template
    .replaceAll('{{DASHBOARD_TITLE_JSON}}', JSON.stringify(plan.dashboardTitle))
    .replaceAll('{{DASHBOARD_PLAN_JSON}}', JSON.stringify(plan, null, 2));
}

function validate(obj: unknown, dashboardName: string): asserts obj is Record<string, unknown> {
  if (!obj || typeof obj !== 'object') throw new Error('LLM returned non-object');
  const root = obj as Record<string, unknown>;

  const resource = root.resource;
  if (!resource || typeof resource !== 'object') throw new Error('Missing resource');

  const ddJson = (resource as Record<string, unknown>).datadog_dashboard_json;
  if (!ddJson || typeof ddJson !== 'object') throw new Error('Missing datadog_dashboard_json');

  const esDashboard = (ddJson as Record<string, unknown>)[dashboardName];
  if (!esDashboard || typeof esDashboard !== 'object') throw new Error(`Missing ${dashboardName}`);

  const dashboardStr = (esDashboard as Record<string, unknown>).dashboard;
  if (typeof dashboardStr !== 'string') throw new Error('dashboard field is not a string');

  const dashboard = JSON.parse(dashboardStr) as Record<string, unknown>;
  if (typeof dashboard.title !== 'string') throw new Error('Missing dashboard title');
  if (dashboard.layout_type !== 'ordered') throw new Error('Invalid layout_type');
  if (!Array.isArray(dashboard.widgets)) throw new Error('Missing widgets array');

  for (const widget of dashboard.widgets) {
    const w = widget as Record<string, unknown>;
    if (!w.definition || typeof w.definition !== 'object') throw new Error('Missing widget definition');
    const def = w.definition as Record<string, unknown>;
    if (def.type !== 'note' && def.type !== 'event_stream') throw new Error(`Invalid widget type: ${def.type}`);
  }
}

export async function buildDatadogDashboardTerraform(llm: LlmExecutor, plan: DashboardPlan): Promise<Record<string, unknown>> {

  const responseFormat = produceResponseFormat(plan.dashboardTitle);

  const prompt = await buildPrompt(plan);
  const result = await llm.call(prompt, responseFormat);
  validate(result, plan.dashboardTitle);
  return result;
}
