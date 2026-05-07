import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { CustomEventPayload } from '../../shared/types.js';

export type DynatraceEventIngestionResult = {
  title: string;
  status: 'sent' | 'dry-run' | 'failed';
  response?: unknown;
  error?: string;
};

type DynatraceBizEventIngest = Record<string, string | number | boolean>;

type DynatraceAuth = {
  header: string;
  source: string;
};

type DynatraceIngestionOptions = {
  payloadFile?: string;
};

function tagValue(tags: string[], prefix: string): string | undefined {
  return tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length);
}

function resolveManagementZone(event: CustomEventPayload): string | undefined {
  return tagValue(event.tags, 'dynatrace.management_zone:') ?? process.env.DYNATRACE_MANAGEMENT_ZONE;
}

export async function readEvents(filePath: string): Promise<CustomEventPayload[]> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as CustomEventPayload[];
}

export async function ingestEvents(
  filePath: string,
  dryRun: boolean,
  options: DynatraceIngestionOptions = {}
): Promise<DynatraceEventIngestionResult[]> {
  const events = await readEvents(filePath);
  const payload = events.map(toDynatraceBizEventPayload);
  if (options.payloadFile) {
    await writeFile(options.payloadFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  }

  if (dryRun) {
    return events.map((event) => ({ title: event.title, status: 'dry-run' }));
  }

  const results: DynatraceEventIngestionResult[] = [];
  for (const batch of chunkEvents(payload, resolveBatchSize())) {
    try {
      const response = await sendEventsBatch(batch);
      results.push(...batch.map((event) => ({ title: String(event['event.type']), status: 'sent' as const, response })));
    } catch (error) {
      results.push(...batch.map((event) => ({
        title: String(event['event.type']),
        status: 'failed' as const,
        error: error instanceof Error ? error.message : String(error)
      })));
    }
  }

  return results;
}

function resolveBatchSize(): number {
  const parsed = Number.parseInt(process.env.DYNATRACE_BIZEVENTS_BATCH_SIZE ?? '100', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}

function chunkEvents(events: DynatraceBizEventIngest[], batchSize: number): DynatraceBizEventIngest[][] {
  const chunks: DynatraceBizEventIngest[][] = [];
  for (let index = 0; index < events.length; index += batchSize) {
    chunks.push(events.slice(index, index + batchSize));
  }
  return chunks;
}

function appendTagFields(payload: DynatraceBizEventIngest, event: CustomEventPayload): void {
  for (const tag of event.tags) {
    const [key, ...rest] = tag.split(':');
    if (!key || rest.length === 0) continue;
    payload[`odd.tag.${key}`] = rest.join(':');
  }
}

function toDynatraceBizEventPayload(event: CustomEventPayload): DynatraceBizEventIngest {
  const isError = event.alert_type === 'error' || event.tags.includes('exception:true') || event.tags.includes('outcome:problem');
  const provider = process.env.DYNATRACE_BIZEVENT_PROVIDER || 'odd-orchestration-v2';
  const payload: DynatraceBizEventIngest = {
    'event.id': randomUUID(),
    'event.provider': provider,
    'event.type': event.title,
    title: event.title,
    text: event.text,
    'odd.alert_type': event.alert_type ?? (isError ? 'error' : 'info'),
    'odd.is_error': isError,
    'odd.source': 'odd'
  };

  if (event.priority) {
    payload['odd.priority'] = event.priority;
  }
  if (event.aggregation_key) {
    payload['odd.aggregation_key'] = event.aggregation_key;
  }
  if (event.source_type_name) {
    payload['odd.source_type_name'] = event.source_type_name;
  }

  const managementZone = resolveManagementZone(event);
  if (managementZone) {
    payload['odd.management_zone'] = managementZone;
  }

  appendTagFields(payload, event);
  return payload;
}

function resolveAuth(): DynatraceAuth | undefined {
  const apiToken = process.env.DYNATRACE_BIZEVENTS_TOKEN ?? process.env.DYNATRACE_API_TOKEN;
  if (apiToken) {
    return {
      header: `Api-Token ${apiToken}`,
      source: process.env.DYNATRACE_BIZEVENTS_TOKEN ? 'DYNATRACE_BIZEVENTS_TOKEN' : 'DYNATRACE_API_TOKEN'
    };
  }

  const bearerToken = process.env.DYNATRACE_BIZEVENTS_BEARER_TOKEN ?? process.env.DYNATRACE_OAUTH_TOKEN;
  if (bearerToken) {
    return {
      header: `Bearer ${bearerToken}`,
      source: process.env.DYNATRACE_BIZEVENTS_BEARER_TOKEN ? 'DYNATRACE_BIZEVENTS_BEARER_TOKEN' : 'DYNATRACE_OAUTH_TOKEN'
    };
  }

  return undefined;
}

function buildDynatraceError(status: number, responseText: string, titles: string, authSource: string): Error {
  const scopeHint = status === 403 && responseText.includes('bizevents.ingest')
    ? ` O token em ${authSource} nao tem o scope "bizevents.ingest"; use um token especifico em DYNATRACE_BIZEVENTS_TOKEN ou DYNATRACE_BIZEVENTS_BEARER_TOKEN com esse scope.`
    : '';
  return new Error(`Erro ao enviar batch de Business Events para Dynatrace (${titles}): ${status} ${responseText}.${scopeHint}`);
}

async function sendEventsBatch(payload: DynatraceBizEventIngest[]): Promise<unknown> {
  const envUrl = process.env.DYNATRACE_ENV_URL;
  const auth = resolveAuth();

  if (!envUrl || !auth) {
    throw new Error('DYNATRACE_ENV_URL e DYNATRACE_BIZEVENTS_TOKEN, DYNATRACE_BIZEVENTS_BEARER_TOKEN ou DYNATRACE_API_TOKEN sao obrigatorios para ingestao real de Business Events no Dynatrace.');
  }

  const endpoint = process.env.DYNATRACE_BIZEVENTS_INGEST_URL
    ?? `${envUrl.replace(/\/+$/, '')}/api/v2/bizevents/ingest`;
  console.info([
    `================ DYNATRACE BIZEVENT BATCH PAYLOAD (${payload.length}) ================`,
    JSON.stringify(payload, null, 2),
    '===================================================================='
  ].join('\n'));

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: auth.header
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const titles = payload.map((event) => String(event['event.type'])).join(', ');
    throw buildDynatraceError(response.status, await response.text(), titles, auth.source);
  }

  const responseText = await response.text();
  return responseText ? JSON.parse(responseText) : { status: response.status };
}
