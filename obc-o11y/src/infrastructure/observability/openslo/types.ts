export type OpenSloApiVersion = 'openslo/v1';

export type OpenSloMetadata = {
  name: string;
  displayName?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
};

export type OpenSloMetricSource = {
  metricSourceRef?: string;
  type: string;
  spec: Record<string, unknown>;
};

export type OpenSloRatioMetric = {
  counter: true;
  good: { metricSource: OpenSloMetricSource };
  total: { metricSource: OpenSloMetricSource };
};

export type OpenSloThresholdMetric = {
  metricSource: OpenSloMetricSource;
};

export type OpenSloIndicatorSpec = {
  ratioMetric?: OpenSloRatioMetric;
  thresholdMetric?: OpenSloThresholdMetric;
};

export type OpenSloObjective = {
  displayName?: string;
  target: number;
  op?: 'lte' | 'lt' | 'gt' | 'gte';
  value?: number;
};

export type OpenSloTimeWindow = {
  duration: string;
  isRolling: boolean;
};

export type OpenSloKind =
  | 'DataSource'
  | 'Service'
  | 'SLI'
  | 'SLO'
  | 'AlertCondition'
  | 'AlertPolicy'
  | 'AlertNotificationTarget';

export type OpenSloDocument = {
  apiVersion: OpenSloApiVersion;
  kind: OpenSloKind;
  metadata: OpenSloMetadata;
  spec: Record<string, unknown>;
};

export type OpenSloBundle = OpenSloDocument[];

export type OpenSloDataSourceSpec = {
  type: 'Datadog' | 'Dynatrace' | 'Grafana' | 'Generic';
  description?: string;
  connectionDetails: Record<string, unknown>;
};

export type OpenSloServiceSpec = {
  description: string;
};

export type OpenSloSloSpec = {
  description: string;
  service: string;
  indicatorRef?: string;
  indicator?: { metadata: OpenSloMetadata; spec: OpenSloIndicatorSpec };
  objectives: OpenSloObjective[];
  timeWindow: OpenSloTimeWindow[];
  budgetingMethod: 'Occurrences' | 'Timeslices' | 'RatioTimeslices';
};

export type OpenSloAlertConditionSpec = {
  description?: string;
  severity: 'page' | 'ticket' | 'info';
  condition: {
    kind: 'burnrate';
    op: 'lte' | 'lt' | 'gt' | 'gte';
    threshold: number;
    lookbackWindow: string;
    alertAfter: string;
  };
};

export type OpenSloAlertNotificationTargetSpec = {
  description?: string;
  target: string;
  channel?: string;
};

export type OpenSloAlertPolicyRef =
  | { conditionRef: string }
  | { notificationTargetRef: string };

export type OpenSloAlertPolicySpec = {
  description?: string;
  alertWhenNoData: boolean;
  alertWhenResolved: boolean;
  alertWhenBreaching: boolean;
  conditions: Array<{ conditionRef: string }>;
  notificationTargets: Array<{ notificationTargetRef: string }>;
};
