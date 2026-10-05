import path from 'node:path';
import { writeJsonFile, writeTextFile } from '../../infrastructure/filesystem/file-system.js';
import { extractRawResponseText } from '../../infrastructure/llm/json-response-parser.js';

export async function persistStageJson(outputDir: string, fileName: string, payload: unknown): Promise<void> {
  await writeJsonFile(path.join(outputDir, fileName), payload);
}

export async function persistRawResponse(
  outputDir: string,
  stagePrefix: string,
  attempt: number,
  payload: unknown
): Promise<void> {
  const filePath = path.join(outputDir, `${stagePrefix}.attempt-${attempt}.raw.txt`);
  await writeTextFile(filePath, `${extractRawResponseText(payload)}\n`);
}
