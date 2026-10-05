import { CustomEventPayload } from '../../../shared/types.js';
import { CloudEventV1 } from './types.js';

const DEFAULT_SOURCE_TYPE_NAME_NORMAL = 'odd-business-event';
const DEFAULT_SOURCE_TYPE_NAME_ERROR = 'odd-exception';

export type DatadogEventPayload = CustomEventPayload;

export function translateCloudEventsToDatadog(events: CloudEventV1[]): DatadogEventPayload[] {
  return events.map(translateOne);
}

function translateOne(event: CloudEventV1): DatadogEventPayload {
  const { attributes, rawTags } = event.data;
  const alertType = mapOutcomeToAlertType(attributes.outcome);
  const tags = mergeTags(rawTags, event);

  return {
    title: event.type,
    text: attributes.text ?? `CloudEvent ${event.id}`,
    tags,
    alert_type: alertType,
    priority: attributes.priority ?? 'normal',
    source_type_name: attributes.sourceTypeName
      ?? (attributes.isError ? DEFAULT_SOURCE_TYPE_NAME_ERROR : DEFAULT_SOURCE_TYPE_NAME_NORMAL),
    aggregation_key: attributes.aggregationKey ?? attributes.stage
  };
}

function mapOutcomeToAlertType(outcome: CloudEventV1['data']['attributes']['outcome']): NonNullable<DatadogEventPayload['alert_type']> {
  switch (outcome) {
    case 'failure':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    case 'success':
    default:
      return 'success';
  }
}

function mergeTags(rawTags: string[], event: CloudEventV1): string[] {
  const tags = new Set<string>(rawTags);
  tags.add(`event_key:${event.data.eventKey}`);
  tags.add(`env:${event.data.env}`);
  tags.add(`dashboard_key:${event.data.dashboardKey}`);
  tags.add(`cloudevents_id:${event.id}`);
  tags.add('source:odd');
  tags.add('format:cloudevents-1.0');
  return [...tags];
}
