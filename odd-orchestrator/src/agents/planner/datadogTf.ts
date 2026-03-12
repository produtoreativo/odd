import { DashboardPlan } from '../../shared/types.js';
import { callOllama } from './ollama.js';

const responseFormat = {
  type: 'object',
  properties: {
    resource: {
      type: 'object',
      properties: {
        datadog_dashboard_json: {
          type: 'object',
          properties: {
            event_storming_dashboard: {
              type: 'object',
              properties: {
                dashboard: { type: 'string' }
              },
              required: ['dashboard']
            }
          },
          required: ['event_storming_dashboard']
        }
      },
      required: ['datadog_dashboard_json']
    }
  },
  required: ['resource']
};

function buildPrompt(plan: DashboardPlan): string {
  return [
    'Você é especialista em DataDog Dashboard e Terraform.',
    'Receba um DashboardPlan e gere o JSON Terraform para criar o dashboard via recurso datadog_dashboard_json.',
    '',
    'Regras:',
    '- O dashboard deve ter layout_type: "ordered" e template_variables: [].',
    `- O título do dashboard deve ser exatamente: ${JSON.stringify(plan.dashboardTitle)}`,
    '- description: "Generated from Event Storming spreadsheet by planner agent"',
    '- Primeiro widget: note com content "Gerado automaticamente a partir de Event Storming. Dashboard: {dashboardTitle}", background_color "white", font_size "14", text_align "left", show_tick false, tick_edge "left", tick_pos "50%".',
    '- Para cada grupo: note widget com content "Stage: {group.title}", background_color "blue", font_size "16", text_align "left", show_tick false, tick_edge "left", tick_pos "50%".',
    '- Para cada widget do grupo: event_stream widget com title do widget, query do widget (se vazio usar "tags:(event_key:{widget.id} source:odd)"), event_size "l".',
    '- Cada widget no array deve ter formato: { "definition": { ... } }',
    '- O resultado final deve ter a estrutura: { "resource": { "datadog_dashboard_json": { "event_storming_dashboard": { "dashboard": "<JSON stringificado do dashboard>" } } } }',
    '- O campo "dashboard" deve ser uma STRING JSON (stringificado), não um objeto.',
    '',
    'DashboardPlan de entrada:',
    JSON.stringify(plan, null, 2),
    '',
    'Responda APENAS com o JSON Terraform.'
  ].join('\n');
}

function validate(obj: unknown): asserts obj is Record<string, unknown> {
  if (!obj || typeof obj !== 'object') throw new Error('LLM returned non-object');
  const root = obj as Record<string, unknown>;

  const resource = root.resource;
  if (!resource || typeof resource !== 'object') throw new Error('Missing resource');

  const ddJson = (resource as Record<string, unknown>).datadog_dashboard_json;
  if (!ddJson || typeof ddJson !== 'object') throw new Error('Missing datadog_dashboard_json');

  const esDashboard = (ddJson as Record<string, unknown>).event_storming_dashboard;
  if (!esDashboard || typeof esDashboard !== 'object') throw new Error('Missing event_storming_dashboard');

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

export async function buildDatadogDashboardTerraform(plan: DashboardPlan): Promise<Record<string, unknown>> {
  const result = await callOllama(buildPrompt(plan), responseFormat);
  validate(result);
  return result;
}
