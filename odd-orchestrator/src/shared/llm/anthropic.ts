import { LlmExecutor, JsonSchema } from './executor.js';

export class Anthropic extends LlmExecutor {
  private baseUrl: string;
  private apiKey: string;
  private maxTokens: number;

  constructor(model: string, apiKey?: string, baseUrl?: string, maxTokens?: number) {
    super(model);
    this.baseUrl = (baseUrl ?? process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com').replace(/\/$/, '');
    this.apiKey = apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
    this.maxTokens = maxTokens ?? parseInt(process.env.ANTHROPIC_MAX_TOKENS ?? '8192', 10);

    if (!this.apiKey) {
      throw new Error('apiKey is required for Anthropic (pass it or set ANTHROPIC_API_KEY)');
    }
  }

  async call(prompt: string, format: JsonSchema): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        tools: [{
          name: 'structured_output',
          description: 'Return the result as structured JSON matching the provided schema.',
          input_schema: format
        }],
        tool_choice: { type: 'tool', name: 'structured_output' },
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic returned ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      content?: { type: string; input?: unknown }[];
    };

    const toolBlock = data.content?.find(b => b.type === 'tool_use');
    if (!toolBlock?.input) {
      throw new Error('Anthropic response did not contain a tool_use block');
    }

    return toolBlock.input;
  }
}
