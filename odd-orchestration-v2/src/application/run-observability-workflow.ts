import path from 'node:path';
import { buildObservabilityWorkflow } from './workflow/build-observability-workflow.js';
import { prepareTerraformWorkspace } from '../infrastructure/terraform/workspace.js';
import { buildDashboardKey } from '../shared/dashboard-identity.js';
import { readPlanningInputContract } from '../shared/input.js';
import { buildFlowOccurrences } from '../shared/flow-occurrences.js';
import { buildEventQueryHint, normalizeEnv } from '../shared/query-hint.js';
import { ensureDir, readJsonFile, writeJsonFile } from '../infrastructure/filesystem/file-system.js';
import { Logger } from '../shared/logger.js';
import { ApplyReport, CategorizedEvents, DashboardPlan, EventBurstConfig, EventStormingRow, FlowOccurrence, RecognizedFlow, SloSuggestion } from '../shared/types.js';
import { WorkflowCliArgs } from '../shared/args.js';

const logger = new Logger('run-observability-workflow');

export async function runObservabilityWorkflow(args: WorkflowCliArgs): Promise<void> {
  const provider = args.provider as 'datadog' | 'dynatrace' | 'grafana';
  const env = normalizeEnv(args.env);
  const preloadedState = await loadPreloadedState(args, env);
  const dashboardTitle = args.dashboardTitle
    || preloadedState.plan?.dashboardTitle
    || inferDashboardTitle(args.input, args.startFrom);
  const dashboardKey = buildDashboardKey({
    dashboardTitle,
    provider,
    explicitKey: args.dashboardKey,
    identitySource: resolveDashboardIdentitySource(args)
  });
  const inputName = resolveInputName(args);
  const runId = buildRunId();
  const outputDir = path.resolve(process.cwd(), args.output, dashboardKey, runId);
  const terraformWorkspaceDir = path.resolve(process.cwd(), args.output, 'terraform-workspaces', provider, dashboardKey);

  await ensureDir(outputDir);
  await prepareTerraformWorkspace(provider, terraformWorkspaceDir);

  logger.info('Iniciando workflow v2', {
    input: args.input,
    dashboardTitle,
    dashboardKey,
    provider,
    env,
    outputDir,
    terraformWorkspaceDir,
    startFrom: args.startFrom,
    endAt: args.endAt,
    dryRun: args.dryRun,
    eventBurstConfig: resolveBurstArgs(args)
  });

  const workflow = buildObservabilityWorkflow();
  const result = await workflow.invoke({
    dashboardKey,
    input: args.input ? path.resolve(process.cwd(), args.input) : '',
    env,
    dashboardTitle,
    provider,
    outputDir,
    terraformWorkspaceDir,
    dryRun: args.dryRun,
    eventBurstConfig: resolveBurstArgs(args),
    startFrom: args.startFrom,
    endAt: args.endAt,
    rows: preloadedState.rows,
    recognizedFlows: preloadedState.recognizedFlows,
    flowOccurrences: preloadedState.flowOccurrences,
    categorized: preloadedState.categorized,
    sloSuggestions: preloadedState.sloSuggestions,
    plan: preloadedState.plan,
    dashboardTerraformJson: null,
    sloTerraformJson: null
  });

  await persistArtifacts(outputDir, provider, inputName, dashboardTitle, dashboardKey, terraformWorkspaceDir, result);

  logger.info('Workflow v2 finalizado', {
    outputDir,
    dashboardKey,
    terraformWorkspaceDir,
    provider,
    env,
    rowCount: result.rows.length,
    startFrom: args.startFrom,
    endAt: args.endAt,
    dryRun: args.dryRun,
    hasApplyReport: Boolean(result.applyReport)
  });
}

function buildRunId(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function resolveBurstArgs(args: WorkflowCliArgs): Partial<EventBurstConfig> {
  return {
    burstCount: args.burstCount,
    burstIntervalMs: args.burstIntervalMs,
    copiesPerEvent: args.copiesPerEvent,
    randomizeEventCounts: args.randomizeEventCounts,
    randomSeed: args.randomizeEventCounts ? Date.now() : undefined
  };
}

async function loadPreloadedState(
  args: WorkflowCliArgs,
  env: string
): Promise<{
  rows: EventStormingRow[];
  recognizedFlows: RecognizedFlow[];
  flowOccurrences: FlowOccurrence[];
  categorized: CategorizedEvents | null;
  sloSuggestions: SloSuggestion[];
  plan: DashboardPlan | null;
}> {
  if (args.startFrom === 'input') {
    return { rows: [], recognizedFlows: [], flowOccurrences: [], categorized: null, sloSuggestions: [], plan: null };
  }

  if (args.startFrom === 'categorize') {
    if (args.rowsFile) {
      return {
        rows: await readJsonFile<EventStormingRow[]>(args.rowsFile),
        recognizedFlows: [],
        flowOccurrences: [],
        categorized: null,
        sloSuggestions: [],
        plan: null
      };
    }

    if (!args.input) {
      throw new Error('Use --input ou --rows-file para iniciar em categorize.');
    }

    const planningInput = await readPlanningInputContract(path.resolve(process.cwd(), args.input), env);
    return {
      rows: planningInput.rows,
      recognizedFlows: planningInput.recognizedFlows,
      flowOccurrences: buildFlowOccurrences(planningInput.rows, planningInput.recognizedFlows),
      categorized: null,
      sloSuggestions: [],
      plan: null
    };
  }

  if (args.startFrom === 'slos' || args.startFrom === 'plan') {
    if (!args.categorizedFile) {
      throw new Error(`Use --categorized-file para iniciar em ${args.startFrom}.`);
    }

    const categorized = await readJsonFile<CategorizedEvents>(args.categorizedFile);
    let rows = [...categorized.problems, ...categorized.normal]
      .slice()
      .sort((left, right) => left.ordem - right.ordem);
    let recognizedFlows: RecognizedFlow[] = [];
    let flowOccurrences: FlowOccurrence[] = [];

    if (args.input) {
      const planningInput = await readPlanningInputContract(path.resolve(process.cwd(), args.input), env);
      rows = planningInput.rows;
      recognizedFlows = planningInput.recognizedFlows;
      flowOccurrences = buildFlowOccurrences(rows, recognizedFlows);
    }

    return {
      rows,
      recognizedFlows,
      flowOccurrences,
      categorized,
      sloSuggestions: args.sloFile ? await readJsonFile<SloSuggestion[]>(args.sloFile) : [],
      plan: null
    };
  }

  if (!args.planFile) {
    throw new Error(`Use --plan-file para iniciar em ${args.startFrom}.`);
  }

  const plan = await readJsonFile<DashboardPlan>(args.planFile);
  const rows = plan.customEvents.map((event, index) => ({
    ordem: index + 1,
    eventKey: event.title,
    eventTitle: event.title,
    stage: event.aggregation_key ?? 'overview',
    actor: 'system',
    service: 'event.storming',
    tags: event.tags,
    dashboardWidget: 'event_stream' as const,
    queryHint: buildEventQueryHint(event.title, env)
  }));

  return {
    rows,
    recognizedFlows: [],
    flowOccurrences: [],
    categorized: null,
    sloSuggestions: plan.sloSuggestions,
    plan
  };
}

async function persistArtifacts(
  outputDir: string,
  provider: 'datadog' | 'dynatrace' | 'grafana',
  inputName: string,
  dashboardTitle: string,
  dashboardKey: string,
  terraformWorkspaceDir: string,
  result: {
    rows: EventStormingRow[];
    categorized: CategorizedEvents | null;
    sloSuggestions: SloSuggestion[];
    plan: DashboardPlan | null;
    dashboardTerraformJson: Record<string, unknown> | null;
    sloTerraformJson: Record<string, unknown> | null;
    terraformJson: Record<string, unknown> | null;
    applyReport: ApplyReport | null;
  }
) {
  if (result.rows.length > 0) {
    await writeJsonFile(path.join(outputDir, 'rows.json'), result.rows);
  }
  await writeJsonFile(path.join(outputDir, 'dashboard-metadata.json'), {
    dashboardKey,
    dashboardTitle: result.plan?.dashboardTitle ?? dashboardTitle,
    provider,
    inputName,
    terraformWorkspaceDir
  });
  if (result.categorized) {
    await writeJsonFile(path.join(outputDir, 'categorized-events.json'), result.categorized);
  }
  if (result.sloSuggestions.length > 0) {
    await writeJsonFile(path.join(outputDir, 'slo-suggestions.json'), result.sloSuggestions);
  }
  if (result.plan) {
    await writeJsonFile(path.join(outputDir, 'plan.json'), result.plan);
    await writeJsonFile(path.join(outputDir, 'custom-events.json'), result.plan.customEvents);
  }
  if (result.dashboardTerraformJson) {
    await writeJsonFile(path.join(outputDir, `${provider}-dashboard.auto.tf.json`), result.dashboardTerraformJson);
  }
  if (result.sloTerraformJson && Object.keys(result.sloTerraformJson).length > 0) {
    await writeJsonFile(path.join(outputDir, `${provider}-slos.auto.tf.json`), result.sloTerraformJson);
  }
  if (result.terraformJson) {
    await writeJsonFile(path.join(outputDir, `${provider}-bundle.auto.tf.json`), result.terraformJson);
    await writeJsonFile(
      path.join(terraformWorkspaceDir, 'generated', `${provider}-${dashboardKey}-dashboard.auto.tf.json`),
      result.terraformJson
    );
  }
  if (result.applyReport) {
    await writeJsonFile(path.join(outputDir, 'apply-report.json'), result.applyReport);
  }
}

function inferDashboardTitle(input: string | undefined, startFrom: string): string {
  if (input) {
    return path.basename(input, path.extname(input));
  }
  return `odd-${startFrom}`;
}

function resolveDashboardIdentitySource(args: WorkflowCliArgs): string | undefined {
  return args.input || args.rowsFile || args.categorizedFile || args.sloFile || args.planFile;
}

function resolveInputName(args: WorkflowCliArgs): string {
  const candidate = args.input || args.rowsFile || args.categorizedFile || args.sloFile || args.planFile;
  return candidate ? path.basename(candidate) : 'manual';
}
