export type SupportedWidget = 'event_stream' | 'note' | 'query_value' | 'timeseries';
export type DashboardSectionType = 'problems' | 'normal';
export type DashboardBandId = string;
export type DashboardVisualRole = string;
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
  sourceRow?: number | null;
  sourceTouchPoint?: string;
};

export type RecognizedFlow = {
  name: string;
  description: string;
  stages: string[];
  actors: string[];
  services: string[];
  confidence: number;
};

export type FlowOccurrence = {
  occurrenceKey: string;
  flowName: string;
  flowIndex: number;
  stepIndex: number;
  stage: string;
  eventKey: string;
  eventTitle: string;
  actor: string;
  service: string;
  tags: string[];
  queryHint: string;
  sourceTouchPoint?: string;
};

export type CategorizedEvents = {
  problems: EventStormingRow[];
  normal: EventStormingRow[];
};

export type SloSuggestion = {
  id: string;
  name: string;
  objective: string;
  sliType: 'availability' | 'latency' | 'error_rate' | 'throughput';
  target: string;
  rationale: string;
  sourceEventKeys: string[];
  sourceOccurrenceKeys?: string[];
  queryHint: string;
};

export type DashboardWidgetPlan = {
  id: string;
  title: string;
  widgetType: Extract<SupportedWidget, 'query_value' | 'timeseries'>;
  query: string;
  stage: string;
  sectionType: DashboardSectionType;
  sourceEventKeys: string[];
  sourceOccurrenceKeys?: string[];
  visualRole: DashboardVisualRole;
  palette: DashboardPalette;
  thresholdValue?: number;
  thresholdDirection?: 'above_bad' | 'below_bad' | 'at_least_good';
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
  alert_type?: 'error' | 'warning' | 'info' | 'success';
  priority?: 'normal' | 'low';
  source_type_name?: string;
  aggregation_key?: string;
};

export type EventBurstConfig = {
  burstCount: number;
  burstIntervalMs: number;
  copiesPerEvent: number;
  randomizeEventCounts: boolean;
  randomSeed: number;
};

export type DashboardPlan = {
  dashboardTitle: string;
  bands: DashboardBandPlan[];
  customEvents: CustomEventPayload[];
  sloSuggestions: SloSuggestion[];
  assumptions: string[];
};

export type EventIngestionResult = {
  title: string;
  burstIndex: number;
  copyIndex: number;
  status: 'sent' | 'dry-run' | 'failed';
  response?: unknown;
  error?: string;
};

export type MetricIngestionResult = {
  metric: string;
  status: 'sent' | 'dry-run' | 'failed';
  points: number;
  error?: string;
};

export type TerraformApplyReport = {
  provider: 'dynatrace' | 'grafana';
  dashboardKey: string;
  dryRun: boolean;
  terraformDir: string;
  eventsFile?: string;
  terraformCommands: string[];
  terraformError?: string;
  failedEventsCount?: number;
  ingestedEvents?: Array<{
    title: string;
    status: 'sent' | 'dry-run' | 'failed';
    response?: unknown;
    error?: string;
  }>;
};

export type DatadogApplyReport = {
  provider: 'datadog';
  dashboardKey: string;
  dryRun: boolean;
  terraformDir: string;
  eventsFile: string;
  burstConfig: EventBurstConfig;
  scheduledEventsCount: number;
  terraformCommands: string[];
  terraformError?: string;
  failedEventsCount: number;
  ingestedEvents: EventIngestionResult[];
  failedMetricsCount: number;
  ingestedMetrics: MetricIngestionResult[];
};

export type ApplyReport = DatadogApplyReport | TerraformApplyReport;

export type TerraformArtifacts = {
  dashboard: Record<string, unknown> | null;
  slos: Record<string, unknown> | null;
  bundle: Record<string, unknown> | null;
};
