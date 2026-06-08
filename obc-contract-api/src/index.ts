import path from 'node:path';
import { parseCliArgs } from './shared/args.js';
import { Logger } from './shared/logger.js';
import { formatError } from './shared/errors.js';
import { loadDotEnv } from './infrastructure/env/load-dot-env.js';
import { runContractWorkflow } from './application/run-contract-workflow.js';
import { bootstrapLangSmith } from './infrastructure/langsmith/langsmith-bootstrap.js';
import { buildRunId, buildWorkflowKey } from './shared/workflow-identity.js';

const logger = new Logger('entrypoint');

async function main(): Promise<void> {
  loadDotEnv();
  bootstrapLangSmith();
  const args = parseCliArgs(process.argv.slice(2));
  const inputObservation = path.resolve(args.inputObservation);
  const legacyOutputDir = args.legacyOutputDir && !args.workflowKey && !args.runId;
  const workflowKey = buildWorkflowKey({
    inputImage: inputObservation,
    provider: args.provider,
    explicitKey: args.workflowKey
  });
  const runId = args.runId ?? buildRunId();
  const outputRoot = path.resolve(args.legacyOutputDir ? args.outputDir : args.outputRoot);
  const outputDir = legacyOutputDir
    ? path.resolve(args.outputDir)
    : path.join(outputRoot, workflowKey, runId);
  const normalizedArgs = {
    ...args,
    inputObservation,
    outputRoot,
    outputDir,
    workflowKey,
    runId
  };

  logger.info('Argumentos normalizados para execução', normalizedArgs);
  await runContractWorkflow(normalizedArgs);
}

main().catch((error) => {
  logger.error('Execução encerrada com falha', { error: formatError(error) });
  process.exit(1);
});
