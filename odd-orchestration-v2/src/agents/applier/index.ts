import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, requireStringArg } from '../../shared/cli.js';
import { loadDotEnv } from '../../infrastructure/env/load-dot-env.js';
import { ensureDir, writeJsonFile } from '../../shared/fs.js';
import { normalizeDashboardSlug } from '../../shared/dashboard-identity.js';
import { Logger } from '../../shared/logger.js';
import { ingestEvents } from './datadog.js';
import { runTerraform } from './terraform.js';
import { DatadogApplyReport, EventBurstConfig } from '../../shared/types.js';

const logger = new Logger('applier-entrypoint');

async function main(): Promise<void> {
  loadDotEnv();

  const args = parseArgs(process.argv.slice(2));
  const explicitDashboardKey = typeof args['dashboard-key'] === 'string' && args['dashboard-key'].trim() !== ''
    ? normalizeDashboardSlug(args['dashboard-key'])
    : undefined;
  const terraformDir = typeof args['terraform-dir'] === 'string'
    ? args['terraform-dir']
    : explicitDashboardKey
      ? `./generated/terraform-workspaces/datadog/${explicitDashboardKey}`
      : './terraform';
  const eventsFile = requireStringArg(args, 'events-file');
  const dryRun = args['dry-run'] === true;
  const outputDir = typeof args.output === 'string'
    ? args.output
    : './generated/apply';
  const dashboardKey = explicitDashboardKey
    ? explicitDashboardKey
    : normalizeDashboardSlug(path.basename(path.resolve(terraformDir)));
  const burstConfig = resolveBurstArgs(args);

  const report = await applyDatadog({
    dashboardKey,
    terraformDir,
    eventsFile,
    outputDir,
    dryRun,
    burstConfig
  });

  if (report.terraformError || report.failedEventsCount > 0) {
    process.exitCode = 1;
  }
}

export async function applyDatadog(args: {
  dashboardKey: string;
  terraformDir: string;
  eventsFile: string;
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
    terraformCommands = await runTerraform(args.terraformDir, args.dryRun);
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
    ingestedEvents: ingestion.results
  };

  const reportPath = path.join(args.outputDir, 'apply-report.json');
  await writeJsonFile(reportPath, report);

  logger.info('Applier Datadog finalizado', {
    reportPath,
    terraformError,
    failedEventsCount,
    terraformCommandsCount: terraformCommands.length
  });

  return report;
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
