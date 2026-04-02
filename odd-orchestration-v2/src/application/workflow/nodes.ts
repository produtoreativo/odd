import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { applyDatadog } from '../../agents/applier/index.js';
import { buildDatadogSloTerraform } from '../../infrastructure/observability/datadog-slo-terraform.js';
import { buildDatadogDashboardTerraform } from '../../infrastructure/observability/datadog-dashboard-terraform.js';
import { buildDynatraceDashboardTerraform } from '../../infrastructure/observability/dynatrace-dashboard-terraform.js';
import { buildGrafanaDashboardTerraform } from '../../infrastructure/observability/grafana-dashboard-terraform.js';
import { DashboardPlanSchema, CategorizedEventsSchema, SloSuggestionSchema } from '../../domain/contracts.js';
import { renderPrompt } from '../../infrastructure/filesystem/prompt-repository.js';
import { BedrockJsonAgent, parseBedrockJsonResponse } from '../../infrastructure/llm/bedrock-json-agent.js';
import { writeTerraformWorkspaceArtifact } from '../../infrastructure/terraform/workspace.js';
import { buildFlowOccurrences } from '../../shared/flow-occurrences.js';
import { ensureDir, writeJsonFile } from '../../shared/fs.js';
import { readPlanningInputContract } from '../../shared/input.js';
import { Logger } from '../../shared/logger.js';
import { buildEnvTag, buildEventQueryHint } from '../../shared/query-hint.js';
import { mergeTerraformJson } from '../../shared/terraform-json.js';
import { DashboardPlan, EventStormingRow, FlowOccurrence, SloSuggestion } from '../../shared/types.js';
import { ObservabilityWorkflowState } from './state.js';

const logger = new Logger('observability-workflow');

export async function loadInputNode(state: ObservabilityWorkflowState) {
  logger.info('Etapa input iniciada', {
    input: state.input,
    outputDir: state.outputDir
  });
  const planningInput = await readPlanningInputContract(state.input, state.env);
  logger.info('Etapa input concluída', {
    input: state.input,
    rowCount: planningInput.rows.length,
    recognizedFlows: planningInput.recognizedFlows.length
  });
  return {
    rows: planningInput.rows,
    recognizedFlows: planningInput.recognizedFlows,
    flowOccurrences: buildFlowOccurrences(planningInput.rows, planningInput.recognizedFlows)
  };
}

export async function categorizeEventsNode(state: ObservabilityWorkflowState) {
  const modelName = resolveModel('categorize');
  logger.info('Etapa categorize iniciada', {
    rowCount: state.rows.length,
    model: modelName
  });
  const prompt = await renderPrompt('categorize-events.prompt.md');
  const model = new BedrockJsonAgent(modelName);

  try {
    const userPrompt = JSON.stringify({
      recognizedFlows: state.recognizedFlows,
      rows: state.rows.slice().sort((left, right) => left.ordem - right.ordem)
    }, null, 2);
    const rawText = await model.callRawText(prompt, userPrompt);
    const rawOutputPath = await persistRawOutput(state.outputDir, '01-categorize-events.raw.txt', rawText);
    const result = CategorizedEventsSchema.parse(parseBedrockJsonResponse(rawText));
    const categorized = hydrateCategorization(result, state.rows);
    logger.info('Etapa categorize concluída', {
      problems: categorized.problems.length,
      normal: categorized.normal.length,
      rawOutputPath
    });
    return { categorized };
  } catch (error) {
    logger.warn('Falha no agente de categorização; aplicando fallback heurístico', {
      error: error instanceof Error ? error.message : String(error),
      rowCount: state.rows.length
    });
    const categorized = fallbackCategorization(state.rows);
    logger.info('Fallback de categorize concluído', {
      problems: categorized.problems.length,
      normal: categorized.normal.length
    });
    return { categorized };
  }
}

export async function suggestSlosNode(state: ObservabilityWorkflowState) {
  if (!state.categorized) {
    throw new Error('Estado inválido: categorized ausente.');
  }

  const modelName = resolveModel('slo');
  logger.info('Etapa slos iniciada', {
    problems: state.categorized.problems.length,
    normal: state.categorized.normal.length,
    model: modelName
  });
  const prompt = await renderPrompt('suggest-slos.prompt.md');
  const model = new BedrockJsonAgent(modelName);

  try {
    const categorizedOccurrences = buildCategorizedOccurrences(state.categorized, state.flowOccurrences);
    const userPrompt = JSON.stringify({
      dashboardTitle: state.dashboardTitle,
      recognizedFlows: state.recognizedFlows,
      categorized: serializeCategorized(state.categorized),
      categorizedOccurrences
    }, null, 2);
    const rawText = await model.callRawText(prompt, userPrompt);
    const rawOutputPath = await persistRawOutput(state.outputDir, '02-slo-suggestions.raw.txt', rawText);
    const parsed = asArray(parseBedrockJsonResponse(rawText))
      .map((item) => SloSuggestionSchema.parse(item))
      .slice(0, 5);
    const normalizedParsed = normalizeSloSuggestions(parsed, state.flowOccurrences, state.env);
    const sloSuggestions = normalizedParsed.length >= 3
      ? normalizedParsed
      : fallbackSlos(state.categorized.problems, state.categorized.normal, state.flowOccurrences, state.env);
    logger.info('Etapa slos concluída', {
      generated: parsed.length,
      returned: sloSuggestions.length,
      rawOutputPath
    });
    return { sloSuggestions };
  } catch (error) {
    logger.warn('Falha no agente de SLOs; aplicando fallback heurístico', {
      error: error instanceof Error ? error.message : String(error),
      categorizedEvents: state.categorized.problems.length + state.categorized.normal.length
    });
    const sloSuggestions = fallbackSlos(state.categorized.problems, state.categorized.normal, state.flowOccurrences, state.env);
    logger.info('Fallback de slos concluído', {
      returned: sloSuggestions.length
    });
    return { sloSuggestions };
  }
}

export async function buildPlanNode(state: ObservabilityWorkflowState) {
  if (!state.categorized) {
    throw new Error('Estado inválido: categorized ausente.');
  }

  const modelName = resolveModel('plan');
  logger.info('Etapa plan iniciada', {
    provider: state.provider,
    categorizedProblems: state.categorized.problems.length,
    categorizedNormal: state.categorized.normal.length,
    sloSuggestions: state.sloSuggestions.length,
    model: modelName
  });
  const prompt = await renderPrompt('build-plan.prompt.md');
  const model = new BedrockJsonAgent(modelName, {
    maxTokens: Number(process.env.ODD_ORCHESTRATION_PLAN_MAX_TOKENS ?? '8000')
  });

  try {
    const flowBlocks = buildFlowBlocks(state.flowOccurrences);
    const userPrompt = JSON.stringify({
      dashboardTitle: state.dashboardTitle,
      provider: state.provider,
      recognizedFlows: state.recognizedFlows,
      rows: state.rows.slice().sort((left, right) => left.ordem - right.ordem),
      flowOccurrences: state.flowOccurrences,
      flowBlocks,
      categorized: serializeCategorized(state.categorized),
      sloSuggestions: state.sloSuggestions
    }, null, 2);
    const rawText = await model.callRawText(prompt, userPrompt);
    const rawOutputPath = await persistRawOutput(state.outputDir, '03-dashboard-plan.raw.txt', rawText);
    const plan = normalizeDashboardPlan(
      DashboardPlanSchema.parse(parseBedrockJsonResponse(rawText)),
      state.rows,
      state.flowOccurrences,
      state.env
    );
    validatePlanCoverage(plan, state.rows, state.flowOccurrences);
    logger.info('Etapa plan concluída', {
      bands: plan.bands.length,
      customEvents: plan.customEvents.length,
      sloSuggestions: plan.sloSuggestions.length,
      rawOutputPath
    });
    return { plan };
  } catch (error) {
    logger.warn('Falha no agente de plano; aplicando fallback determinístico', {
      error: error instanceof Error ? error.message : String(error),
      provider: state.provider
    });
    const plan = fallbackPlan(
      state.dashboardTitle,
      state.categorized.problems,
      state.categorized.normal,
      state.flowOccurrences,
      state.sloSuggestions,
      state.env
    );
    logger.info('Fallback de plan concluído', {
      bands: plan.bands.length,
      customEvents: plan.customEvents.length,
      sloSuggestions: plan.sloSuggestions.length
    });
    return { plan };
  }
}

export async function compileTerraformNode(state: ObservabilityWorkflowState) {
  if (!state.plan) {
    throw new Error('Estado inválido: plan ausente.');
  }

  logger.info('Etapa terraform iniciada', {
    provider: state.provider,
    dashboardKey: state.dashboardKey,
    dashboardTitle: state.plan.dashboardTitle,
    customEvents: state.plan.customEvents.length,
    terraformWorkspaceDir: state.terraformWorkspaceDir
  });
  const dashboardTerraformJson = state.provider === 'dynatrace'
    ? await buildDynatraceDashboardTerraform(state.plan, state.dashboardKey)
    : state.provider === 'grafana'
      ? await buildGrafanaDashboardTerraform(state.plan, state.dashboardKey)
      : await buildDatadogDashboardTerraform(state.plan, state.dashboardKey);

  logger.info('Etapa terraform concluída', {
    provider: state.provider,
    rootKeys: Object.keys(dashboardTerraformJson)
  });
  return { dashboardTerraformJson };
}

export async function compileSloTerraformNode(state: ObservabilityWorkflowState) {
  if (!state.plan) {
    throw new Error('Estado inválido: plan ausente para SLO terraform.');
  }

  logger.info('Etapa slo_terraform iniciada', {
    provider: state.provider,
    dashboardKey: state.dashboardKey,
    sloSuggestions: state.plan.sloSuggestions.length,
    terraformWorkspaceDir: state.terraformWorkspaceDir
  });

  const sloTerraformJson = state.provider === 'datadog'
    ? await buildDatadogSloTerraform(state.plan, state.dashboardKey, state.env)
    : {};
  const terraformJson = mergeTerraformJson(state.dashboardTerraformJson, sloTerraformJson);

  const terraformArtifactPath = await writeTerraformWorkspaceArtifact(
    state.terraformWorkspaceDir,
    state.provider,
    state.dashboardKey,
    terraformJson
  );

  logger.info('Etapa slo_terraform concluída', {
    provider: state.provider,
    hasSloResources: Object.keys(sloTerraformJson).length > 0,
    terraformArtifactPath
  });

  return {
    sloTerraformJson,
    terraformJson
  };
}

export async function applyDatadogNode(state: ObservabilityWorkflowState) {
  if (!state.plan) {
    throw new Error('Estado inválido: plan ausente para apply.');
  }

  if (state.provider !== 'datadog') {
    throw new Error(`Apply no workflow ainda não suportado para provider ${state.provider}.`);
  }

  logger.info('Etapa apply iniciada', {
    provider: state.provider,
    dashboardKey: state.dashboardKey,
    dryRun: state.dryRun,
    customEvents: state.plan.customEvents.length,
    eventBurstConfig: state.eventBurstConfig,
    terraformWorkspaceDir: state.terraformWorkspaceDir
  });

  const eventsFile = path.join(state.outputDir, 'custom-events.json');
  const planFile = path.join(state.outputDir, 'plan.json');
  await ensureDir(state.outputDir);
  await writeFile(eventsFile, `${JSON.stringify(state.plan.customEvents, null, 2)}\n`, 'utf-8');
  await writeJsonFile(planFile, state.plan);

  const applyReport = await applyDatadog({
    dashboardKey: state.dashboardKey,
    terraformDir: state.terraformWorkspaceDir,
    eventsFile,
    planFile,
    outputDir: state.outputDir,
    dryRun: state.dryRun,
    burstConfig: state.eventBurstConfig
  });

  logger.info('Etapa apply concluída', {
    provider: applyReport.provider,
    dryRun: applyReport.dryRun,
    failedEventsCount: applyReport.failedEventsCount,
    terraformError: applyReport.terraformError
  });

  return { applyReport };
}

function resolveModel(kind: 'categorize' | 'slo' | 'plan'): string {
  return process.env[`ODD_ORCHESTRATION_${kind.toUpperCase()}_MODEL`]
    || process.env.ODD_ORCHESTRATION_MODEL
    || process.env.EVENT_STORMING_EXTRACT_MODEL
    || 'amazon.nova-lite-v1:0';
}

function hydrateCategorization(
  result: { problems: Array<{ eventKey: string }>; normal: Array<{ eventKey: string }> },
  rows: EventStormingRow[]
) {
  const byEventKey = new Map(rows.map((row) => [row.eventKey, row]));
  return {
    problems: result.problems.map((item) => {
      const row = byEventKey.get(item.eventKey);
      if (!row) throw new Error(`eventKey desconhecido: ${item.eventKey}`);
      return row;
    }),
    normal: result.normal.map((item) => {
      const row = byEventKey.get(item.eventKey);
      if (!row) throw new Error(`eventKey desconhecido: ${item.eventKey}`);
      return row;
    })
  };
}

function serializeCategorized(categorized: { problems: EventStormingRow[]; normal: EventStormingRow[] }) {
  return {
    problems: categorized.problems,
    normal: categorized.normal
  };
}

function buildCategorizedOccurrences(
  categorized: { problems: EventStormingRow[]; normal: EventStormingRow[] },
  flowOccurrences: FlowOccurrence[]
) {
  const problemKeys = new Set(categorized.problems.map((row) => row.eventKey));
  const normalKeys = new Set(categorized.normal.map((row) => row.eventKey));

  return {
    problems: flowOccurrences.filter((occurrence) => problemKeys.has(occurrence.eventKey)),
    normal: flowOccurrences.filter((occurrence) => normalKeys.has(occurrence.eventKey))
  };
}

function fallbackCategorization(rows: EventStormingRow[]) {
  const problems: EventStormingRow[] = [];
  const normal: EventStormingRow[] = [];

  for (const row of rows.slice().sort((left, right) => left.ordem - right.ordem)) {
    const haystack = `${row.eventKey} ${row.eventTitle} ${row.stage} ${row.tags.join(' ')} ${row.queryHint}`.toLowerCase();
    if (/(error|fail|failure|timeout|rejected|falha|erro|nao|não|alert)/.test(haystack)) {
      problems.push(row);
    } else {
      normal.push(row);
    }
  }

  return {
    problems,
    normal: normal.length > 0 ? normal : rows.slice(0, Math.max(1, rows.length - problems.length))
  };
}

function fallbackSlos(
  problems: EventStormingRow[],
  normal: EventStormingRow[],
  flowOccurrences: FlowOccurrence[],
  env?: string
): SloSuggestion[] {
  const categorizedOccurrences = buildCategorizedOccurrences({ problems, normal }, flowOccurrences);
  const candidates = [
    buildSlo('availability', 'Disponibilidade do fluxo principal', categorizedOccurrences.normal.slice(0, 3), '99.9%', env),
    buildSlo('error_rate', 'Taxa de erro dos eventos problemáticos', categorizedOccurrences.problems.slice(0, 3), '< 1%', env),
    buildSlo('throughput', 'Volume do fluxo saudável', categorizedOccurrences.normal.slice(0, 3), '>= baseline operacional', env),
    buildSlo('latency', 'Latência de confirmação nas etapas finais', categorizedOccurrences.normal.slice(-3), 'p95 < 5m', env),
    buildSlo('availability', 'Cobertura operacional por touch point', [...categorizedOccurrences.normal, ...categorizedOccurrences.problems].slice(0, 3), '99.5%', env)
  ];

  return candidates.filter((item) => item.sourceEventKeys.length > 0).slice(0, 5);
}

function buildSlo(
  sliType: SloSuggestion['sliType'],
  name: string,
  occurrences: FlowOccurrence[],
  target: string,
  env?: string
): SloSuggestion {
  const queryHint = occurrences[0]?.queryHint || buildEventQueryHint('__odd_empty__', env);
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    name,
    objective: name,
    sliType,
    target,
    rationale: 'SLO sugerido a partir dos eventos mais representativos do fluxo.',
    sourceEventKeys: [...new Set(occurrences.map((occurrence) => occurrence.eventKey))],
    sourceOccurrenceKeys: occurrences.map((occurrence) => occurrence.occurrenceKey),
    queryHint
  };
}

function fallbackPlan(
  dashboardTitle: string,
  problems: EventStormingRow[],
  normal: EventStormingRow[],
  flowOccurrences: FlowOccurrence[],
  sloSuggestions: SloSuggestion[],
  env?: string
): DashboardPlan {
  const uniqueRows = [...new Map([...problems, ...normal].map((row) => [row.eventKey, row])).values()];
  return {
    dashboardTitle,
    bands: buildFallbackBands(flowOccurrences, env),
    customEvents: uniqueRows.flatMap((row) => {
      const isProblem = problems.some((item) => item.eventKey === row.eventKey);
      return [
        {
          title: row.eventKey,
          text: `Synthetic event emitted from row ${row.ordem}`,
          tags: [
            `event_key:${row.eventKey}`,
            buildEnvTag(env),
            `stage:${row.stage}`,
            `actor:${row.actor}`,
            `service:${row.service}`,
            ...row.tags,
            'source:odd'
          ],
          alert_type: isProblem ? 'error' : 'success',
          priority: 'normal' as const,
          source_type_name: isProblem ? 'odd-exception' : 'odd-business-event',
          aggregation_key: row.stage
        },
        {
          title: exceptionEventKey(row.eventKey),
          text: `Synthetic exception event emitted from row ${row.ordem}`,
          tags: [
            `event_key:${exceptionEventKey(row.eventKey)}`,
            buildEnvTag(env),
            `stage:${row.stage}`,
            `actor:${row.actor}`,
            `service:${row.service}`,
            ...row.tags.filter((tag) => !tag.startsWith('event_key:')),
            'source:odd'
          ],
          alert_type: 'error' as const,
          priority: 'normal' as const,
          source_type_name: 'odd-exception',
          aggregation_key: row.stage
        }
      ];
    }),
    sloSuggestions,
    assumptions: ['Plano gerado com fallback determinístico após falha ou invalidação da resposta LLM.']
  };
}

function buildFallbackBands(
  flowOccurrences: FlowOccurrence[],
  env?: string
): DashboardPlan['bands'] {
  const bands: DashboardPlan['bands'] = [];
  const grouped = groupOccurrencesByFlow(flowOccurrences);

  for (const group of grouped) {
    bands.push(buildBand(`${group.flowSlug}_negative_kpis`, `${group.flowName} | Negativos | Contadores`, 'problems', group.occurrences, 'query_value', 'alert', env));
    bands.push(buildBand(`${group.flowSlug}_negative_trends`, `${group.flowName} | Negativos | Tendência`, 'problems', group.occurrences, 'timeseries', 'alert', env));
    bands.push(buildBand(`${group.flowSlug}_positive_kpis`, `${group.flowName} | Positivos | Contadores`, 'normal', group.occurrences, 'query_value', 'success', env));
    bands.push(buildBand(`${group.flowSlug}_positive_trends`, `${group.flowName} | Positivos | Tendência`, 'normal', group.occurrences, 'timeseries', 'success', env));
  }

  if (bands.length > 0) {
    return bands;
  }

  return [
    {
      id: 'overview',
      title: 'Overview',
      sectionType: 'normal',
      widgets: [{
        id: 'overview_empty',
        title: 'Sem dados no período',
        widgetType: 'query_value',
        query: buildEventQueryHint('__odd_empty__', env),
        stage: 'overview',
        sectionType: 'normal',
        sourceEventKeys: ['__odd_empty__'],
        visualRole: 'kpi',
        palette: 'neutral'
      }]
    }
  ];
}

function buildBand(
  id: string,
  title: string,
  sectionType: DashboardPlan['bands'][number]['sectionType'],
  occurrences: FlowOccurrence[],
  widgetType: 'query_value' | 'timeseries',
  palette: DashboardPlan['bands'][number]['widgets'][number]['palette'],
  env?: string
): DashboardPlan['bands'][number] {
  const widgets = occurrences.map((occurrence, index) => ({
    id: `${id}_${index + 1}_${occurrence.occurrenceKey}`,
    title: occurrence.flowName
      ? `${occurrence.eventTitle}${sectionType === 'problems' ? ' - Exceções' : ''} | ${occurrence.flowName}`
      : occurrence.eventTitle,
    widgetType,
    query: buildEventQueryHint(sectionType === 'problems' ? exceptionEventKey(occurrence.eventKey) : occurrence.eventKey, env),
    stage: occurrence.stage,
    sectionType,
    sourceEventKeys: [sectionType === 'problems' ? exceptionEventKey(occurrence.eventKey) : occurrence.eventKey],
    sourceOccurrenceKeys: [occurrence.occurrenceKey],
    visualRole: widgetType === 'timeseries' ? 'trend' as const : 'kpi' as const,
    palette
  }));

  return { id, title, sectionType, widgets };
}

function buildFlowBlocks(flowOccurrences: FlowOccurrence[]) {
  return groupOccurrencesByFlow(flowOccurrences).map((group) => ({
    flowName: group.flowName,
    flowSlug: group.flowSlug,
    occurrenceCount: group.occurrences.length,
    occurrences: group.occurrences
  }));
}

function groupOccurrencesByFlow(flowOccurrences: FlowOccurrence[]) {
  const groups = new Map<string, { flowName: string; flowSlug: string; occurrences: FlowOccurrence[] }>();

  for (const occurrence of flowOccurrences) {
    const flowSlug = slugifyFlowName(occurrence.flowName);
    const key = `${occurrence.flowIndex}:${flowSlug}`;
    const current = groups.get(key);
    if (current) {
      current.occurrences.push(occurrence);
      continue;
    }

    groups.set(key, {
      flowName: occurrence.flowName,
      flowSlug,
      occurrences: [occurrence]
    });
  }

  return [...groups.values()];
}

function slugifyFlowName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'fluxo';
}

function normalizeSloSuggestions(
  suggestions: SloSuggestion[],
  flowOccurrences: FlowOccurrence[],
  env?: string
): SloSuggestion[] {
  const occurrencesByEventKey = new Map<string, string[]>();
  for (const occurrence of flowOccurrences) {
    const current = occurrencesByEventKey.get(occurrence.eventKey) ?? [];
    current.push(occurrence.occurrenceKey);
    occurrencesByEventKey.set(occurrence.eventKey, current);
  }

  return suggestions.map((suggestion) => ({
    ...suggestion,
    sourceOccurrenceKeys: suggestion.sourceOccurrenceKeys?.length
      ? suggestion.sourceOccurrenceKeys
      : suggestion.sourceEventKeys.flatMap((eventKey) => occurrencesByEventKey.get(eventKey) ?? []),
    queryHint: buildEventQueryHint(suggestion.sourceEventKeys[0] || '__odd_empty__', env)
  }));
}

function normalizeDashboardPlan(
  plan: DashboardPlan,
  rows: EventStormingRow[],
  flowOccurrences: FlowOccurrence[],
  env?: string
): DashboardPlan {
  const rowByEventKey = new Map(rows.map((row) => [row.eventKey, row]));
  const occurrenceByKey = new Map(flowOccurrences.map((occurrence) => [occurrence.occurrenceKey, occurrence]));

  return {
    ...plan,
    bands: plan.bands.map((band) => ({
      ...band,
      widgets: band.widgets.map((widget) => {
        const sourceOccurrence = (widget.sourceOccurrenceKeys ?? [])
          .map((occurrenceKey) => occurrenceByKey.get(occurrenceKey))
          .find((occurrence): occurrence is FlowOccurrence => Boolean(occurrence));
        const primaryEventKey = widget.sourceEventKeys[0] || sourceOccurrence?.eventKey || '__odd_empty__';
        const sourceRow = widget.sourceEventKeys
          .map((eventKey) => rowByEventKey.get(baseEventKey(eventKey)))
          .find((row): row is EventStormingRow => Boolean(row));

        return {
          ...widget,
          stage: sourceOccurrence?.stage || sourceRow?.stage || widget.stage,
          query: buildEventQueryHint(primaryEventKey, env)
        };
      })
    })),
    customEvents: plan.customEvents.map((event) => ({
      ...event,
      tags: ensurePlanEventTags(event.tags, event.title, event.aggregation_key, env)
    })),
    sloSuggestions: normalizeSloSuggestions(plan.sloSuggestions, flowOccurrences, env)
  };
}

function ensurePlanEventTags(tags: string[], eventKey: string, aggregationKey: string | undefined, env?: string): string[] {
  const merged = new Set<string>([
    `event_key:${eventKey}`,
    buildEnvTag(env),
    ...(aggregationKey ? [`stage:${aggregationKey}`] : []),
    ...tags
  ]);

  return [...merged];
}

function validatePlanCoverage(plan: DashboardPlan, rows: EventStormingRow[], flowOccurrences: FlowOccurrence[]) {
  const expected = new Set(rows.flatMap((row) => [row.eventKey, exceptionEventKey(row.eventKey)]));
  const actual = new Set(plan.customEvents.map((event) => event.title));
  const expectedOccurrences = new Set(flowOccurrences.map((occurrence) => occurrence.occurrenceKey));
  const positiveOccurrences = new Set(
    plan.bands
      .filter((band) => band.sectionType === 'normal')
      .flatMap((band) => band.widgets.flatMap((widget) => widget.sourceOccurrenceKeys ?? []))
  );
  const negativeOccurrences = new Set(
    plan.bands
      .filter((band) => band.sectionType === 'problems')
      .flatMap((band) => band.widgets.flatMap((widget) => widget.sourceOccurrenceKeys ?? []))
  );

  for (const key of expected) {
    if (!actual.has(key)) {
      throw new Error(`Plano não cobre custom event ${key}`);
    }
  }

  if (expectedOccurrences.size > 0) {
    for (const key of expectedOccurrences) {
      if (!positiveOccurrences.has(key)) {
        throw new Error(`Plano não cobre ocorrência positiva ${key}`);
      }
      if (!negativeOccurrences.has(key)) {
        throw new Error(`Plano não cobre ocorrência negativa ${key}`);
      }
    }
  }

  validateBandOrdering(plan, flowOccurrences);
}

function exceptionEventKey(eventKey: string): string {
  return `${baseEventKey(eventKey)}_exception`;
}

function baseEventKey(eventKey: string): string {
  return eventKey.endsWith('_exception') ? eventKey.slice(0, -'_exception'.length) : eventKey;
}

function validateBandOrdering(plan: DashboardPlan, flowOccurrences: FlowOccurrence[]) {
  const expectedOrder = groupOccurrencesByFlow(flowOccurrences).flatMap((group) => ([
    `${group.flowSlug}_negative_kpis`,
    `${group.flowSlug}_negative_trends`,
    `${group.flowSlug}_positive_kpis`,
    `${group.flowSlug}_positive_trends`
  ]));
  const actualOrder = plan.bands.map((band) => band.id);

  if (expectedOrder.length === 0) {
    return;
  }

  if (expectedOrder.length !== actualOrder.length) {
    throw new Error(`Plano contém ${actualOrder.length} bandas, mas eram esperadas ${expectedOrder.length}.`);
  }

  for (let index = 0; index < expectedOrder.length; index += 1) {
    if (expectedOrder[index] !== actualOrder[index]) {
      throw new Error(`Ordem de bandas inválida. Esperado ${expectedOrder[index]} na posição ${index + 1}, recebido ${actualOrder[index]}.`);
    }
  }
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === 'object' && Array.isArray((value as { sloSuggestions?: unknown[] }).sloSuggestions)) {
    return (value as { sloSuggestions: unknown[] }).sloSuggestions;
  }
  throw new Error('Resposta inválida do agente de SLOs.');
}

async function persistRawOutput(outputDir: string, fileName: string, rawText: string): Promise<string> {
  await ensureDir(outputDir);
  const filePath = path.join(outputDir, fileName);
  await writeFile(filePath, `${rawText}\n`, 'utf-8');
  logger.debug('Raw output persistido', {
    filePath,
    textLength: rawText.length
  });
  return filePath;
}
