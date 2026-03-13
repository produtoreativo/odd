import { readFile } from 'node:fs/promises';
import { CustomEventPayload } from '../../shared/types.js';

export type EventIngestionResult = {
  title: string;
  status: 'sent' | 'dry-run' | 'failed';
  response?: unknown;
  error?: string;
};

export async function readEvents(filePath: string): Promise<CustomEventPayload[]> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as CustomEventPayload[];
}

export async function ingestEvents(filePath: string, dryRun: boolean): Promise<EventIngestionResult[]> {
  const events = await readEvents(filePath);
  const batchSize = resolveBatchSize();

  if (dryRun) {
    return events.map((event) => ({ title: event.title, status: 'dry-run' }));
  }

  const results: EventIngestionResult[] = [];
  for (let i = 0; i < events.length; i += batchSize) {
    const chunk = events.slice(i, i + batchSize);
    const chunkResults = await Promise.all(
      chunk.map(async (event) => {
        try {
          const response = await sendEvent(event);
          return { title: event.title, status: 'sent', response } as EventIngestionResult;
        } catch (error) {
          return {
            title: event.title,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error)
          } as EventIngestionResult;
        }
      })
    );
    results.push(...chunkResults);
  }

  return results;
}

function resolveBatchSize(): number {
  const raw = process.env.DD_EVENT_BATCH_SIZE;
  if (!raw) {
    return 10;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 10;
  }

  return parsed;
}

async function sendEvent(event: CustomEventPayload): Promise<unknown> {
  const apiKey = process.env.DD_API_KEY;
  const appKey = process.env.DD_APP_KEY;
  const site = process.env.DD_SITE ?? 'datadoghq.com';
  const baseUrl = process.env.DD_API_BASE_URL ?? `https://api.${site}`;

  if (!apiKey || !appKey) {
    throw new Error('DD_API_KEY e DD_APP_KEY são obrigatórios para ingestão real.');
  }

  const response = await fetch(`${baseUrl}/api/v1/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DD-API-KEY': apiKey,
      'DD-APPLICATION-KEY': appKey
    },
    body: JSON.stringify(event)
  });

  if (!response.ok) {
    throw new Error(`Erro ao enviar evento ${event.title}: ${response.status} ${await response.text()}`);
  }

  return response.json();
}
