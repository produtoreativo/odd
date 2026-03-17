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

function normalizeCategorization(result: CategorizedEvents, inputRows: EventStormingRow[]): CategorizedEvents {
  const originalProblems = new Set(result.problems.map((row) => row.eventKey));
  const normalizedProblems: EventStormingRow[] = [];
  const normalizedNormal: EventStormingRow[] = [];

  for (const row of inputRows.slice().sort((left, right) => left.ordem - right.ordem)) {
    const { problemScore, normalScore } = scoreByKeywords(row);
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
  const result = await llm.call(prompt, responseFormat);
  validate(result, rows);
  const normalized = normalizeCategorization(result as CategorizedEvents, rows);
  validate(normalized, rows);
  return normalized;
}
