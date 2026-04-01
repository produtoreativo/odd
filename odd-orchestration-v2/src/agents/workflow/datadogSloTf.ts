import { DashboardPlan, SloSuggestion } from '../../shared/types.js';
import { buildEnvTag, normalizeEnv } from '../../shared/query-hint.js';

const GOOD_METRIC = 'odd.workflow.slo.good';
const TOTAL_METRIC = 'odd.workflow.slo.total';

function resourceName(value: string): string {
  return value
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'odd_slo';
}

function parseTargetPercentage(target: string): number {
  const normalized = target.replace(',', '.');
  const matched = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!matched) {
    return 99;
  }

  const parsed = Number.parseFloat(matched[1]);
  if (!Number.isFinite(parsed)) {
    return 99;
  }

  return Math.max(1, Math.min(99.99, parsed));
}

function resolveDatadogSloTarget(slo: SloSuggestion): number {
  const parsedTarget = parseTargetPercentage(slo.target);

  if (slo.sliType === 'error_rate') {
    const successTarget = parsedTarget <= 50 ? 100 - parsedTarget : parsedTarget;
    return Math.max(50, Math.min(99.99, successTarget));
  }

  return Math.max(50, Math.min(99.99, parsedTarget));
}

function resolveDatadogSloWarning(target: number): number {
  if (target >= 99.9) {
    return Math.min(99.99, Number((target + 0.05).toFixed(2)));
  }

  if (target >= 99) {
    return Math.min(99.99, Number((target + 0.2).toFixed(2)));
  }

  return Math.min(99.99, Number((target + 1).toFixed(2)));
}

function buildTags(dashboardKey: string, slo: SloSuggestion, env?: string): string[] {
  return [
    'source:odd',
    buildEnvTag(env),
    `dashboard_key:${dashboardKey}`,
    `slo_id:${slo.id}`,
    `sli_type:${slo.sliType}`
  ];
}

function metricQuery(metricName: string, dashboardKey: string, slo: SloSuggestion, env?: string): string {
  return `sum:${metricName}{dashboard_key:${dashboardKey},slo_id:${slo.id},source:odd,env:${normalizeEnv(env)}}.as_count()`;
}

export async function buildDatadogSloTerraform(
  plan: DashboardPlan,
  dashboardKey: string,
  env?: string
): Promise<Record<string, unknown>> {
  const slos: Record<string, unknown> = {};

  for (const slo of plan.sloSuggestions) {
    const sloName = `${resourceName(`${dashboardKey}_${slo.id}`)}_slo`;
    const target = resolveDatadogSloTarget(slo);
    const warning = resolveDatadogSloWarning(target);
    const tags = buildTags(dashboardKey, slo, env);

    slos[sloName] = {
      name: `${plan.dashboardTitle} | ${slo.name}`,
      type: 'metric',
      description: `${slo.objective}\n\n${slo.rationale}`,
      query: {
        numerator: metricQuery(GOOD_METRIC, dashboardKey, slo, env),
        denominator: metricQuery(TOTAL_METRIC, dashboardKey, slo, env)
      },
      tags,
      thresholds: [
        {
          timeframe: '7d',
          target,
          warning
        },
        {
          timeframe: '30d',
          target,
          warning
        }
      ]
    };
  }

  return {
    resource: {
      datadog_service_level_objective: slos
    }
  };
}
