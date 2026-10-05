import { LlmExecutor, JsonSchema } from './executor.js';

function addAdditionalPropertiesFalse(schema: JsonSchema): JsonSchema {
  const result = { ...schema };
  if (result.type === 'object') {
    result.additionalProperties = false;
    if (result.properties && typeof result.properties === 'object') {
      const patched: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(result.properties as Record<string, unknown>)) {
        patched[key] = typeof value === 'object' && value !== null
          ? addAdditionalPropertiesFalse(value as JsonSchema)
          : value;
      }
      result.properties = patched;
    }
  }
  if (result.items && typeof result.items === 'object') {
    result.items = addAdditionalPropertiesFalse(result.items as JsonSchema);
  }
  return result;
}

export class OpenAi extends LlmExecutor {
  private baseUrl: string;
  private apiKey: string;

  constructor(model: string, apiKey?: string, baseUrl?: string) {
    super(model);
    this.baseUrl = (baseUrl ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.apiKey = apiKey ?? process.env.OPENAI_API_KEY ?? '';

    if (!this.apiKey) {
      throw new Error('apiKey is required for OpenAi (pass it or set OPENAI_API_KEY)');
    }
  }

  async call(prompt: string, format: JsonSchema): Promise<unknown> {
    const strictSchema = addAdditionalPropertiesFalse(format);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'response', strict: true, schema: strictSchema }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI returned ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content = data.choices?.[0]?.message?.content ?? '{}';
    return JSON.parse(content);
  }
}
