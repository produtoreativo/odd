import { readFile } from 'node:fs/promises';
import { CustomEventPayload } from '../../shared/types.js';

export type EventIngestionResult = {
  title: string;
  status: 'sent' | 'dry-run';
  response?: unknown;
};

export async function readEvents(filePath: string): Promise<CustomEventPayload[]> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as CustomEventPayload[];
}

export async function ingestEvents(filePath: string, dryRun: boolean): Promise<EventIngestionResult[]> {
  const events = await readEvents(filePath);
  const results: EventIngestionResult[] = [];

  for (const event of events) {
    if (dryRun) {
      results.push({ title: event.title, status: 'dry-run' });
      continue;
    }

    const response = await sendEvent(event);
    results.push({ title: event.title, status: 'sent', response });
  }

  return results;
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
