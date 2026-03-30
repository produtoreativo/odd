import { Logger } from '../../shared/logger.js';

const logger = new Logger('langsmith-bootstrap');
const DEFAULT_PROJECT = 'event-storming-foss';
const DEFAULT_ENDPOINT = 'https://api.smith.langchain.com';

export function bootstrapLangSmith(): void {
  const hasApiKey = Boolean(process.env.LANGSMITH_API_KEY?.trim());

  if (!hasApiKey) {
    logger.warn('LANGSMITH_API_KEY ausente; tracing do LangSmith permanecerá desabilitado');
    return;
  }

  process.env.LANGSMITH_TRACING = process.env.LANGSMITH_TRACING?.trim() || 'true';
  process.env.LANGSMITH_PROJECT = process.env.LANGSMITH_PROJECT?.trim() || DEFAULT_PROJECT;
  process.env.LANGSMITH_ENDPOINT = process.env.LANGSMITH_ENDPOINT?.trim() || DEFAULT_ENDPOINT;

  logger.info('LangSmith configurado para tracing', {
    tracing: process.env.LANGSMITH_TRACING,
    project: process.env.LANGSMITH_PROJECT,
    endpoint: process.env.LANGSMITH_ENDPOINT
  });
}
