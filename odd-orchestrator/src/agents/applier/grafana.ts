import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { CustomEventPayload } from '../../shared/types.js';

const RATE_LIMIT_DELAY_MS = 500;

export type GrafanaAnnotationResult = {
  title: string;
  status: 'sent' | 'dry-run' | 'failed';
  response?: unknown;
  error?: string;
};

type GrafanaAnnotation = {
  time: number;
  tags: string[];
  text: string;
};

function toAnnotation(event: CustomEventPayload): GrafanaAnnotation {
  return {
    time: Date.now(),
    tags: [...event.tags, 'source:odd'],
    text: `${event.title}: ${event.text}`
  };
}

export async function readEvents(filePath: string): Promise<CustomEventPayload[]> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as CustomEventPayload[];
}

export async function ingestEvents(filePath: string, dryRun: boolean): Promise<GrafanaAnnotationResult[]> {
  const events = await readEvents(filePath);

  if (dryRun) {
    return events.map((event) => ({ title: event.title, status: 'dry-run' }));
  }

  const results: GrafanaAnnotationResult[] = [];
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (i > 0) await sleep(RATE_LIMIT_DELAY_MS);
    try {
      const response = await sendAnnotation(event);
      results.push({ title: event.title, status: 'sent', response });
    } catch (error) {
      results.push({
        title: event.title,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return results;
}

async function sendAnnotation(event: CustomEventPayload): Promise<unknown> {
  const url = process.env.GRAFANA_URL;
  const auth = process.env.GRAFANA_AUTH;

  if (!url || !auth) {
    throw new Error('GRAFANA_URL e GRAFANA_AUTH são obrigatórios para ingestão real no Grafana.');
  }

  const annotation = toAnnotation(event);
  const response = await fetch(`${url.replace(/\/+$/, '')}/api/annotations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth}`
    },
    body: JSON.stringify(annotation)
  });

  if (!response.ok) {
    throw new Error(`Erro ao enviar anotação ${event.title} para Grafana: ${response.status} ${await response.text()}`);
  }

  return response.json();
}
