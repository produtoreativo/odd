export type CloudEventOutcome = 'success' | 'failure' | 'warning' | 'info';

export type CloudEventDataAttributes = {
  outcome: CloudEventOutcome;
  isError: boolean;
  stage?: string;
  actor?: string;
  service?: string;
  touchPoint?: string;
  businessDomain?: string;
  flowName?: string;
  occurrenceKey?: string;
  aggregationKey?: string;
  sourceTouchPoint?: string;
  priority?: 'normal' | 'low';
  sourceTypeName?: string;
  text?: string;
  title?: string;
  extras?: Record<string, string>;
};

export type CloudEventV1 = {
  specversion: '1.0';
  id: string;
  source: string;
  type: string;
  time: string;
  subject?: string;
  datacontenttype: 'application/json';
  dataschema?: string;
  data: {
    eventKey: string;
    dashboardKey: string;
    env: string;
    attributes: CloudEventDataAttributes;
    rawTags: string[];
  };
};

export type CloudEventBundle = {
  events: CloudEventV1[];
};
