import path from 'node:path';
import { parseArgs, requireStringArg } from '../../shared/cli.js';
import { ensureDir, readJsonFile, writeJsonFile } from '../../shared/fs.js';
import { parseProvider } from '../../shared/provider.js';
import { Logger } from '../../shared/logger.js';
import { loadDotEnv } from '../../infrastructure/env/load-dot-env.js';
import { buildObservabilityWorkflow } from '../../application/workflow/build-observability-workflow.js';
import { prepareTerraformWorkspace } from '../../infrastructure/terraform/workspace.js';
import { buildDashboardKey } from '../../shared/dashboard-identity.js';
import { buildEventQueryHint, normalizeEnv } from '../../shared/query-hint.js';
import { readPlanningInput } from '../../shared/input.js';
import { CategorizedEvents, DashboardPlan, DatadogApplyReport, EventBurstConfig, EventStormingRow, SloSuggestion } from '../../shared/types.js';

const logger = new Logger('workflow-entrypoint');

function buildRunId(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function main() {
  loadDotEnv();

  const args = parseArgs(process.argv.slice(2));
  const provider = parseProvider(args.provider);
  const startFrom = parseStepArg(args['start-from'], 'input');
  const endAt = parseStepArg(args['end-at'], provider === 'datadog' ? 'apply' : 'terraform');
  const dryRun = args['dry-run'] === true;
  const env = normalizeEnv(typeof args.env === 'string' ? args.env : undefined);
  const eventBurstConfig = resolveBurstArgs(args);
  const baseOutput = typeof args.output === 'string' ? args.output : './generated';
  const input = typeof args.input === 'string' ? args.input : undefined;
  const preloadedState = await loadPreloadedState(args, startFrom, input, env);
  const dashboardTitle = typeof args['dashboard-title'] === 'string'
    ? args['dashboard-title']
    : preloadedState.plan?.dashboardTitle
      || inferDashboardTitle(input, startFrom);
  const dashboardKey = buildDashboardKey({
    dashboardTitle,
    provider,
    explicitKey: typeof args['dashboard-key'] === 'string' ? args['dashboard-key'] : undefined,
    identitySource: resolveDashboardIdentitySource(args, input, startFrom)
  });
  const inputName = resolveInputName(input, args, startFrom);
  const runId = buildRunId();
  const outputDir = path.resolve(process.cwd(), baseOutput, dashboardKey, runId);
  const terraformWorkspaceDir = path.resolve(process.cwd(), baseOutput, 'terraform-workspaces', provider, dashboardKey);
  await ensureDir(outputDir);
  await prepareTerraformWorkspace(provider, terraformWorkspaceDir);

  if (endAt === 'apply' && provider !== 'datadog') {
    throw new Error(`Etapa apply no workflow ainda não suportada para provider ${provider}.`);
  }

  logger.info('Iniciando workflow v2', {
    input,
    dashboardTitle,
    dashboardKey,
    provider,
    env,
    outputDir,
    terraformWorkspaceDir,
    startFrom,
    endAt,
    dryRun,
    eventBurstConfig
  });
  logger.debug('Estado pré-carregado resolvido', {
    preloadedRows: preloadedState.rows.length,
    hasCategorized: Boolean(preloadedState.categorized),
    preloadedSlos: preloadedState.sloSuggestions.length,
    hasPlan: Boolean(preloadedState.plan)
  });

  const workflow = buildObservabilityWorkflow();
  const result = await workflow.invoke({
    dashboardKey,
    input: input ? path.resolve(process.cwd(), input) : '',
    dashboardTitle,
    provider,
    env,
    outputDir,
    terraformWorkspaceDir,
    dryRun,
    eventBurstConfig,
    startFrom,
    endAt,
    rows: preloadedState.rows,
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
    rowCount: result.rows.length,
    startFrom,
    endAt,
    dryRun,
    env,
    hasApplyReport: Boolean(result.applyReport)
  });
}

function resolveBurstArgs(args: Record<string, string | boolean>): Partial<EventBurstConfig> {
  return {
    burstCount: parseOptionalIntegerArg(args, 'burst-count'),
    burstIntervalMs: parseOptionalIntegerArg(args, 'burst-interval-ms'),
    copiesPerEvent: parseOptionalIntegerArg(args, 'copies-per-event')
  };
}

function parseOptionalIntegerArg(args: Record<string, string | boolean>, key: string): number | undefined {
  const value = args[key];
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Valor inválido para --${key}: ${value}`);
  }

  return parsed;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

function parseStepArg(
  value: string | boolean | undefined,
  fallback: 'input' | 'categorize' | 'slos' | 'plan' | 'terraform' | 'apply'
): 'input' | 'categorize' | 'slos' | 'plan' | 'terraform' | 'apply' {
  if (typeof value !== 'string' || value.trim() === '') {
    return fallback;
  }

  if (value === 'input' || value === 'categorize' || value === 'slos' || value === 'plan' || value === 'terraform' || value === 'apply') {
    return value;
  }

  throw new Error(`Etapa inválida: ${value}`);
}

async function loadPreloadedState(
  args: Record<string, string | boolean>,
  startFrom: 'input' | 'categorize' | 'slos' | 'plan' | 'terraform' | 'apply',
  input?: string,
  env?: string
): Promise<{
  rows: EventStormingRow[];
  categorized: CategorizedEvents | null;
  sloSuggestions: SloSuggestion[];
  plan: DashboardPlan | null;
}> {
  logger.debug('Resolvendo preload do workflow', {
    startFrom,
    hasInput: Boolean(input),
    hasRowsFile: typeof args['rows-file'] === 'string',
    hasCategorizedFile: typeof args['categorized-file'] === 'string',
    hasSloFile: typeof args['slo-file'] === 'string',
    hasPlanFile: typeof args['plan-file'] === 'string'
  });
  if (startFrom === 'input') {
    return { rows: [], categorized: null, sloSuggestions: [], plan: null };
  }

  if (startFrom === 'categorize') {
    if (typeof args['rows-file'] === 'string') {
      return {
        rows: await readJsonFile<EventStormingRow[]>(args['rows-file']),
        categorized: null,
        sloSuggestions: [],
        plan: null
      };
    }

    if (!input) {
      throw new Error('Use --input ou --rows-file para iniciar em categorize.');
    }

    return {
      rows: await readPlanningInput(path.resolve(process.cwd(), input), env),
      categorized: null,
      sloSuggestions: [],
      plan: null
    };
  }

  if (startFrom === 'slos' || startFrom === 'plan') {
    const categorizedFile = typeof args['categorized-file'] === 'string' ? args['categorized-file'] : '';
    if (categorizedFile === '') {
      throw new Error(`Use --categorized-file para iniciar em ${startFrom}.`);
    }

    const categorized = await readJsonFile<CategorizedEvents>(categorizedFile);
    const rows = [...categorized.problems, ...categorized.normal]
      .slice()
      .sort((left, right) => left.ordem - right.ordem);
    const sloSuggestions = typeof args['slo-file'] === 'string'
      ? await readJsonFile<SloSuggestion[]>(args['slo-file'])
      : [];

    return {
      rows,
      categorized,
      sloSuggestions,
      plan: null
    };
  }

  const planFile = typeof args['plan-file'] === 'string' ? args['plan-file'] : '';
  if (planFile === '') {
    throw new Error(`Use --plan-file para iniciar em ${startFrom}.`);
  }

  const plan = await readJsonFile<DashboardPlan>(planFile);
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
    applyReport: DatadogApplyReport | null;
  }
) {
  if (result.rows.length > 0) {
    logger.debug('Persistindo rows.json', { outputDir, rowCount: result.rows.length });
    await writeJsonFile(path.join(outputDir, 'rows.json'), result.rows);
  }
  await writeJsonFile(path.join(outputDir, 'dashboard-metadata.json'), {
    dashboardKey,
    dashboardTitle: result.plan?.dashboardTitle ?? dashboardTitle,
    provider,
    terraformWorkspaceDir
  });
  if (result.categorized) {
    logger.debug('Persistindo categorized-events.json', {
      outputDir,
      problems: result.categorized.problems.length,
      normal: result.categorized.normal.length
    });
    await writeJsonFile(path.join(outputDir, 'categorized-events.json'), result.categorized);
  }
  if (result.sloSuggestions.length > 0) {
    logger.debug('Persistindo slo-suggestions.json', {
      outputDir,
      sloSuggestions: result.sloSuggestions.length
    });
    await writeJsonFile(path.join(outputDir, 'slo-suggestions.json'), result.sloSuggestions);
  }
  if (result.plan) {
    logger.debug('Persistindo plan.json e custom-events.json', {
      outputDir,
      customEvents: result.plan.customEvents.length
    });
    await writeJsonFile(path.join(outputDir, 'plan.json'), result.plan);
    await writeJsonFile(path.join(outputDir, 'custom-events.json'), result.plan.customEvents);
  }
  if (result.dashboardTerraformJson) {
    logger.debug('Persistindo Terraform compilado', {
      outputDir,
      provider,
      terraformWorkspaceDir,
      inputName,
      dashboardKey
    });
    await writeJsonFile(path.join(outputDir, `${provider}-dashboard.auto.tf.json`), result.dashboardTerraformJson);
  }
  if (result.sloTerraformJson && Object.keys(result.sloTerraformJson).length > 0) {
    logger.debug('Persistindo Terraform de SLOs', {
      outputDir,
      provider,
      dashboardKey
    });
    await writeJsonFile(path.join(outputDir, `${provider}-slos.auto.tf.json`), result.sloTerraformJson);
  }
  if (result.terraformJson) {
    logger.debug('Persistindo bundle Terraform compilado', {
      outputDir,
      provider,
      dashboardKey
    });
    await writeJsonFile(path.join(outputDir, `${provider}-bundle.auto.tf.json`), result.terraformJson);
    await writeJsonFile(
      path.join(terraformWorkspaceDir, 'generated', `${provider}-${dashboardKey}-dashboard.auto.tf.json`),
      result.terraformJson
    );
  }
  if (result.applyReport) {
    logger.debug('Persistindo apply-report.json do workflow', {
      outputDir,
      failedEventsCount: result.applyReport.failedEventsCount
    });
    await writeJsonFile(path.join(outputDir, 'apply-report.json'), result.applyReport);
  }
}

function inferDashboardTitle(input: string | undefined, startFrom: string): string {
  if (input) {
    return path.basename(input, path.extname(input));
  }
  return `odd-${startFrom}`;
}

function resolveDashboardIdentitySource(
  args: Record<string, string | boolean>,
  input: string | undefined,
  startFrom: string
): string {
  const sources = [
    input,
    typeof args['rows-file'] === 'string' ? args['rows-file'] : undefined,
    typeof args['categorized-file'] === 'string' ? args['categorized-file'] : undefined,
    typeof args['slo-file'] === 'string' ? args['slo-file'] : undefined,
    typeof args['plan-file'] === 'string' ? args['plan-file'] : undefined,
    startFrom
  ].filter((value): value is string => typeof value === 'string' && value.trim() !== '');

  return sources.join('|');
}

function resolveInputName(
  input: string | undefined,
  args: Record<string, string | boolean>,
  startFrom: string
): string {
  const source = input
    || (typeof args['rows-file'] === 'string' ? args['rows-file'] : '')
    || (typeof args['categorized-file'] === 'string' ? args['categorized-file'] : '')
    || (typeof args['plan-file'] === 'string' ? args['plan-file'] : '')
    || startFrom;

  return path.basename(source, path.extname(source));
}
