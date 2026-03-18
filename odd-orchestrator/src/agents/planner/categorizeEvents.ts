import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { EventStormingRow, CategorizedEvents } from '../../shared/types.js';
import { LlmExecutor } from '../../shared/llm/index.js';

const PROBLEM_KEYWORDS = [
  'error', 'fail', 'failed', 'failure', 'reject', 'rejected', 'timeout', 'alert', 'warning', 'issue', 'problem',
  'falha', 'erro', 'rejeitado', 'alerta', 'problema', 'tentativa', 'exception', 'exceptional', 'invalid', 'denied',
  'unavailable', 'expired', 'cancelled', 'canceled', 'rollback', 'abort', 'aborted'
];

const NORMAL_KEYWORDS = [
  'success', 'complete', 'completed', 'approved', 'created', 'added', 'formed', 'requested', 'started', 'finished',
  'sucesso', 'completo', 'aprovado', 'criado', 'adicionado', 'formado', 'solicitado', 'iniciado', 'concluido',
  'concluído', 'confirmado'
];

const STRONG_PROBLEM_SIGNALS = [
  'exception',
  '_exception',
  'exception:true',
  'outcome:problem',
  'event_type:exception',
  'error',
  'fail',
  'failure',
  'reject',
  'timeout',
  'falha',
  'erro'
];

const responseFormat = {
  type: 'object',
  properties: {
    problems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ordem: { type: 'number' },
          eventKey: { type: 'string' },
          eventTitle: { type: 'string' },
          stage: { type: 'string' },
          actor: { type: 'string' },
          service: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          dashboardWidget: { type: 'string', enum: ['event_stream', 'note', 'query_value', 'timeseries'] },
          queryHint: { type: 'string' }
        },
        required: ['ordem', 'eventKey', 'eventTitle', 'stage', 'actor', 'service', 'tags', 'dashboardWidget', 'queryHint']
      }
    },
    normal: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ordem: { type: 'number' },
          eventKey: { type: 'string' },
          eventTitle: { type: 'string' },
          stage: { type: 'string' },
          actor: { type: 'string' },
          service: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          dashboardWidget: { type: 'string', enum: ['event_stream', 'note', 'query_value', 'timeseries'] },
          queryHint: { type: 'string' }
        },
        required: ['ordem', 'eventKey', 'eventTitle', 'stage', 'actor', 'service', 'tags', 'dashboardWidget', 'queryHint']
      }
    }
  },
  required: ['problems', 'normal']
};

const promptTemplatePath = path.join(__dirname, 'categorizeEvents.prompt.md');
let promptTemplatePromise: Promise<string> | null = null;

async function loadPromptTemplate(): Promise<string> {
  if (!promptTemplatePromise) {
    promptTemplatePromise = readFile(promptTemplatePath, 'utf-8');
  }
  return promptTemplatePromise;
}

async function buildPrompt(rows: EventStormingRow[]): Promise<string> {
  const template = await loadPromptTemplate();
  return template.replaceAll('{{EVENT_STORMING_ROWS_JSON}}', JSON.stringify(rows, null, 2));
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function coerceCategorizedRows(candidateRows: unknown[], inputRows: EventStormingRow[]): EventStormingRow[] {
  const byEventKey = new Map(inputRows.map((row) => [normalizeKey(row.eventKey), row] as const));
  const byOrder = new Map(inputRows.map((row) => [row.ordem, row] as const));
  const byTitleStage = new Map(
    inputRows.map((row) => [`${normalizeKey(row.eventTitle)}|${normalizeKey(row.stage)}`, row] as const)
  );

  return candidateRows.map((event) => {
    const e = event as Record<string, unknown>;
    const eventKey = typeof e.eventKey === 'string' ? normalizeKey(e.eventKey) : '';
    const order = typeof e.ordem === 'number' ? e.ordem : Number.NaN;
    const title = typeof e.eventTitle === 'string' ? normalizeKey(e.eventTitle) : '';
    const stage = typeof e.stage === 'string' ? normalizeKey(e.stage) : '';

    const direct = byEventKey.get(eventKey);
    if (direct) return direct;

    if (Number.isFinite(order)) {
      const byOrderMatch = byOrder.get(order);
      if (byOrderMatch) return byOrderMatch;
    }

    const byTitleStageMatch = byTitleStage.get(`${title}|${stage}`);
    if (byTitleStageMatch) return byTitleStageMatch;

    throw new Error(`Unknown eventKey in result: ${String(e.eventKey ?? '')}`);
  });
}

function coerceCategorizationResult(obj: unknown, inputRows: EventStormingRow[]): CategorizedEvents {
  if (!obj || typeof obj !== 'object') throw new Error('LLM returned non-object');
  const result = obj as Record<string, unknown>;

  if (!Array.isArray(result.problems)) throw new Error('Missing problems array');
  if (!Array.isArray(result.normal)) throw new Error('Missing normal array');

  return {
    problems: coerceCategorizedRows(result.problems, inputRows),
    normal: coerceCategorizedRows(result.normal, inputRows)
  };
}

function validate(obj: unknown, inputRows: EventStormingRow[]): asserts obj is CategorizedEvents {
  if (!obj || typeof obj !== 'object') throw new Error('LLM returned non-object');
  const result = obj as Record<string, unknown>;

  if (!Array.isArray(result.problems)) throw new Error('Missing problems array');
  if (!Array.isArray(result.normal)) throw new Error('Missing normal array');

  const inputKeys = new Set(inputRows.map(r => r.eventKey));
  const seenKeys = new Set<string>();

  for (const event of [...result.problems, ...result.normal]) {
    const e = event as Record<string, unknown>;
    if (typeof e.eventKey !== 'string') throw new Error('Invalid eventKey in categorized event');
    if (!inputKeys.has(e.eventKey)) throw new Error(`Unknown eventKey in result: ${e.eventKey}`);
    if (seenKeys.has(e.eventKey)) throw new Error(`Duplicate eventKey: ${e.eventKey}`);
    seenKeys.add(e.eventKey);
  }

  for (const key of inputKeys) {
    if (!seenKeys.has(key)) throw new Error(`Missing eventKey in categorization: ${key}`);
  }
}

function scoreByKeywords(row: EventStormingRow): { problemScore: number; normalScore: number } {
  const haystack = `${row.eventKey} ${row.eventTitle} ${row.stage} ${row.tags.join(' ')} ${row.queryHint}`.toLowerCase();
  let problemScore = 0;
  let normalScore = 0;

  for (const keyword of PROBLEM_KEYWORDS) {
    if (haystack.includes(keyword)) problemScore += 1;
  }

  for (const keyword of NORMAL_KEYWORDS) {
    if (haystack.includes(keyword)) normalScore += 1;
  }

  return { problemScore, normalScore };
}

function hasStrongProblemSignal(row: EventStormingRow): boolean {
  const haystack = `${row.eventKey} ${row.eventTitle} ${row.stage} ${row.tags.join(' ')} ${row.queryHint}`.toLowerCase();
  return STRONG_PROBLEM_SIGNALS.some((signal) => haystack.includes(signal));
}

function normalizeCategorization(result: CategorizedEvents, inputRows: EventStormingRow[]): CategorizedEvents {
  const originalProblems = new Set(result.problems.map((row) => row.eventKey));
  const normalizedProblems: EventStormingRow[] = [];
  const normalizedNormal: EventStormingRow[] = [];

  for (const row of inputRows.slice().sort((left, right) => left.ordem - right.ordem)) {
    const { problemScore, normalScore } = scoreByKeywords(row);
    const strongProblemSignal = hasStrongProblemSignal(row);
    if (strongProblemSignal) {
      normalizedProblems.push(row);
      continue;
    }

    const forcedProblem = problemScore > 0 && problemScore >= normalScore;
    const forcedNormal = normalScore > 0 && normalScore > problemScore;
    const isProblem = forcedProblem || (!forcedNormal && originalProblems.has(row.eventKey));

    if (isProblem) {
      normalizedProblems.push(row);
    } else {
      normalizedNormal.push(row);
    }
  }

  return {
    problems: normalizedProblems,
    normal: normalizedNormal
  };
}

export async function categorizeEvents(llm: LlmExecutor, rows: EventStormingRow[]): Promise<CategorizedEvents> {
  const prompt = await buildPrompt(rows);
  const rawResult = await llm.call(prompt, responseFormat);
  const result = coerceCategorizationResult(rawResult, rows);
  validate(result, rows);
  const normalized = normalizeCategorization(result, rows);
  validate(normalized, rows);
  return normalized;
}
