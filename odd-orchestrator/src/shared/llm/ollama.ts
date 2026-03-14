import { LlmExecutor, JsonSchema } from './executor.js';

export class Ollama extends LlmExecutor {
  private baseUrl: string;

  constructor(model: string, baseUrl?: string) {
    super(model);
    this.baseUrl = baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  }

  async call(prompt: string, format: JsonSchema): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt, stream: false, format })
    });

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as { response?: string };
    return JSON.parse(data.response ?? '{}');
  }
}
