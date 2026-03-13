import path from 'node:path';
import { parseArgs, requireStringArg } from '../../shared/cli.js';
import { writeJsonFile } from '../../shared/fs.js';
import { ingestEvents } from './datadog.js';
import { runTerraform } from './terraform.js';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const terraformDir = requireStringArg(args, 'terraform-dir');
  const eventsFile = requireStringArg(args, 'events-file');
  const dryRun = args['dry-run'] === true;
  const outputDir = typeof args.output === 'string' ? args.output : './generated';

  let terraformCommands: string[] = [];
  let terraformError: string | undefined;
  try {
    terraformCommands = await runTerraform(terraformDir, dryRun);
  } catch (error) {
    terraformError = error instanceof Error ? error.message : String(error);
  }

  const ingestedEvents = await ingestEvents(eventsFile, dryRun);
  const failedEventsCount = ingestedEvents.filter((event) => event.status === 'failed').length;

  const report = {
    dryRun,
    terraformDir,
    eventsFile,
    terraformCommands,
    terraformError,
    failedEventsCount,
    ingestedEvents
  };

  await writeJsonFile(path.join(outputDir, 'apply-report.json'), report);

  console.log(`Applier finalizado. Dry run: ${dryRun}`);
  if (terraformError) {
    console.error(`Terraform com falha: ${terraformError}`);
  }
  console.log(`Eventos enviados com falha: ${failedEventsCount}`);
  console.log(`Report: ${path.join(outputDir, 'apply-report.json')}`);

  if (terraformError || failedEventsCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
