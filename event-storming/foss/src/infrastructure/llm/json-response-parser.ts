import { Logger } from '../../shared/logger.js';

const logger = new Logger('json-response-parser');

export function parseJsonResponse(content: unknown): unknown {
  const raw = Array.isArray(content)
    ? content
        .map((part) => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object' && 'text' in part) {
            return String((part as { text?: unknown }).text ?? '');
          }
          return '';
        })
        .join('\n')
    : String(content ?? '');

  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? trimmed;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  const jsonText = firstBrace >= 0 && lastBrace > firstBrace
    ? candidate.slice(firstBrace, lastBrace + 1)
    : candidate;

  logger.debug('Extraindo JSON da resposta do modelo', {
    rawLength: raw.length,
    jsonLength: jsonText.length,
    fenced: Boolean(fenced)
  });

  return JSON.parse(jsonText);
}
