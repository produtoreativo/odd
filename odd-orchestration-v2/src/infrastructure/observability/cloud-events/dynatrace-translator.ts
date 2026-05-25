import { CloudEventV1 } from './types.js';

export type DynatraceBizEventData = Record<string, string | number | boolean>;

export type DynatraceBizEvent = {
  specversion: '1.0';
  id: string;
  source: string;
  type: string;
  time: string;
  subject?: string;
  datacontenttype: 'application/json';
  dataschema?: string;
  data: DynatraceBizEventData;
};

export type DynatraceTranslationOptions = {
  managementZone?: string;
};

export function translateCloudEventsToDynatrace(
  events: CloudEventV1[],
  options: DynatraceTranslationOptions = {}
): DynatraceBizEvent[] {
  return events.map((event) => translateOne(event, options));
}

function translateOne(event: CloudEventV1, options: DynatraceTranslationOptions): DynatraceBizEvent {
  const { attributes, rawTags, eventKey, env, dashboardKey } = event.data;
  const data: DynatraceBizEventData = {
    'odd.event_key': eventKey,
    'odd.env': env,
    'odd.dashboard_key': dashboardKey,
    'odd.outcome': attributes.outcome,
    'odd.is_error': attributes.isError,
    'odd.source': 'odd',
    'odd.cloudevents_id': event.id,
    'odd.cloudevents_type': event.type
  };

  if (attributes.title) data['odd.title'] = attributes.title;
  if (attributes.text) data['odd.text'] = attributes.text;
  if (attributes.stage) data['odd.stage'] = attributes.stage;
  if (attributes.actor) data['odd.actor'] = attributes.actor;
  if (attributes.service) data['odd.service'] = attributes.service;
  if (attributes.touchPoint) data['odd.touch_point'] = attributes.touchPoint;
  if (attributes.businessDomain) data['odd.business_domain'] = attributes.businessDomain;
  if (attributes.flowName) data['odd.flow'] = attributes.flowName;
  if (attributes.occurrenceKey) data['odd.occurrence_key'] = attributes.occurrenceKey;
  if (attributes.aggregationKey) data['odd.aggregation_key'] = attributes.aggregationKey;
  if (attributes.priority) data['odd.priority'] = attributes.priority;
  if (attributes.sourceTypeName) data['odd.source_type_name'] = attributes.sourceTypeName;

  const managementZone = options.managementZone
    ?? findTagValue(rawTags, 'dynatrace.management_zone:');
  if (managementZone) {
    data['odd.management_zone'] = managementZone;
  }

  for (const [key, value] of Object.entries(attributes.extras ?? {})) {
    data[`odd.tag.${key}`] = value;
  }

  return {
    specversion: '1.0',
    id: event.id,
    source: event.source,
    type: event.type,
    time: event.time,
    subject: event.subject,
    datacontenttype: 'application/json',
    dataschema: event.dataschema,
    data
  };
}

function findTagValue(rawTags: string[], prefix: string): string | undefined {
  return rawTags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length);
}
