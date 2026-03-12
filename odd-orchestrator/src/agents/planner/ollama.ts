export async function suggestStageTitle(stage: string): Promise<string> {
  const enabled = process.env.OLLAMA_ENABLED === 'true';
  if (!enabled) {
    return toDisplayTitle(stage);
  }

  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL ?? 'qwen2.5-coder';

  const payload = {
    model,
    prompt: [
      'Você é especialista em DataDog Dashboard.',
      'Receba um stage de Event Storming e responda apenas com um título curto em português.',
      `stage: ${stage}`
    ].join('\n'),
    stream: false,
    format: {
      type: 'object',
      properties: {
        title: { type: 'string' }
      },
      required: ['title']
    }
  };

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return toDisplayTitle(stage);
    }

    const data = (await response.json()) as { response?: string };
    const parsed = JSON.parse(data.response ?? '{}') as { title?: string };
    return parsed.title?.trim() || toDisplayTitle(stage);
  } catch {
    return toDisplayTitle(stage);
  }
}

function toDisplayTitle(stage: string): string {
  return stage
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
