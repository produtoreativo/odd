import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { LlmExecutor, JsonSchema } from './executor.js';
import { ensureDir } from '../fs.js';

export class Ollama extends LlmExecutor {
  private baseUrl: string;

  constructor(model: string, baseUrl?: string) {
    super(model);
    this.baseUrl = normalizeOllamaBaseUrl(baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434');
  }

  async call(prompt: string, format: JsonSchema): Promise<unknown> {
    const endpoint = `${this.baseUrl}/api/generate`;
    const body = { model: this.model, prompt, stream: false, format };
    const debugFile = await writeDebugRequest(body);
    console.log(`[ollama] endpoint=${endpoint} model=${this.model}`);
    console.log(`[ollama] debug_payload=${debugFile}`);
    console.log(`[ollama] curl -fsS ${endpoint} -H 'Content-Type: application/json' --data @${debugFile}`);
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Falha ao chamar Ollama em ${endpoint} com model=${this.model}: ${message}`);
    }

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}: ${response.statusText} at ${endpoint} with model=${this.model}`);
    }

    const data = (await response.json()) as { response?: string };
    return JSON.parse(data.response ?? '{}');
  }
}

function normalizeOllamaBaseUrl(baseUrl: string): string {
  return baseUrl.replace('://localhost:', '://127.0.0.1:');
}

async function writeDebugRequest(body: unknown): Promise<string> {
  const dir = path.join(process.cwd(), 'generated', 'ollama');
  await ensureDir(dir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(dir, `request-${timestamp}.json`);
  await writeFile(filePath, `${JSON.stringify(body, null, 2)}\n`, 'utf-8');
  return filePath;
}
