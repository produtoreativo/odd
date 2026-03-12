import { DashboardPlan, EventStormingRow } from '../../shared/types.js';
import { callOllama } from './ollama.js';

const responseFormat = {
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

function buildPrompt(rows: EventStormingRow[], dashboardTitle: string): string {
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

function validate(obj: unknown, inputRows: EventStormingRow[]): asserts obj is DashboardPlan {
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

export async function buildDashboardPlan(rows: EventStormingRow[], dashboardTitle: string): Promise<DashboardPlan> {
  const result = await callOllama(buildPrompt(rows, dashboardTitle), responseFormat);
  validate(result, rows);
  return result;
}
