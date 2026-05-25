import { randomUUID } from 'node:crypto';
import { CustomEventPayload, DashboardPlan } from '../../../shared/types.js';
import { normalizeEnv } from '../../../shared/query-hint.js';
import { CloudEventDataAttributes, CloudEventOutcome, CloudEventV1 } from './types.js';

const CLOUD_EVENT_SOURCE_PREFIX = 'odd:orchestration:v2';
const CLOUD_EVENT_DATA_SCHEMA = 'https://odd.example.com/schemas/business-event/v1.json';

export type CloudEventEncoderContext = {
  dashboardKey: string;
  env: string;
  source?: string;
};

export function encodePlanToCloudEvents(
  plan: DashboardPlan,
  context: CloudEventEncoderContext
): CloudEventV1[] {
  const env = normalizeEnv(context.env);
  const source = context.source ?? `${CLOUD_EVENT_SOURCE_PREFIX}/${context.dashboardKey}`;
  return plan.customEvents.map((event) => encodeCustomEvent(event, {
    dashboardKey: context.dashboardKey,
    env,
    source
  }));
}

export function encodeCustomEvent(
  event: CustomEventPayload,
  context: { dashboardKey: string; env: string; source: string }
): CloudEventV1 {
  const tagMap = indexTags(event.tags);
  const eventKey = tagMap.get('event_key') ?? event.title;
  const outcome = resolveOutcome(event, tagMap);
  const attributes = buildAttributes(event, tagMap, outcome);

  return {
    specversion: '1.0',
    id: randomUUID(),
    source: context.source,
    type: event.title,
    time: new Date().toISOString(),
    subject: attributes.touchPoint ?? attributes.stage,
    datacontenttype: 'application/json',
    dataschema: CLOUD_EVENT_DATA_SCHEMA,
    data: {
      eventKey,
      dashboardKey: context.dashboardKey,
      env: context.env,
      attributes,
      rawTags: [...event.tags]
    }
  };
}

function indexTags(tags: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const tag of tags) {
    const [key, ...rest] = tag.split(':');
    if (!key || rest.length === 0) continue;
    if (!map.has(key)) {
      map.set(key, rest.join(':'));
    }
  }
  return map;
}

function resolveOutcome(event: CustomEventPayload, tagMap: Map<string, string>): CloudEventOutcome {
  const alert = event.alert_type;
  if (alert === 'error') return 'failure';
  if (alert === 'warning') return 'warning';
  if (alert === 'success') return 'success';
  if (alert === 'info') return 'info';

  const outcomeTag = tagMap.get('outcome');
  if (outcomeTag === 'problem' || outcomeTag === 'failure') return 'failure';
  if (outcomeTag === 'success' || outcomeTag === 'ok') return 'success';
  if (outcomeTag === 'warning') return 'warning';

  return event.title.endsWith('_exception') || tagMap.get('exception') === 'true'
    ? 'failure'
    : 'success';
}

function buildAttributes(
  event: CustomEventPayload,
  tagMap: Map<string, string>,
  outcome: CloudEventOutcome
): CloudEventDataAttributes {
  const handled = new Set([
    'event_key',
    'env',
    'stage',
    'actor',
    'service',
    'touch_point',
    'business_domain',
    'source',
    'flow',
    'occurrence_key',
    'outcome',
    'exception'
  ]);

  const extras: Record<string, string> = {};
  for (const [key, value] of tagMap.entries()) {
    if (!handled.has(key)) {
      extras[key] = value;
    }
  }

  return {
    outcome,
    isError: outcome === 'failure',
    title: event.title,
    text: event.text,
    stage: tagMap.get('stage'),
    actor: tagMap.get('actor'),
    service: tagMap.get('service'),
    touchPoint: tagMap.get('touch_point'),
    businessDomain: tagMap.get('business_domain'),
    flowName: tagMap.get('flow'),
    occurrenceKey: tagMap.get('occurrence_key'),
    aggregationKey: event.aggregation_key,
    sourceTypeName: event.source_type_name,
    priority: event.priority,
    extras: Object.keys(extras).length > 0 ? extras : undefined
  };
}
