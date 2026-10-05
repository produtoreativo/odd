import path from 'node:path';
import { parseCliArgs } from './shared/args.js';
import { Logger } from './shared/logger.js';
import { formatError } from './shared/errors.js';
import { setLocale, t } from './shared/i18n.js';
import { loadDotEnv } from './infrastructure/env/load-dot-env.js';
import { runEventStormingWorkflow } from './application/run-event-storming-workflow.js';
import { bootstrapLangSmith } from './infrastructure/langsmith/langsmith-bootstrap.js';
import { buildRunId, buildWorkflowKey } from './shared/workflow-identity.js';

const logger = new Logger('entrypoint');

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  setLocale(args.locale);
  loadDotEnv();
  bootstrapLangSmith();
  const inputImage = path.resolve(args.inputImage);
  const legacyOutputDir = args.legacyOutputDir && !args.workflowKey && !args.runId;
  const workflowKey = buildWorkflowKey({
    inputImage,
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
    inputImage,
    outputRoot,
    outputDir,
    workflowKey,
    runId,
    imageObservation: args.imageObservation ? path.resolve(args.imageObservation) : undefined,
    candidateContext: args.candidateContext ? path.resolve(args.candidateContext) : undefined
  };

  logger.info(t('log.entry.normalizedArgs'), normalizedArgs);
  await runEventStormingWorkflow(normalizedArgs);
}

main().catch((error) => {
  logger.error(t('log.entry.failed'), { error: formatError(error) });
  process.exit(1);
});
