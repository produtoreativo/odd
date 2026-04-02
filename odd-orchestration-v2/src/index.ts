import { parseArgs } from './shared/cli.js';
import { parseProvider } from './shared/provider.js';
import { loadDotEnv } from './infrastructure/env/load-dot-env.js';
import { parseWorkflowCliArgs } from './shared/args.js';
import { runObservabilityWorkflow } from './application/run-observability-workflow.js';

async function main(): Promise<void> {
  loadDotEnv();

  const rawArgs = parseArgs(process.argv.slice(2));
  const provider = parseProvider(rawArgs.provider);
  const args = parseWorkflowCliArgs(rawArgs, provider === 'datadog' ? 'apply' : 'terraform');

  await runObservabilityWorkflow(args);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
