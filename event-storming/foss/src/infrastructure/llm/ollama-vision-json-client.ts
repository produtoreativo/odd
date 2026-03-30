import { readFileSync } from 'node:fs';
import { Logger } from '../../shared/logger.js';

const logger = new Logger('ollama-vision-json-client');

export async function invokeOllamaVisionJson(
  model: string,
  imagePath: string,
  prompt: string
): Promise<unknown> {
  const baseUrl = (process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434').replace('://localhost:', '://127.0.0.1:');
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/generate`;
  const imageBuffer = readFileSync(imagePath);

  const body = {
    model,
    prompt,
    stream: false,
    images: [imageBuffer.toString('base64')],
    options: {
      temperature: 0
    }
  };

  logger.info('Invocando Ollama vision por endpoint generate', {
    endpoint,
    model,
    imagePath
  });

  let response: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      logger.info('Tentativa de chamada ao Ollama vision', { attempt, model });
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      break;
    } catch (error) {
      lastError = error;
      logger.warn('Falha transitória ao chamar Ollama vision', {
        attempt,
        model,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (!response) {
    throw new Error(
      `Falha ao chamar Ollama vision após retry: ${lastError instanceof Error ? lastError.message : String(lastError)}`
    );
  }

  if (!response.ok) {
    throw new Error(`Ollama vision retornou ${response.status}: ${await response.text()}`);
  }

  const data = await response.json() as { response?: string };
  if (!data.response || data.response.trim() === '') {
    throw new Error('Ollama vision retornou resposta vazia.');
  }

  return data.response;
}
