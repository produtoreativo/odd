import { DashboardPlan, SloSuggestion } from '../../../shared/types.js';
import { normalizeEnv } from '../../../shared/query-hint.js';
import {
  OpenSloDocument,
  OpenSloIndicatorSpec,
  OpenSloMetricSource,
  OpenSloObjective,
  OpenSloRatioMetric,
  OpenSloThresholdMetric,
  OpenSloTimeWindow
} from './types.js';

const DEFAULT_TIME_WINDOWS: OpenSloTimeWindow[] = [
  { duration: '7d', isRolling: true },
  { duration: '30d', isRolling: true }
];

const GOOD_METRIC = 'odd.workflow.slo.good';
const TOTAL_METRIC = 'odd.workflow.slo.total';
const EVENT_METRIC = 'odd.workflow.event.count';

const PRIMARY_BURN_RATE = {
  lookbackWindow: '1h',
  alertAfter: '5m',
  threshold: 14.4,
  severity: 'page' as const
};

const SECONDARY_BURN_RATE = {
  lookbackWindow: '6h',
  alertAfter: '30m',
  threshold: 6,
  severity: 'ticket' as const
};

const NOTIFICATION_TARGETS: Array<{ name: string; target: string; channel: string; description: string }> = [
  {
    name: 'odd-oncall-email',
    target: 'odd-oncall@example.com',
    channel: 'email',
    description: 'Default email destination for ODD on-call rotation.'
  },
  {
    name: 'odd-oncall-slack',
    target: '#odd-oncall',
    channel: 'slack',
    description: 'Default Slack channel for ODD operational alerts.'
  }
];

export type OpenSloEncoderContext = {
  dashboardKey: string;
  dashboardTitle: string;
  env: string;
  provider?: 'datadog' | 'dynatrace' | 'grafana';
};

export function encodeOpenSloDataSources(context: OpenSloEncoderContext): OpenSloDocument[] {
  const env = normalizeEnv(context.env);
  const sources: OpenSloDocument[] = [];

  if (!context.provider || context.provider === 'datadog') {
    sources.push({
      apiVersion: 'openslo/v1',
      kind: 'DataSource',
      metadata: {
        name: `${context.dashboardKey}-datadog`,
        displayName: `Datadog metrics for ${context.dashboardKey}`,
        labels: { env, dashboard_key: context.dashboardKey, provider: 'datadog', source: 'odd' }
      },
      spec: {
        type: 'Datadog',
        description: 'Datadog metrics ingested from ODD workflow apply step.',
        connectionDetails: {
          site: 'datadoghq.com',
          apiKeyEnv: 'DD_API_KEY',
          appKeyEnv: 'DD_APP_KEY',
          baseUrlEnv: 'DD_API_BASE_URL'
        }
      }
    });
  }

  if (!context.provider || context.provider === 'dynatrace') {
    sources.push({
      apiVersion: 'openslo/v1',
      kind: 'DataSource',
      metadata: {
        name: `${context.dashboardKey}-dynatrace`,
        displayName: `Dynatrace BizEvents for ${context.dashboardKey}`,
        labels: { env, dashboard_key: context.dashboardKey, provider: 'dynatrace', source: 'odd' }
      },
      spec: {
        type: 'Dynatrace',
        description: 'Dynatrace Business Events ingested via CloudEvents-batch endpoint.',
        connectionDetails: {
          envUrlEnv: 'DYNATRACE_ENV_URL',
          tokenEnv: 'DYNATRACE_BIZEVENTS_TOKEN',
          bearerEnv: 'DYNATRACE_BIZEVENTS_BEARER_TOKEN',
          ingestUrlEnv: 'DYNATRACE_BIZEVENTS_INGEST_URL'
        }
      }
    });
  }

  return sources;
}

export function encodeOpenSloService(plan: DashboardPlan, context: OpenSloEncoderContext): OpenSloDocument {
  const env = normalizeEnv(context.env);
  return {
    apiVersion: 'openslo/v1',
    kind: 'Service',
    metadata: {
      name: context.dashboardKey,
      displayName: plan.dashboardTitle ?? context.dashboardTitle,
      labels: { env, dashboard_key: context.dashboardKey, source: 'odd' }
    },
    spec: {
      description: `Service contract for dashboard ${plan.dashboardTitle ?? context.dashboardTitle}.`
    }
  };
}

export function encodeOpenSloSlis(
  suggestions: SloSuggestion[],
  context: OpenSloEncoderContext
): OpenSloDocument[] {
  const env = normalizeEnv(context.env);
  return suggestions.map((slo) => ({
    apiVersion: 'openslo/v1',
    kind: 'SLI',
    metadata: {
      name: sliName(context.dashboardKey, slo),
      displayName: `SLI for ${slo.name}`,
      labels: {
        env,
        dashboard_key: context.dashboardKey,
        slo_id: slo.id,
        sli_type: slo.sliType,
        source: 'odd'
      },
      annotations: {
        source_event_keys: slo.sourceEventKeys.join(','),
        ...(slo.sourceOccurrenceKeys?.length
          ? { source_occurrence_keys: slo.sourceOccurrenceKeys.join(',') }
          : {}),
        query_hint: slo.queryHint
      }
    },
    spec: buildIndicatorSpec(slo, { ...context, env })
  }));
}

export function encodeOpenSloSlos(
  suggestions: SloSuggestion[],
  slis: OpenSloDocument[],
  context: OpenSloEncoderContext
): OpenSloDocument[] {
  const env = normalizeEnv(context.env);
  const sliBySlo = new Map(slis.map((doc) => [doc.metadata.labels?.slo_id ?? doc.metadata.name, doc.metadata.name]));

  return suggestions.map((slo) => ({
    apiVersion: 'openslo/v1',
    kind: 'SLO',
    metadata: {
      name: sloName(context.dashboardKey, slo),
      displayName: slo.name,
      labels: {
        env,
        dashboard_key: context.dashboardKey,
        slo_id: slo.id,
        sli_type: slo.sliType,
        source: 'odd'
      },
      annotations: {
        rationale: slo.rationale,
        objective: slo.objective,
        source_event_keys: slo.sourceEventKeys.join(','),
        ...(slo.sourceOccurrenceKeys?.length
          ? { source_occurrence_keys: slo.sourceOccurrenceKeys.join(',') }
          : {}),
        original_target: slo.target,
        query_hint: slo.queryHint
      }
    },
    spec: {
      description: slo.objective,
      service: context.dashboardKey,
      indicatorRef: sliBySlo.get(slo.id) ?? sliName(context.dashboardKey, slo),
      objectives: [buildObjective(slo)],
      timeWindow: DEFAULT_TIME_WINDOWS,
      budgetingMethod: 'Occurrences',
      alertPolicies: [{ alertPolicyRef: alertPolicyName(context.dashboardKey, slo) }]
    }
  }));
}

export function encodeOpenSloAlertConditions(
  suggestions: SloSuggestion[],
  context: OpenSloEncoderContext
): OpenSloDocument[] {
  const env = normalizeEnv(context.env);
  const docs: OpenSloDocument[] = [];

  for (const slo of suggestions) {
    for (const profile of [PRIMARY_BURN_RATE, SECONDARY_BURN_RATE]) {
      docs.push({
        apiVersion: 'openslo/v1',
        kind: 'AlertCondition',
        metadata: {
          name: alertConditionName(context.dashboardKey, slo, profile.lookbackWindow),
          displayName: `Burn rate ${profile.threshold}x ${profile.lookbackWindow} for ${slo.name}`,
          labels: {
            env,
            dashboard_key: context.dashboardKey,
            slo_id: slo.id,
            sli_type: slo.sliType,
            burn_window: profile.lookbackWindow,
            severity: profile.severity,
            source: 'odd'
          }
        },
        spec: {
          description: `Burn rate condition for ${slo.name} (${profile.lookbackWindow} window).`,
          severity: profile.severity,
          condition: {
            kind: 'burnrate',
            op: 'gte',
            threshold: profile.threshold,
            lookbackWindow: profile.lookbackWindow,
            alertAfter: profile.alertAfter
          }
        }
      });
    }
  }

  return docs;
}

export function encodeOpenSloAlertNotificationTargets(
  context: OpenSloEncoderContext
): OpenSloDocument[] {
  const env = normalizeEnv(context.env);
  return NOTIFICATION_TARGETS.map((target) => ({
    apiVersion: 'openslo/v1',
    kind: 'AlertNotificationTarget',
    metadata: {
      name: `${context.dashboardKey}-${target.name}`,
      displayName: target.description,
      labels: {
        env,
        dashboard_key: context.dashboardKey,
        channel: target.channel,
        source: 'odd'
      }
    },
    spec: {
      description: target.description,
      target: target.target,
      channel: target.channel
    }
  }));
}

export function encodeOpenSloAlertPolicies(
  suggestions: SloSuggestion[],
  conditions: OpenSloDocument[],
  targets: OpenSloDocument[],
  context: OpenSloEncoderContext
): OpenSloDocument[] {
  const env = normalizeEnv(context.env);
  const conditionsBySlo = groupBy(conditions, (doc) => doc.metadata.labels?.slo_id ?? '');
  const targetRefs = targets.map((doc) => ({ notificationTargetRef: doc.metadata.name }));

  return suggestions.map((slo) => ({
    apiVersion: 'openslo/v1',
    kind: 'AlertPolicy',
    metadata: {
      name: alertPolicyName(context.dashboardKey, slo),
      displayName: `Alert policy for ${slo.name}`,
      labels: {
        env,
        dashboard_key: context.dashboardKey,
        slo_id: slo.id,
        sli_type: slo.sliType,
        source: 'odd'
      }
    },
    spec: {
      description: `Multi-window burn-rate policy for ${slo.name}.`,
      alertWhenNoData: false,
      alertWhenResolved: true,
      alertWhenBreaching: true,
      conditions: (conditionsBySlo.get(slo.id) ?? []).map((doc) => ({ conditionRef: doc.metadata.name })),
      notificationTargets: targetRefs
    }
  }));
}

export function composeOpenSloBundle(
  plan: DashboardPlan,
  context: OpenSloEncoderContext
): OpenSloDocument[] {
  const dataSources = encodeOpenSloDataSources(context);
  const service = encodeOpenSloService(plan, context);
  const slis = encodeOpenSloSlis(plan.sloSuggestions, context);
  const slos = encodeOpenSloSlos(plan.sloSuggestions, slis, context);
  const conditions = encodeOpenSloAlertConditions(plan.sloSuggestions, context);
  const targets = encodeOpenSloAlertNotificationTargets(context);
  const policies = encodeOpenSloAlertPolicies(plan.sloSuggestions, conditions, targets, context);

  return [...dataSources, service, ...slis, ...slos, ...conditions, ...targets, ...policies];
}

export function encodePlanToOpenSlo(plan: DashboardPlan, context: OpenSloEncoderContext): OpenSloDocument[] {
  return composeOpenSloBundle(plan, context);
}

function buildIndicatorSpec(slo: SloSuggestion, context: OpenSloEncoderContext & { env: string }): OpenSloIndicatorSpec {
  const baseLabels = `dashboard_key:${context.dashboardKey},slo_id:${slo.id},source:odd,env:${context.env}`;
  const metricSourceType = 'Generic';

  if (slo.sliType === 'latency') {
    const latency = parseLatencyTarget(slo.target);
    const thresholdMetric: OpenSloThresholdMetric = {
      metricSource: {
        type: metricSourceType,
        spec: {
          query: `${EVENT_METRIC}{${baseLabels}}`,
          unit: 'ms',
          metricKind: 'distribution',
          percentile: latency.percentile,
          comparisonOperator: 'lte',
          comparisonValue: latency.value
        }
      }
    };
    return { thresholdMetric };
  }

  const good: OpenSloMetricSource = {
    type: metricSourceType,
    spec: { query: `sum:${GOOD_METRIC}{${baseLabels}}.as_count()` }
  };
  const total: OpenSloMetricSource = {
    type: metricSourceType,
    spec: { query: `sum:${TOTAL_METRIC}{${baseLabels}}.as_count()` }
  };
  const ratioMetric: OpenSloRatioMetric = {
    counter: true,
    good: { metricSource: good },
    total: { metricSource: total }
  };
  return { ratioMetric };
}

function buildObjective(slo: SloSuggestion): OpenSloObjective {
  if (slo.sliType === 'latency') {
    const latency = parseLatencyTarget(slo.target);
    return {
      displayName: slo.target,
      target: ratioFromPercent(latency.percent),
      op: 'lte',
      value: latency.value
    };
  }

  return {
    displayName: slo.target,
    target: ratioFromPercent(resolveSuccessPercent(slo))
  };
}

function resolveSuccessPercent(slo: SloSuggestion): number {
  const parsed = parseTargetPercentage(slo.target);
  if (slo.sliType === 'error_rate' && parsed <= 50) {
    return 100 - parsed;
  }
  return parsed;
}

function parseTargetPercentage(target: string): number {
  const normalized = target.replace(',', '.');
  const matched = /(\d+(?:\.\d+)?)/.exec(normalized);
  if (!matched) return 99;
  const parsed = Number.parseFloat(matched[1]);
  if (!Number.isFinite(parsed)) return 99;
  return Math.max(1, Math.min(99.99, parsed));
}

function ratioFromPercent(percent: number): number {
  const clamped = Math.max(0.5, Math.min(99.99, percent));
  return Number((clamped / 100).toFixed(5));
}

function parseLatencyTarget(target: string): { value: number; percentile: number; percent: number } {
  const normalized = target.toLowerCase().replace(',', '.');
  const percentileMatch = /p(\d{1,3})|(\d{1,3})(?:st|nd|rd|th)\s*percentile/.exec(normalized);
  const percentile = percentileMatch
    ? Number.parseFloat(percentileMatch[1] ?? percentileMatch[2])
    : 95;

  const valueMatch = /<\s*(\d+(?:\.\d+)?)\s*(ms|s|m|seg|min)?/.exec(normalized);
  const rawValue = valueMatch ? Number.parseFloat(valueMatch[1]) : 1000;
  const unit = valueMatch?.[2] ?? 'ms';
  const valueMs = convertToMs(rawValue, unit);

  return { value: valueMs, percentile, percent: percentile };
}

function convertToMs(value: number, unit: string): number {
  switch (unit) {
    case 's':
    case 'seg':
      return value * 1000;
    case 'm':
    case 'min':
      return value * 60 * 1000;
    case 'ms':
    default:
      return value;
  }
}

function sliName(dashboardKey: string, slo: SloSuggestion): string {
  return slugify(`${dashboardKey}-${slo.id}-sli`);
}

function sloName(dashboardKey: string, slo: SloSuggestion): string {
  return slugify(`${dashboardKey}-${slo.id}`);
}

function alertConditionName(dashboardKey: string, slo: SloSuggestion, window: string): string {
  return slugify(`${dashboardKey}-${slo.id}-burnrate-${window}`);
}

function alertPolicyName(dashboardKey: string, slo: SloSuggestion): string {
  return slugify(`${dashboardKey}-${slo.id}-policy`);
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]+/g, '-')
    .replaceAll(/(?:^-+)|(?:-+$)/g, '');
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key);
    if (list) {
      list.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}
