import path from 'node:path';
import { parseCliArgs } from './shared/args.js';
import { Logger } from './shared/logger.js';
import { formatError } from './shared/errors.js';
import { loadDotEnv } from './infrastructure/env/load-dot-env.js';
import { runEventStormingWorkflow } from './application/run-event-storming-workflow.js';
import { bootstrapLangSmith } from './infrastructure/langsmith/langsmith-bootstrap.js';

const logger = new Logger('entrypoint');

async function main(): Promise<void> {
  loadDotEnv();
  bootstrapLangSmith();
  const args = parseCliArgs(process.argv.slice(2));
  const normalizedArgs = {
    ...args,
    inputImage: path.resolve(args.inputImage),
    outputDir: path.resolve(args.outputDir),
    endAt: args.endAt,
    imageObservation: args.imageObservation ? path.resolve(args.imageObservation) : undefined,
    candidateContext: args.candidateContext ? path.resolve(args.candidateContext) : undefined
  };

  logger.info('Argumentos normalizados para execução', normalizedArgs);
  await runEventStormingWorkflow(normalizedArgs);
}

main().catch((error) => {
  logger.error('Execução encerrada com falha', { error: formatError(error) });
  process.exit(1);
});
