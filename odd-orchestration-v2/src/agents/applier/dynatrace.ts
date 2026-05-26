import { readFile, writeFile } from 'node:fs/promises';
import { CustomEventPayload } from '../../shared/types.js';
import {
  CloudEventV1,
  DynatraceBizEvent,
  translateCloudEventsToDynatrace
} from '../../infrastructure/observability/cloud-events/index.js';
import { encodeCustomEvent } from '../../infrastructure/observability/cloud-events/encoder.js';
import { normalizeEnv } from '../../shared/query-hint.js';

export type DynatraceEventIngestionResult = {
  title: string;
  status: 'sent' | 'dry-run' | 'failed';
  response?: unknown;
  error?: string;
};

type DynatraceAuth = {
  header: string;
  source: string;
};

type DynatraceIngestionOptions = {
  payloadFile?: string;
  dashboardKey?: string;
  env?: string;
};

const CLOUD_EVENT_SOURCE_PREFIX = 'odd:orchestration:v2';

export async function readEvents(filePath: string): Promise<unknown[]> {
  const content = await readFile(filePath, 'utf-8');
  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed)) {
    throw new TypeError(`Arquivo ${filePath} não contém um array.`);
  }
  return parsed;
}

export async function ingestEvents(
  filePath: string,
  dryRun: boolean,
  options: DynatraceIngestionOptions = {}
): Promise<DynatraceEventIngestionResult[]> {
  const raw = await readEvents(filePath);
  const cloudEvents = ensureCloudEvents(raw, options);
  const payload = translateCloudEventsToDynatrace(cloudEvents);

  if (options.payloadFile) {
    await writeFile(options.payloadFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  }

  if (dryRun) {
    return cloudEvents.map((event) => ({ title: event.type, status: 'dry-run' }));
  }

  const results: DynatraceEventIngestionResult[] = [];
  for (const batch of chunkEvents(payload, resolveBatchSize())) {
    try {
      const response = await sendEventsBatch(batch);
      results.push(...batch.map((event) => ({ title: event.type, status: 'sent' as const, response })));
    } catch (error) {
      results.push(...batch.map((event) => ({
        title: event.type,
        status: 'failed' as const,
        error: error instanceof Error ? error.message : String(error)
      })));
    }
  }

  return results;
}

function ensureCloudEvents(
  raw: unknown[],
  options: DynatraceIngestionOptions
): CloudEventV1[] {
  if (raw.length === 0) return [];

  if (isCloudEventArray(raw)) {
    return raw;
  }

  const dashboardKey = options.dashboardKey ?? 'odd-dashboard';
  const env = normalizeEnv(options.env);
  const source = `${CLOUD_EVENT_SOURCE_PREFIX}/${dashboardKey}`;
  return (raw as CustomEventPayload[]).map((event) => encodeCustomEvent(event, {
    dashboardKey,
    env,
    source
  }));
}

function isCloudEventArray(value: unknown[]): value is CloudEventV1[] {
  const first = value[0];
  return typeof first === 'object'
    && first !== null
    && (first as { specversion?: unknown }).specversion === '1.0';
}

function resolveBatchSize(): number {
  const parsed = Number.parseInt(process.env.DYNATRACE_BIZEVENTS_BATCH_SIZE ?? '100', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}

function chunkEvents(events: DynatraceBizEvent[], batchSize: number): DynatraceBizEvent[][] {
  const chunks: DynatraceBizEvent[][] = [];
  for (let index = 0; index < events.length; index += batchSize) {
    chunks.push(events.slice(index, index + batchSize));
  }
  return chunks;
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

async function sendEventsBatch(payload: DynatraceBizEvent[]): Promise<unknown> {
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
      'Content-Type': 'application/cloudevents-batch+json',
      Authorization: auth.header
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const titles = payload.map((event) => event.type).join(', ');
    throw buildDynatraceError(response.status, await response.text(), titles, auth.source);
  }

  const responseText = await response.text();
  return responseText ? JSON.parse(responseText) : { status: response.status };
}

