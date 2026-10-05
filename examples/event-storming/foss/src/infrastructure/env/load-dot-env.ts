import { existsSync, readFileSync } from 'node:fs';
import { Logger } from '../../shared/logger.js';

const logger = new Logger('env');

export function loadDotEnv(filePath = '.env'): void {
  if (!existsSync(filePath)) {
    logger.debug('Arquivo .env não encontrado; seguindo com variáveis já carregadas', { filePath });
    return;
  }

  logger.info('Carregando variáveis de ambiente', { filePath });
  const content = readFileSync(filePath, 'utf-8');

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator <= 0) {
      logger.debug('Linha ignorada durante carga do .env', { line: trimmed });
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith('\'') && value.endsWith('\''))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
      logger.debug('Variável carregada do .env', { key });
    }
  }
}
