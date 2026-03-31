import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { Logger } from '../../shared/logger.js';

const logger = new Logger('prompt-repository');

export async function renderPrompt(
  fileName: string,
  values: Record<string, string>
): Promise<string> {
  const promptPath = path.join(process.cwd(), 'src', 'prompts', fileName);
  logger.info('Carregando prompt', { fileName, promptPath });

  let template = await readFile(promptPath, 'utf-8');
  for (const [key, value] of Object.entries(values)) {
    template = template.replaceAll(`{{${key}}}`, value);
  }

  logger.debug('Prompt renderizado', {
    fileName,
    placeholders: Object.keys(values),
    length: template.length
  });

  return template;
}
