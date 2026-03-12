import { DashboardPlan, EventStormingRow } from '../../shared/types.js';

export async function suggestStageTitle(stage: string): Promise<string> {
  // const enabled = process.env.OLLAMA_ENABLED === 'true';
  // if (!enabled) {
  //   return toDisplayTitle(stage);
  // }

  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL ?? 'qwen2.5-coder';

  const payload = {
    model,
    prompt: [
      'Você é especialista em DataDog Dashboard.',
      'Receba um stage de Event Storming e responda apenas com um título curto em português.',
      `stage: ${stage}`
    ].join('\n'),
    stream: false,
    format: {
      type: 'object',
      properties: {
        title: { type: 'string' }
      },
      required: ['title']
    }
  };

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return toDisplayTitle(stage);
    }

    const data = (await response.json()) as { response?: string };
    const parsed = JSON.parse(data.response ?? '{}') as { title?: string };
    return parsed.title?.trim() || toDisplayTitle(stage);
  } catch {
    return toDisplayTitle(stage);
  }
}

export function toDisplayTitle(stage: string): string {
  return stage
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

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

function isValidDashboardPlan(obj: unknown, inputRows: EventStormingRow[]): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const plan = obj as Record<string, unknown>;

  if (typeof plan.dashboardTitle !== 'string') return false;
  if (!Array.isArray(plan.groups)) return false;
  if (!Array.isArray(plan.customEvents)) return false;

  const inputKeys = new Set(inputRows.map(r => r.eventKey));
  const seenWidgetKeys = new Set<string>();
  const seenEventKeys = new Set<string>();

  for (const group of plan.groups) {
    const g = group as Record<string, unknown>;
    if (typeof g.stage !== 'string' || typeof g.title !== 'string') return false;
    if (!Array.isArray(g.widgets)) return false;
    for (const w of g.widgets as Record<string, unknown>[]) {
      if (typeof w.id !== 'string' || !inputKeys.has(w.id)) return false;
      if (w.widgetType !== 'event_stream' && w.widgetType !== 'note') return false;
      if (typeof w.title !== 'string' || typeof w.query !== 'string') return false;
      if (typeof w.stage !== 'string') return false;
      seenWidgetKeys.add(w.id);
    }
  }

  for (const evt of plan.customEvents) {
    const e = evt as Record<string, unknown>;
    if (typeof e.title !== 'string' || typeof e.text !== 'string') return false;
    if (!Array.isArray(e.tags)) return false;
    if (!(e.tags as string[]).includes('source:odd')) return false;
    seenEventKeys.add(e.title);
  }

  for (const key of inputKeys) {
    if (!seenWidgetKeys.has(key)) return false;
    if (!seenEventKeys.has(key)) return false;
  }

  return true;
}

export async function generateDashboardPlan(
  rows: EventStormingRow[],
  dashboardTitle: string
): Promise<DashboardPlan | null> {
  // const enabled = process.env.OLLAMA_ENABLED === 'true';
  // if (!enabled) return null;

  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL ?? 'qwen2.5-coder';

  const payload = {
    model,
    prompt: buildPlanPrompt(rows, dashboardTitle),
    stream: false,
    format: dashboardPlanFormat
  };

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { response?: string };
    const parsed = JSON.parse(data.response ?? '{}');

    if (!isValidDashboardPlan(parsed, rows)) return null;
    return parsed as DashboardPlan;
  } catch {
    return null;
  }
}
