import { readFile } from 'node:fs/promises';
import { CustomEventPayload } from '../../shared/types.js';

export type DynatraceEventIngestionResult = {
  title: string;
  status: 'sent' | 'dry-run' | 'failed';
  response?: unknown;
  error?: string;
};

type DynatraceEventIngest = {
  eventType: 'ERROR_EVENT' | 'CUSTOM_INFO';
  title: string;
  timeout: number;
  entitySelector?: string;
  properties: Record<string, string>;
};

function tagValue(tags: string[], prefix: string): string | undefined {
  return tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length);
}

function escapeEntitySelectorLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function resolveManagementZone(event: CustomEventPayload): string | undefined {
  return tagValue(event.tags, 'dynatrace.management_zone:') ?? process.env.DYNATRACE_MANAGEMENT_ZONE;
}

function resolveEntitySelector(event: CustomEventPayload): string | undefined {
  const explicitSelector = tagValue(event.tags, 'dynatrace.entity_selector:') ?? process.env.DYNATRACE_ENTITY_SELECTOR;
  const managementZone = resolveManagementZone(event);

  if (explicitSelector && managementZone && !explicitSelector.includes('mzName(')) {
    return `${explicitSelector},mzName("${escapeEntitySelectorLiteral(managementZone)}")`;
  }

  return explicitSelector;
}

export async function readEvents(filePath: string): Promise<CustomEventPayload[]> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as CustomEventPayload[];
}

export async function ingestEvents(filePath: string, dryRun: boolean): Promise<DynatraceEventIngestionResult[]> {
  const events = await readEvents(filePath);

  if (dryRun) {
    return events.map((event) => ({ title: event.title, status: 'dry-run' }));
  }

  const results: DynatraceEventIngestionResult[] = [];
  for (const event of events) {
    try {
      const response = await sendEvent(event);
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

function toProperties(event: CustomEventPayload): Record<string, string> {
  const properties: Record<string, string> = {
    'odd.title': event.title,
    'odd.text': event.text
  };

  for (const tag of event.tags) {
    const [key, ...rest] = tag.split(':');
    if (!key || rest.length === 0) continue;
    properties[`odd.tag.${key}`] = rest.join(':');
  }

  const managementZone = resolveManagementZone(event);
  if (managementZone) {
    properties['odd.management_zone'] = managementZone;
  }

  for (const tag of event.tags) {
    if (!tag.startsWith('dt.entity.')) continue;
    const separator = tag.indexOf(':');
    if (separator < 0) continue;
    const key = tag.slice(0, separator);
    const value = tag.slice(separator + 1);
    if (value !== '') {
      properties[key] = value;
    }
  }

  properties['dt.event.allow_davis_merge'] = event.alert_type === 'error' ? 'false' : 'true';
  return properties;
}

function toDynatracePayload(event: CustomEventPayload): DynatraceEventIngest {
  const isError = event.alert_type === 'error' || event.tags.includes('exception:true') || event.tags.includes('outcome:problem');
  const timeout = Number.parseInt(process.env.DYNATRACE_EVENT_TIMEOUT_MINUTES ?? '15', 10);
  return {
    eventType: isError ? 'ERROR_EVENT' : 'CUSTOM_INFO',
    title: event.title,
    timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 15,
    entitySelector: resolveEntitySelector(event),
    properties: toProperties(event)
  };
}

async function sendEvent(event: CustomEventPayload): Promise<unknown> {
  const envUrl = process.env.DYNATRACE_ENV_URL;
  const apiToken = process.env.DYNATRACE_API_TOKEN;

  if (!envUrl || !apiToken) {
    throw new Error('DYNATRACE_ENV_URL e DYNATRACE_API_TOKEN são obrigatórios para ingestão real no Dynatrace.');
  }

  const payload = toDynatracePayload(event);
  const response = await fetch(`${envUrl.replace(/\/+$/, '')}/api/v2/events/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Api-Token ${apiToken}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Erro ao enviar evento ${event.title} para Dynatrace: ${response.status} ${await response.text()}`);
  }

  return response.json();
}
