export type SupportedWidget = 'event_stream' | 'note' | 'query_value' | 'timeseries';
export type DashboardSectionType = 'problems' | 'normal';
export type DashboardBandId = 'hero_alert' | 'failure_kpis' | 'failure_trends' | 'success_kpis' | 'success_trends';
export type DashboardVisualRole = 'hero_alert' | 'kpi' | 'trend';
export type DashboardPalette = 'alert' | 'warning' | 'success' | 'neutral';

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

export type CategorizedEvents = {
  problems: EventStormingRow[];
  normal: EventStormingRow[];
};

export type DashboardWidgetPlan = {
  id: string;
  title: string;
  widgetType: Extract<SupportedWidget, 'query_value' | 'timeseries'>;
  query: string;
  stage: string;
  sectionType: DashboardSectionType;
  sourceEventKeys: string[];
  visualRole: DashboardVisualRole;
  palette: DashboardPalette;
};

export type DashboardBandPlan = {
  id: DashboardBandId;
  title: string;
  sectionType: DashboardSectionType;
  widgets: DashboardWidgetPlan[];
};

export type CustomEventPayload = {
  title: string;
  text: string;
  tags: string[];
};

export type DashboardPlan = {
  dashboardTitle: string;
  bands: DashboardBandPlan[];
  customEvents: CustomEventPayload[];
};
