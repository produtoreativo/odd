import path from 'node:path';
import { parseArgs, requireStringArg } from '../../shared/cli.js';
import { loadDotEnv } from '../../shared/env.js';
import { writeJsonFile } from '../../shared/fs.js';
import { parseProvider } from '../../shared/provider.js';
import { ingestEvents as ingestDatadogEvents } from './datadog.js';
import { ingestEvents as ingestDynatraceEvents } from './dynatrace.js';
import { ingestEvents as ingestGrafanaEvents } from './grafana.js';
import { runTerraform } from './terraform.js';

async function main(): Promise<void> {
  loadDotEnv();

  const args = parseArgs(process.argv.slice(2));
  const provider = parseProvider(args.provider);
  const terraformDir = requireStringArg(args, 'terraform-dir');
  const eventsFile = typeof args['events-file'] === 'string' ? args['events-file'] : '';
  const dryRun = args['dry-run'] === true;
  const outputDir = typeof args.output === 'string' ? args.output : './generated';

  let terraformCommands: string[] = [];
  let terraformError: string | undefined;
  try {
    terraformCommands = await runTerraform(terraformDir, dryRun, provider);
  } catch (error) {
    terraformError = error instanceof Error ? error.message : String(error);
  }

  const ingestedEvents = provider === 'datadog'
    ? await ingestDatadogEvents(requireStringArg(args, 'events-file'), dryRun)
    : provider === 'dynatrace'
    ? await ingestDynatraceEvents(requireStringArg(args, 'events-file'), dryRun)
    : await ingestGrafanaEvents(requireStringArg(args, 'events-file'), dryRun);
  const failedEventsCount = ingestedEvents.filter((event) => event.status === 'failed').length;

  const report = {
    provider,
    dryRun,
    terraformDir,
    eventsFile: eventsFile || undefined,
    terraformCommands,
    terraformError,
    failedEventsCount,
    ingestedEvents
  };

  await writeJsonFile(path.join(outputDir, 'apply-report.json'), report);

  console.log(`Applier finalizado. Provider: ${provider}. Dry run: ${dryRun}`);
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
