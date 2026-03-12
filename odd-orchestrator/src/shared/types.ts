export type SupportedWidget = 'event_stream' | 'note';

export type EventStormingRow = {
  ordem: number;
  eventKey: string;
  eventTitle: string;
  stage: string;
  actor: string;
  service: string;
  tags: string[];
  dashboardWidget: SupportedWidget;
  queryHint: string;
};

export type DashboardWidgetPlan = {
  id: string;
  title: string;
  widgetType: SupportedWidget;
  query: string;
  stage: string;
};

export type DashboardGroupPlan = {
  stage: string;
  title: string;
  widgets: DashboardWidgetPlan[];
};

export type CustomEventPayload = {
  title: string;
  text: string;
  tags: string[];
};

export type DashboardPlan = {
  dashboardTitle: string;
  groups: DashboardGroupPlan[];
  customEvents: CustomEventPayload[];
};
