import { readFile } from 'node:fs/promises';
import { CustomEventPayload } from '../../shared/types.js';

export type GrafanaEventIngestionResult = {
  title: string;
  status: 'sent' | 'dry-run' | 'failed';
  response?: string;
  error?: string;
};

function tagValue(tags: string[], prefix: string): string | undefined {
  return tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length);
}

function escapeInfluxValue(value: string): string {
  return value.replace(/[ ,=\\]/g, (ch) => `\\${ch}`);
}

function toInfluxLine(event: CustomEventPayload): string {
  const labels: Record<string, string> = {
    event_key: tagValue(event.tags, 'event_key:') ?? event.title,
    stage: tagValue(event.tags, 'stage:') ?? 'unknown',
    outcome: tagValue(event.tags, 'outcome:') ?? 'unknown',
    service: tagValue(event.tags, 'service:') ?? 'unknown',
    source: 'odd'
  };

  const tagString = Object.entries(labels)
    .map(([k, v]) => `${k}=${escapeInfluxValue(v)}`)
    .join(',');

  const timestampNs = (BigInt(Date.now()) * 1_000_000n).toString();
  return `odd_event_total,${tagString} value=1 ${timestampNs}`;
}

export async function readEvents(filePath: string): Promise<CustomEventPayload[]> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as CustomEventPayload[];
}

export async function ingestEvents(filePath: string, dryRun: boolean): Promise<GrafanaEventIngestionResult[]> {
  const events = await readEvents(filePath);

  if (dryRun) {
    return events.map((event) => ({ title: event.title, status: 'dry-run' }));
  }

  const metricsUrl = process.env.GRAFANA_METRICS_URL;
  const metricsUser = process.env.GRAFANA_METRICS_USER;
  const metricsToken = process.env.GRAFANA_METRICS_TOKEN ?? process.env.GRAFANA_AUTH;

  if (!metricsUrl || !metricsUser || !metricsToken) {
    throw new Error('GRAFANA_METRICS_URL, GRAFANA_METRICS_USER e GRAFANA_METRICS_TOKEN são obrigatórios para ingestão de métricas no Grafana Cloud.');
  }

  const lines = events.map(toInfluxLine);
  const body = lines.join('\n');

  const endpoint = `${metricsUrl.replace(/\/+$/, '')}/api/v1/push/influx/write`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      Authorization: `Basic ${Buffer.from(`${metricsUser}:${metricsToken}`).toString('base64')}`
    },
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    return events.map((event) => ({
      title: event.title,
      status: 'failed',
      error: `Erro ao enviar métricas para Grafana: ${response.status} ${errorText}`
    }));
  }

  return events.map((event) => ({
    title: event.title,
    status: 'sent',
    response: 'metrics pushed via influx line protocol'
  }));
}
