import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { EventStormingRow, CategorizedEvents } from '../../shared/types.js';
import { LlmExecutor } from '../../shared/llm/index.js';

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

export async function categorizeEvents(llm: LlmExecutor, rows: EventStormingRow[]): Promise<CategorizedEvents> {
  const prompt = await buildPrompt(rows);
  const result = await llm.call(prompt, responseFormat);
  validate(result, rows);
  return result as CategorizedEvents;
}
