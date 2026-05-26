import { OpenSloDocument } from './types.js';

export type DynatraceSloTerraformTranslation = {
  dynatrace_slo: Record<string, DynatraceSloResource>;
};

type DynatraceSloResource = {
  name: string;
  description?: string;
  metric_expression: string;
  evaluation: 'AGGREGATE';
  target_success: number;
  target_warning: number;
  timeframe: string;
  filter?: string;
  enabled: true;
  tags?: string[];
};

const DEFAULT_TIMEFRAME = '-7d';

type DynatraceIndicatorSpecLike = {
  ratioMetric?: {
    good: { metricSource: { spec: { query?: string } } };
    total: { metricSource: { spec: { query?: string } } };
  };
  thresholdMetric?: {
    metricSource: { spec: { query?: string; comparisonValue?: number } };
  };
};

export function translateOpenSloToDynatraceTerraform(
  documents: OpenSloDocument[],
  context: { dashboardKey: string }
): { resource: DynatraceSloTerraformTranslation } | Record<string, never> {
  const slos: Record<string, DynatraceSloResource> = {};
  const slis = indexSlis(documents);

  for (const doc of documents) {
    if (doc.kind !== 'SLO') continue;
    const result = buildDynatraceSloResource(doc, slis, context);
    if (!result) continue;
    slos[result.resourceName] = result.resource;
  }

  if (Object.keys(slos).length === 0) return {};
  return {
    resource: {
      dynatrace_slo: slos
    }
  };
}

function indexSlis(documents: OpenSloDocument[]): Map<string, DynatraceIndicatorSpecLike> {
  const map = new Map<string, DynatraceIndicatorSpecLike>();
  for (const doc of documents) {
    if (doc.kind !== 'SLI') continue;
    map.set(doc.metadata.name, doc.spec as DynatraceIndicatorSpecLike);
  }
  return map;
}

function resolveIndicatorSpec(
  doc: OpenSloDocument,
  slis: Map<string, DynatraceIndicatorSpecLike>
): DynatraceIndicatorSpecLike | undefined {
  const indicatorRef = typeof doc.spec.indicatorRef === 'string' ? doc.spec.indicatorRef : undefined;
  if (indicatorRef) {
    return slis.get(indicatorRef);
  }
  const indicator = doc.spec.indicator as { spec?: DynatraceIndicatorSpecLike } | undefined;
  return indicator?.spec;
}

function buildDynatraceSloResource(
  doc: OpenSloDocument,
  slis: Map<string, DynatraceIndicatorSpecLike>,
  context: { dashboardKey: string }
): { resourceName: string; resource: DynatraceSloResource } | null {
  const indicatorSpec = resolveIndicatorSpec(doc, slis);

  const labels = doc.metadata.labels ?? {};
  const annotations = doc.metadata.annotations ?? {};
  const sliType = labels.sli_type ?? 'availability';
  const objectives = Array.isArray(doc.spec.objectives) ? doc.spec.objectives as Array<{ target: number }> : [];
  const targetRatio = objectives[0]?.target ?? 0.99;
  const target = Math.max(50, Math.min(99.99, Number((targetRatio * 100).toFixed(2))));
  const warning = resolveWarning(target);
  const resourceName = `${slugify(`${context.dashboardKey}_${labels.slo_id ?? doc.metadata.name}`)}_slo`;

  let metricExpression: string;
  if (indicatorSpec?.ratioMetric) {
    const goodQuery = indicatorSpec.ratioMetric.good.metricSource.spec.query ?? '';
    const totalQuery = indicatorSpec.ratioMetric.total.metricSource.spec.query ?? '';
    metricExpression = buildRatioExpression(goodQuery, totalQuery, context.dashboardKey, labels);
  } else if (indicatorSpec?.thresholdMetric) {
    const query = indicatorSpec.thresholdMetric.metricSource.spec.query ?? '';
    metricExpression = buildThresholdExpression(query, context.dashboardKey, labels);
  } else {
    return null;
  }

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
      name: doc.metadata.displayName ?? doc.metadata.name,
      description: annotations.rationale ?? annotations.objective,
      metric_expression: metricExpression,
      evaluation: 'AGGREGATE',
      target_success: target,
      target_warning: warning,
      timeframe: DEFAULT_TIMEFRAME,
      enabled: true,
      tags
    }
  };
}

function buildRatioExpression(
  goodQuery: string,
  totalQuery: string,
  dashboardKey: string,
  labels: Record<string, string>
): string {
  const filter = buildDynatraceFilter(dashboardKey, labels);
  return `(100)*(builtin:bizevents.count${filter}:filter(eq("odd.outcome","success"))/builtin:bizevents.count${filter})`
    .concat(`/* odd-source: good=${shorten(goodQuery)}; total=${shorten(totalQuery)} */`);
}

function buildThresholdExpression(
  query: string,
  dashboardKey: string,
  labels: Record<string, string>
): string {
  const filter = buildDynatraceFilter(dashboardKey, labels);
  return `builtin:bizevents.duration${filter}:percentile(95)`
    .concat(`/* odd-source: ${shorten(query)} */`);
}

function buildDynatraceFilter(dashboardKey: string, labels: Record<string, string>): string {
  const conditions: string[] = [
    `eq("odd.dashboard_key","${dashboardKey}")`,
    `eq("odd.env","${labels.env ?? 'dev'}")`
  ];
  if (labels.slo_id) {
    conditions.push(`eq("odd.slo_id","${labels.slo_id}")`);
  }
  return `:filter(and(${conditions.join(',')}))`;
}

function shorten(query: string): string {
  return query.length > 80 ? `${query.slice(0, 80)}...` : query;
}

function resolveWarning(target: number): number {
  if (target >= 99.9) return Math.min(99.99, Number((target + 0.05).toFixed(2)));
  if (target >= 99) return Math.min(99.99, Number((target + 0.2).toFixed(2)));
  return Math.min(99.99, Number((target + 1).toFixed(2)));
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'odd_slo';
}
