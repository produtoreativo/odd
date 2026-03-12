import { DashboardPlan, EventStormingRow } from '../../shared/types.js';

const dashboardPlanFormat = {
  type: 'object',
  properties: {
    dashboardTitle: { type: 'string' },
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          stage: { type: 'string' },
          title: { type: 'string' },
          widgets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                widgetType: { type: 'string', enum: ['event_stream', 'note'] },
                query: { type: 'string' },
                stage: { type: 'string' }
              },
              required: ['id', 'title', 'widgetType', 'query', 'stage']
            }
          }
        },
        required: ['stage', 'title', 'widgets']
      }
    },
    customEvents: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          text: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } }
        },
        required: ['title', 'text', 'tags']
      }
    }
  },
  required: ['dashboardTitle', 'groups', 'customEvents']
};

const terraformFormat = {
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

function buildPlanPrompt(rows: EventStormingRow[], dashboardTitle: string): string {
  return [
    'Você é especialista em DataDog Dashboard e Event Storming.',
    'Receba as linhas de Event Storming abaixo e gere um DashboardPlan JSON completo.',
    '',
    'Regras:',
    '- Agrupe as linhas pelo campo "stage", mantendo a ordem do campo "ordem" dentro de cada grupo.',
    '- Para cada grupo, gere um título legível em português para o stage.',
    '- Cada linha vira um widget: id = eventKey, title = eventTitle, widgetType = dashboardWidget (apenas "event_stream" ou "note"), query = queryHint, stage = stage.',
    '- customEvents: um por linha. title = eventKey. text = "Business event emitted from Event Storming row {ordem}". tags deve incluir: event_key:{eventKey}, stage:{stage}, actor:{actor}, service:{service}, todas as tags da linha, e "source:odd".',
    `- dashboardTitle deve ser exatamente: ${JSON.stringify(dashboardTitle)}`,
    '- Não invente linhas nem omita nenhuma. Cada linha de entrada deve aparecer como exatamente um widget e um customEvent.',
    '',
    'Linhas de entrada:',
    JSON.stringify(rows, null, 2),
    '',
    'Responda APENAS com o JSON do DashboardPlan.'
  ].join('\n');
}

function buildTerraformPrompt(plan: DashboardPlan): string {
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

async function callOllama(prompt: string, format: Record<string, unknown>): Promise<unknown> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL ?? 'qwen2.5-coder';

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false, format })
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as { response?: string };
  return JSON.parse(data.response ?? '{}');
}

function validateDashboardPlan(obj: unknown, inputRows: EventStormingRow[]): asserts obj is DashboardPlan {
  if (!obj || typeof obj !== 'object') throw new Error('LLM returned non-object');
  const plan = obj as Record<string, unknown>;

  if (typeof plan.dashboardTitle !== 'string') throw new Error('Missing dashboardTitle');
  if (!Array.isArray(plan.groups)) throw new Error('Missing groups array');
  if (!Array.isArray(plan.customEvents)) throw new Error('Missing customEvents array');

  const inputKeys = new Set(inputRows.map(r => r.eventKey));
  const seenWidgetKeys = new Set<string>();
  const seenEventKeys = new Set<string>();

  for (const group of plan.groups) {
    const g = group as Record<string, unknown>;
    if (typeof g.stage !== 'string' || typeof g.title !== 'string') throw new Error('Invalid group structure');
    if (!Array.isArray(g.widgets)) throw new Error('Missing widgets array in group');
    for (const w of g.widgets as Record<string, unknown>[]) {
      if (typeof w.id !== 'string' || !inputKeys.has(w.id)) throw new Error(`Unknown widget id: ${w.id}`);
      if (w.widgetType !== 'event_stream' && w.widgetType !== 'note') throw new Error(`Invalid widgetType: ${w.widgetType}`);
      if (typeof w.title !== 'string' || typeof w.query !== 'string') throw new Error('Invalid widget fields');
      if (typeof w.stage !== 'string') throw new Error('Missing widget stage');
      seenWidgetKeys.add(w.id);
    }
  }

  for (const evt of plan.customEvents) {
    const e = evt as Record<string, unknown>;
    if (typeof e.title !== 'string' || typeof e.text !== 'string') throw new Error('Invalid customEvent fields');
    if (!Array.isArray(e.tags)) throw new Error('Missing customEvent tags');
    if (!(e.tags as string[]).includes('source:odd')) throw new Error('Missing source:odd tag');
    seenEventKeys.add(e.title);
  }

  for (const key of inputKeys) {
    if (!seenWidgetKeys.has(key)) throw new Error(`Missing widget for eventKey: ${key}`);
    if (!seenEventKeys.has(key)) throw new Error(`Missing customEvent for eventKey: ${key}`);
  }
}

function validateTerraformJson(obj: unknown): asserts obj is Record<string, unknown> {
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

export async function generateDashboardPlan(
  rows: EventStormingRow[],
  dashboardTitle: string
): Promise<DashboardPlan> {
  const result = await callOllama(buildPlanPrompt(rows, dashboardTitle), dashboardPlanFormat);
  validateDashboardPlan(result, rows);
  return result;
}

export async function generateTerraformJson(
  plan: DashboardPlan
): Promise<Record<string, unknown>> {
  const result = await callOllama(buildTerraformPrompt(plan), terraformFormat);
  validateTerraformJson(result);
  return result;
}
