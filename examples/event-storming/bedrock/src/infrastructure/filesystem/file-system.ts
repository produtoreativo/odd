import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Logger } from '../../shared/logger.js';

const logger = new Logger('filesystem');

export async function ensureDir(dirPath: string): Promise<void> {
  logger.debug('Garantindo diretório', { dirPath });
  await mkdir(dirPath, { recursive: true });
}

export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  logger.info('Persistindo arquivo JSON', { filePath });
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

export async function writeTextFile(filePath: string, data: string): Promise<void> {
  logger.info('Persistindo arquivo texto', { filePath });
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, data, 'utf-8');
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  logger.info('Lendo arquivo JSON', { filePath });
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}
