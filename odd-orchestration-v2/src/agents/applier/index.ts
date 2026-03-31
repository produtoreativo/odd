import path from 'node:path';
import { parseArgs, requireStringArg } from '../../shared/cli.js';
import { loadDotEnv } from '../../infrastructure/env/load-dot-env.js';
import { ensureDir, writeJsonFile } from '../../shared/fs.js';
import { Logger } from '../../shared/logger.js';
import { ingestEvents } from './datadog.js';
import { runTerraform } from './terraform.js';
import { DatadogApplyReport } from '../../shared/types.js';

const logger = new Logger('applier-entrypoint');

async function main(): Promise<void> {
  loadDotEnv();

  const args = parseArgs(process.argv.slice(2));
  const terraformDir = typeof args['terraform-dir'] === 'string'
    ? args['terraform-dir']
    : './terraform';
  const eventsFile = requireStringArg(args, 'events-file');
  const dryRun = args['dry-run'] === true;
  const outputDir = typeof args.output === 'string'
    ? args.output
    : './generated/apply';

  const report = await applyDatadog({
    terraformDir,
    eventsFile,
    outputDir,
    dryRun
  });

  if (report.terraformError || report.failedEventsCount > 0) {
    process.exitCode = 1;
  }
}

export async function applyDatadog(args: {
  terraformDir: string;
  eventsFile: string;
  outputDir: string;
  dryRun: boolean;
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
  const ingestedEvents = await ingestEvents(args.eventsFile, args.dryRun);
  const failedEventsCount = ingestedEvents.filter((event) => event.status === 'failed').length;
  logger.info('Ingestão de eventos concluída', {
    ingestedEvents: ingestedEvents.length,
    failedEventsCount
  });

  const report: DatadogApplyReport = {
    provider: 'datadog',
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

  logger.info('Applier Datadog finalizado', {
    reportPath,
    terraformError,
    failedEventsCount,
    terraformCommandsCount: terraformCommands.length
  });

  return report;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
