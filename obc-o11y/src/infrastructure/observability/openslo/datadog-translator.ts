import { DashboardPlan } from '../../../shared/types.js';
import { OpenSloDocument } from './types.js';

const DEFAULT_THRESHOLDS: Array<{ timeframe: '7d' | '30d' | '90d' }> = [
  { timeframe: '7d' },
  { timeframe: '30d' }
];

export type DatadogSloTerraformTranslation = {
  datadog_service_level_objective: Record<string, DatadogSloResource>;
};

type DatadogSloResource = {
  name: string;
  type: 'metric';
  description: string;
  query: { numerator: string; denominator: string };
  tags: string[];
  thresholds: Array<{ timeframe: string; target: number; warning: number }>;
};

export function translateOpenSloToDatadogTerraform(
  documents: OpenSloDocument[],
  context: { dashboardKey: string; dashboardTitle: string }
): { resource: DatadogSloTerraformTranslation } | Record<string, never> {
  const slos: Record<string, DatadogSloResource> = {};
  const slis = indexSlis(documents);

  for (const doc of documents) {
    if (doc.kind !== 'SLO') continue;
    const resource = buildDatadogSloResource(doc, slis, context);
    if (!resource) continue;
    slos[resource.resourceName] = resource.resource;
  }

  if (Object.keys(slos).length === 0) return {};
  return {
    resource: {
      datadog_service_level_objective: slos
    }
  };
}

type IndicatorSpecLike = {
  ratioMetric?: { good: { metricSource: { spec: { query?: string } } }; total: { metricSource: { spec: { query?: string } } } };
  thresholdMetric?: { metricSource: { spec: { query?: string } } };
};

function indexSlis(documents: OpenSloDocument[]): Map<string, IndicatorSpecLike> {
  const map = new Map<string, IndicatorSpecLike>();
  for (const doc of documents) {
    if (doc.kind !== 'SLI') continue;
    map.set(doc.metadata.name, doc.spec as IndicatorSpecLike);
  }
  return map;
}

function resolveIndicatorSpec(doc: OpenSloDocument, slis: Map<string, IndicatorSpecLike>): IndicatorSpecLike | undefined {
  const spec = doc.spec as Record<string, unknown>;
  const indicatorRef = typeof spec.indicatorRef === 'string' ? spec.indicatorRef : undefined;
  if (indicatorRef) {
    return slis.get(indicatorRef);
  }
  const indicator = spec.indicator as { spec?: IndicatorSpecLike } | undefined;
  return indicator?.spec;
}

function buildDatadogSloResource(
  doc: OpenSloDocument,
  slis: Map<string, IndicatorSpecLike>,
  context: { dashboardKey: string; dashboardTitle: string }
): { resourceName: string; resource: DatadogSloResource } | null {
  const indicatorSpec = resolveIndicatorSpec(doc, slis);
  const ratioMetric = indicatorSpec?.ratioMetric;

  if (!ratioMetric) {
    return null;
  }

  const labels = doc.metadata.labels ?? {};
  const annotations = doc.metadata.annotations ?? {};
  const sliType = labels.sli_type ?? 'availability';
  const numerator = ratioMetric.good.metricSource.spec.query ?? '';
  const denominator = ratioMetric.total.metricSource.spec.query ?? '';

  const objectives = Array.isArray(doc.spec.objectives) ? doc.spec.objectives as Array<{ target: number }> : [];
  const targetRatio = objectives[0]?.target ?? 0.99;
  const target = Math.max(50, Math.min(99.99, Number((targetRatio * 100).toFixed(2))));
  const warning = resolveWarning(target);

  const resourceName = `${slugify(`${context.dashboardKey}_${labels.slo_id ?? doc.metadata.name}`)}_slo`;

  const tags = [
    'source:odd',
    `env:${labels.env}`,
    `dashboard_key:${context.dashboardKey}`,
    `slo_id:${labels.slo_id ?? doc.metadata.name}`,
    `sli_type:${sliType}`,
    'format:openslo-v1'
  ];

  return {
    resourceName,
    resource: {
      name: `${context.dashboardTitle} | ${doc.metadata.displayName ?? doc.metadata.name}`,
      type: 'metric',
      description: buildDescription(doc.metadata.displayName ?? doc.metadata.name, sliType, annotations.source_event_keys),
      query: { numerator, denominator },
      tags,
      thresholds: DEFAULT_THRESHOLDS.map((threshold) => ({
        timeframe: threshold.timeframe,
        target,
        warning
      }))
    }
  };
}

function resolveWarning(target: number): number {
  if (target >= 99.9) return Math.min(99.99, Number((target + 0.05).toFixed(2)));
  if (target >= 99) return Math.min(99.99, Number((target + 0.2).toFixed(2)));
  return Math.min(99.99, Number((target + 1).toFixed(2)));
}

function buildDescription(name: string, sliType: string, sourceEvents?: string): string {
  return [
    `Stable SLO for ${name}.`,
    `SLI type: ${sliType}.`,
    sourceEvents ? `Source events: ${sourceEvents}.` : null
  ].filter(Boolean).join(' ');
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'odd_slo';
}

export function buildDatadogSloTerraformFromPlan(
  documents: OpenSloDocument[],
  plan: DashboardPlan,
  dashboardKey: string
): Record<string, unknown> {
  return translateOpenSloToDatadogTerraform(documents, {
    dashboardKey,
    dashboardTitle: plan.dashboardTitle
  });
}
