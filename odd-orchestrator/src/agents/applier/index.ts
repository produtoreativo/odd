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

  const terraformCommands = await runTerraform(terraformDir, dryRun);
  const ingestedEvents = await ingestEvents(eventsFile, dryRun);

  const report = {
    dryRun,
    terraformDir,
    eventsFile,
    terraformCommands,
    ingestedEvents
  };

  await writeJsonFile(path.join(outputDir, 'apply-report.json'), report);

  console.log(`Applier finalizado. Dry run: ${dryRun}`);
  console.log(`Report: ${path.join(outputDir, 'apply-report.json')}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
