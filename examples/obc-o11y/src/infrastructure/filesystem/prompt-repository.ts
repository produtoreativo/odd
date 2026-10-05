import path from 'node:path';
import { readTextFile } from './file-system.js';

const promptsDir = path.resolve(process.cwd(), 'src/prompts');

export async function renderPrompt(fileName: string): Promise<string> {
  return readTextFile(path.join(promptsDir, fileName));
}
