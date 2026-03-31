import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { applyDatadog } from '../../agents/applier/index.js';
import { buildDatadogDashboardTerraform } from '../../agents/workflow/datadogTf.js';
import { buildDynatraceDashboardTerraform } from '../../agents/workflow/dynatraceTf.js';
import { buildGrafanaDashboardTerraform } from '../../agents/workflow/grafanaTf.js';
import { DashboardPlanSchema, CategorizedEventsSchema, SloSuggestionSchema } from '../../domain/contracts.js';
import { BedrockJsonAgent, parseBedrockJsonResponse } from '../../infrastructure/llm/bedrock-json-agent.js';
import { writeTerraformWorkspaceArtifact } from '../../infrastructure/terraform/workspace.js';
import { ensureDir } from '../../shared/fs.js';
import { readPlanningInput } from '../../shared/input.js';
import { Logger } from '../../shared/logger.js';
import { DashboardPlan, EventStormingRow, SloSuggestion } from '../../shared/types.js';
import { ObservabilityWorkflowState } from './state.js';

const logger = new Logger('observability-workflow');
const workflowPromptDir = path.resolve(process.cwd(), 'src/agents/workflow');

export async function loadInputNode(state: ObservabilityWorkflowState) {
  logger.info('Etapa input iniciada', {
    input: state.input,
    outputDir: state.outputDir
  });
  const rows = await readPlanningInput(state.input);
  logger.info('Etapa input concluída', {
    input: state.input,
    rowCount: rows.length
  });
  return { rows };
}

export async function categorizeEventsNode(state: ObservabilityWorkflowState) {
  const modelName = resolveModel('categorize');
  logger.info('Etapa categorize iniciada', {
    rowCount: state.rows.length,
    model: modelName
  });
  const prompt = await loadPrompt('categorizeEvents.prompt.md');
  const model = new BedrockJsonAgent(modelName);

  try {
    const userPrompt = JSON.stringify({ rows: state.rows }, null, 2);
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
  const prompt = await loadPrompt('suggestSlos.prompt.md');
  const model = new BedrockJsonAgent(modelName);

  try {
    const userPrompt = JSON.stringify({
      dashboardTitle: state.dashboardTitle,
      categorized: serializeCategorized(state.categorized)
    }, null, 2);
    const rawText = await model.callRawText(prompt, userPrompt);
    const rawOutputPath = await persistRawOutput(state.outputDir, '02-slo-suggestions.raw.txt', rawText);
    const parsed = asArray(parseBedrockJsonResponse(rawText)).map((item) => SloSuggestionSchema.parse(item)).slice(0, 5);
    const sloSuggestions = parsed.length >= 3 ? parsed : fallbackSlos(state.categorized.problems, state.categorized.normal);
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
    const sloSuggestions = fallbackSlos(state.categorized.problems, state.categorized.normal);
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
  const prompt = await loadPrompt('buildPlan.prompt.md');
  const model = new BedrockJsonAgent(modelName);

  try {
    const userPrompt = JSON.stringify({
      dashboardTitle: state.dashboardTitle,
      provider: state.provider,
      categorized: serializeCategorized(state.categorized),
      sloSuggestions: state.sloSuggestions
    }, null, 2);
    const rawText = await model.callRawText(prompt, userPrompt);
    const rawOutputPath = await persistRawOutput(state.outputDir, '03-dashboard-plan.raw.txt', rawText);
    const plan = DashboardPlanSchema.parse(parseBedrockJsonResponse(rawText));
    validatePlanCoverage(plan, state.rows);
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
    const plan = fallbackPlan(state.dashboardTitle, state.categorized.problems, state.categorized.normal, state.sloSuggestions);
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
  const terraformJson = state.provider === 'dynatrace'
    ? await buildDynatraceDashboardTerraform(state.plan, state.dashboardKey)
    : state.provider === 'grafana'
      ? await buildGrafanaDashboardTerraform(state.plan, state.dashboardKey)
      : await buildDatadogDashboardTerraform(state.plan, state.dashboardKey);

  const terraformArtifactPath = await writeTerraformWorkspaceArtifact(
    state.terraformWorkspaceDir,
    state.provider,
    state.dashboardKey,
    terraformJson
  );

  logger.info('Etapa terraform concluída', {
    provider: state.provider,
    rootKeys: Object.keys(terraformJson),
    terraformArtifactPath
  });
  return { terraformJson };
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
  await ensureDir(state.outputDir);
  await writeFile(eventsFile, `${JSON.stringify(state.plan.customEvents, null, 2)}\n`, 'utf-8');

  const applyReport = await applyDatadog({
    dashboardKey: state.dashboardKey,
    terraformDir: state.terraformWorkspaceDir,
    eventsFile,
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

async function loadPrompt(fileName: string): Promise<string> {
  const filePath = path.join(workflowPromptDir, fileName);
  logger.debug('Carregando prompt', { filePath });
  return readFile(filePath, 'utf-8');
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

function fallbackSlos(problems: EventStormingRow[], normal: EventStormingRow[]): SloSuggestion[] {
  const candidates = [
    buildSlo('availability', 'Disponibilidade do fluxo principal', [...problems, ...normal].slice(0, 3), '99.9%'),
    buildSlo('error_rate', 'Taxa de erro dos eventos problemáticos', problems.slice(0, 3), '< 1%'),
    buildSlo('throughput', 'Volume do fluxo saudável', normal.slice(0, 3), '>= baseline operacional'),
    buildSlo('latency', 'Latência de confirmação nas etapas finais', [...problems, ...normal].slice(-3), 'p95 < 5m'),
    buildSlo('availability', 'Cobertura operacional por touch point', [...normal, ...problems].slice(0, 3), '99.5%')
  ];

  return candidates.filter((item) => item.sourceEventKeys.length > 0).slice(0, 5);
}

function buildSlo(
  sliType: SloSuggestion['sliType'],
  name: string,
  rows: EventStormingRow[],
  target: string
): SloSuggestion {
  const queryHint = rows[0]?.queryHint || 'tags:(source:odd)';
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    name,
    objective: name,
    sliType,
    target,
    rationale: 'SLO sugerido a partir dos eventos mais representativos do fluxo.',
    sourceEventKeys: rows.map((row) => row.eventKey),
    queryHint
  };
}

function fallbackPlan(
  dashboardTitle: string,
  problems: EventStormingRow[],
  normal: EventStormingRow[],
  sloSuggestions: SloSuggestion[]
): DashboardPlan {
  const heroProblem = problems[0];
  const heroNormal = normal[0];

  return {
    dashboardTitle,
    bands: [
      {
        id: 'hero_alert',
        title: 'Hero Alert',
        sectionType: heroProblem ? 'problems' : 'normal',
        widgets: [{
          id: 'hero_alert_primary',
          title: heroProblem ? `${heroProblem.eventTitle} nos últimos 5m` : 'Sem falhas críticas no período',
          widgetType: 'query_value',
          query: heroProblem?.queryHint || heroNormal?.queryHint || 'tags:(source:odd)',
          stage: heroProblem?.stage || heroNormal?.stage || 'overview',
          sectionType: heroProblem ? 'problems' : 'normal',
          sourceEventKeys: [heroProblem?.eventKey || heroNormal?.eventKey || 'overview'],
          visualRole: 'hero_alert',
          palette: heroProblem ? 'alert' : 'success',
          thresholdValue: heroProblem ? 0 : 1,
          thresholdDirection: heroProblem ? 'above_bad' : 'at_least_good'
        }]
      },
      buildBand('failure_kpis', 'Falhas por evento', 'problems', problems, 'query_value', 'alert'),
      buildBand('failure_trends', 'Falhas por etapa', 'problems', problems, 'timeseries', 'alert'),
      buildBand('success_kpis', 'Sucessos por evento', 'normal', normal, 'query_value', 'success'),
      buildBand('success_trends', 'Sucessos por etapa', 'normal', normal, 'timeseries', 'success')
    ],
    customEvents: [...problems, ...normal].map((row) => ({
      title: row.eventKey,
      text: `Synthetic event emitted from row ${row.ordem}`,
      tags: [
        `event_key:${row.eventKey}`,
        `stage:${row.stage}`,
        `actor:${row.actor}`,
        `service:${row.service}`,
        ...row.tags,
        'source:odd'
      ],
      alert_type: problems.some((item) => item.eventKey === row.eventKey) ? 'error' : 'success',
      priority: 'normal',
      source_type_name: problems.some((item) => item.eventKey === row.eventKey) ? 'odd-exception' : 'odd-business-event',
      aggregation_key: row.stage
    })),
    sloSuggestions,
    assumptions: ['Plano gerado com fallback determinístico após falha ou invalidação da resposta LLM.']
  };
}

function buildBand(
  id: DashboardPlan['bands'][number]['id'],
  title: string,
  sectionType: DashboardPlan['bands'][number]['sectionType'],
  rows: EventStormingRow[],
  widgetType: 'query_value' | 'timeseries',
  palette: DashboardPlan['bands'][number]['widgets'][number]['palette']
): DashboardPlan['bands'][number] {
  const widgets = rows.slice(0, 3).map((row, index) => ({
    id: `${id}_${index + 1}_${row.eventKey}`,
    title: row.eventTitle,
    widgetType,
    query: row.queryHint,
    stage: row.stage,
    sectionType,
    sourceEventKeys: [row.eventKey],
    visualRole: widgetType === 'timeseries' ? 'trend' as const : 'kpi' as const,
    palette
  }));

  return { id, title, sectionType, widgets };
}

function validatePlanCoverage(plan: DashboardPlan, rows: EventStormingRow[]) {
  const expected = new Set(rows.map((row) => row.eventKey));
  const actual = new Set(plan.customEvents.map((event) => event.title));

  for (const key of expected) {
    if (!actual.has(key)) {
      throw new Error(`Plano não cobre custom event ${key}`);
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
