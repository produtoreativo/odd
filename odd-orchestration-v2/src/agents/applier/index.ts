import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, requireStringArg } from '../../shared/cli.js';
import { loadDotEnv } from '../../infrastructure/env/load-dot-env.js';
import { ensureDir, writeJsonFile } from '../../shared/fs.js';
import { normalizeDashboardSlug } from '../../shared/dashboard-identity.js';
import { Logger } from '../../shared/logger.js';
import { ingestEvents, ingestSloMetrics } from './datadog.js';
import { ingestEvents as ingestDynatraceEvents } from './dynatrace.js';
import { runTerraform } from './terraform.js';
import { ApplyReport, DatadogApplyReport, EventBurstConfig, TerraformApplyReport } from '../../shared/types.js';
import { parseProvider } from '../../shared/provider.js';

const logger = new Logger('applier-entrypoint');

async function main(): Promise<void> {
  loadDotEnv();

  const args = parseArgs(process.argv.slice(2));
  const provider = parseProvider(args.provider);
  const explicitDashboardKey = typeof args['dashboard-key'] === 'string' && args['dashboard-key'].trim() !== ''
    ? normalizeDashboardSlug(args['dashboard-key'])
    : undefined;
  const terraformDir = typeof args['terraform-dir'] === 'string'
    ? args['terraform-dir']
    : explicitDashboardKey
      ? `./generated/terraform-workspaces/${provider}/${explicitDashboardKey}`
      : provider === 'dynatrace'
        ? './terraform-dynatrace'
        : provider === 'grafana'
          ? './terraform-grafana'
          : './terraform';
  const eventsFile = (provider === 'datadog' || provider === 'dynatrace') ? requireStringArg(args, 'events-file') : undefined;
  const planFile = typeof args['plan-file'] === 'string' ? args['plan-file'] : undefined;
  const dryRun = args['dry-run'] === true;
  const outputDir = typeof args.output === 'string'
    ? args.output
    : './generated/apply';
  const dashboardKey = explicitDashboardKey
    ? explicitDashboardKey
    : normalizeDashboardSlug(path.basename(path.resolve(terraformDir)));
  const burstConfig = resolveBurstArgs(args);

  const report = provider === 'datadog'
    ? await applyDatadog({
      dashboardKey,
      terraformDir,
      eventsFile: eventsFile!,
      planFile,
      outputDir,
      dryRun,
      burstConfig
    })
    : provider === 'dynatrace'
      ? await applyDynatrace({
        dashboardKey,
        terraformDir,
        eventsFile: eventsFile!,
        outputDir,
        dryRun
      })
    : await applyTerraformOnly({
      provider,
      dashboardKey,
      terraformDir,
      outputDir,
      dryRun
    });

  if (
    report.terraformError
    || (report.provider === 'datadog' && (report.failedEventsCount > 0 || report.failedMetricsCount > 0))
    || (report.provider !== 'datadog' && (report.failedEventsCount ?? 0) > 0)
  ) {
    process.exitCode = 1;
  }
}

export async function applyDatadog(args: {
  dashboardKey: string;
  terraformDir: string;
  eventsFile: string;
  planFile?: string;
  outputDir: string;
  dryRun: boolean;
  burstConfig?: Partial<EventBurstConfig>;
}): Promise<DatadogApplyReport> {
  await ensureDir(args.outputDir);
  logger.info('Iniciando applier Datadog', args);

  let terraformCommands: string[] = [];
  let terraformError: string | undefined;

  try {
    logger.info('Executando etapa terraform do applier', { terraformDir: args.terraformDir, dryRun: args.dryRun });
    terraformCommands = await runTerraform(args.terraformDir, args.dryRun, 'datadog');
    logger.info('Etapa terraform do applier concluída', { commands: terraformCommands });
  } catch (error) {
    terraformError = error instanceof Error ? error.message : String(error);
    logger.error('Etapa terraform do applier falhou', { terraformError });
  }

  logger.info('Executando ingestão de eventos Datadog', { eventsFile: args.eventsFile, dryRun: args.dryRun });
  const ingestion = await ingestEvents(args.eventsFile, args.dryRun, args.burstConfig);
  const failedEventsCount = ingestion.results.filter((event) => event.status === 'failed').length;
  logger.info('Ingestão de eventos concluída', {
    ingestedEvents: ingestion.results.length,
    scheduledEventsCount: ingestion.scheduledEventsCount,
    failedEventsCount
  });

  logger.info('Executando ingestão de métricas de SLO', {
    planFile: args.planFile,
    dryRun: args.dryRun
  });
  const metricIngestion = await ingestSloMetrics({
    dashboardKey: args.dashboardKey,
    planFile: args.planFile,
    dryRun: args.dryRun,
    burstConfig: args.burstConfig
  });
  const failedMetricsCount = metricIngestion.results.filter((metric) => metric.status === 'failed').length;
  logger.info('Ingestão de métricas concluída', {
    ingestedMetrics: metricIngestion.results.length,
    failedMetricsCount
  });

  const report: DatadogApplyReport = {
    provider: 'datadog',
    dashboardKey: args.dashboardKey,
    dryRun: args.dryRun,
    terraformDir: path.resolve(args.terraformDir),
    eventsFile: path.resolve(args.eventsFile),
    burstConfig: ingestion.burstConfig,
    scheduledEventsCount: ingestion.scheduledEventsCount,
    terraformCommands,
    terraformError,
    failedEventsCount,
    ingestedEvents: ingestion.results,
    failedMetricsCount,
    ingestedMetrics: metricIngestion.results
  };

  const reportPath = path.join(args.outputDir, 'apply-report.json');
  await writeJsonFile(reportPath, report);

  logger.info('Applier Datadog finalizado', {
    reportPath,
    terraformError,
    failedEventsCount,
    failedMetricsCount,
    terraformCommandsCount: terraformCommands.length
  });

  return report;
}

export async function applyTerraformOnly(args: {
  provider: 'dynatrace' | 'grafana';
  dashboardKey: string;
  terraformDir: string;
  outputDir: string;
  dryRun: boolean;
}): Promise<TerraformApplyReport> {
  await ensureDir(args.outputDir);
  logger.info('Iniciando applier Terraform-only', args);

  let terraformCommands: string[] = [];
  let terraformError: string | undefined;

  try {
    logger.info('Executando etapa terraform do applier', {
      provider: args.provider,
      terraformDir: args.terraformDir,
      dryRun: args.dryRun
    });
    terraformCommands = await runTerraform(args.terraformDir, args.dryRun, args.provider);
    logger.info('Etapa terraform do applier concluída', {
      provider: args.provider,
      commands: terraformCommands
    });
  } catch (error) {
    terraformError = error instanceof Error ? error.message : String(error);
    logger.error('Etapa terraform do applier falhou', {
      provider: args.provider,
      terraformError
    });
  }

  const report: TerraformApplyReport = {
    provider: args.provider,
    dashboardKey: args.dashboardKey,
    dryRun: args.dryRun,
    terraformDir: path.resolve(args.terraformDir),
    terraformCommands,
    terraformError
  };

  const reportPath = path.join(args.outputDir, 'apply-report.json');
  await writeJsonFile(reportPath, report);

  logger.info('Applier Terraform-only finalizado', {
    provider: args.provider,
    reportPath,
    terraformError,
    terraformCommandsCount: terraformCommands.length
  });

  return report;
}

export async function applyDynatrace(args: {
  dashboardKey: string;
  terraformDir: string;
  eventsFile: string;
  outputDir: string;
  dryRun: boolean;
}): Promise<TerraformApplyReport> {
  await ensureDir(args.outputDir);
  logger.info('Iniciando applier Dynatrace', args);

  let terraformCommands: string[] = [];
  let terraformError: string | undefined;

  try {
    logger.info('Executando etapa terraform do applier', {
      provider: 'dynatrace',
      terraformDir: args.terraformDir,
      dryRun: args.dryRun
    });
    terraformCommands = await runTerraform(args.terraformDir, args.dryRun, 'dynatrace');
    logger.info('Etapa terraform do applier concluída', {
      provider: 'dynatrace',
      commands: terraformCommands
    });
  } catch (error) {
    terraformError = error instanceof Error ? error.message : String(error);
    logger.error('Etapa terraform do applier falhou', {
      provider: 'dynatrace',
      terraformError
    });
  }

  logger.info('Executando ingestão de eventos Dynatrace', {
    eventsFile: args.eventsFile,
    dryRun: args.dryRun
  });
  const ingestedEvents = await ingestDynatraceEvents(args.eventsFile, args.dryRun);
  const failedEventsCount = ingestedEvents.filter((event) => event.status === 'failed').length;
  logger.info('Ingestão de eventos Dynatrace concluída', {
    ingestedEvents: ingestedEvents.length,
    failedEventsCount
  });

  const report: TerraformApplyReport = {
    provider: 'dynatrace',
    dashboardKey: args.dashboardKey,
    dryRun: args.dryRun,
    terraformDir: path.resolve(args.terraformDir),
    eventsFile: path.resolve(args.eventsFile),
    terraformCommands,
    terraformError,
    failedEventsCount,
    ingestedEvents
  };

  const reportPath = path.join(args.outputDir, 'apply-report.json');
  await writeJsonFile(reportPath, report);

  logger.info('Applier Dynatrace finalizado', {
    reportPath,
    terraformError,
    failedEventsCount,
    terraformCommandsCount: terraformCommands.length
  });

  return report;
}

function resolveBurstArgs(args: Record<string, string | boolean>): Partial<EventBurstConfig> {
  const randomizeEventCounts = args['randomize-event-counts'] === true;
  return {
    burstCount: parseOptionalIntegerArg(args, 'burst-count'),
    burstIntervalMs: parseOptionalIntegerArg(args, 'burst-interval-ms'),
    copiesPerEvent: parseOptionalIntegerArg(args, 'copies-per-event'),
    randomizeEventCounts,
    randomSeed: randomizeEventCounts ? Date.now() : undefined
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

if (isMainModule()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  });
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}
