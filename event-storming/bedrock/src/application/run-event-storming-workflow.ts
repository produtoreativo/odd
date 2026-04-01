import path from 'node:path';
import { CliArgs } from '../shared/args.js';
import { Logger } from '../shared/logger.js';
import { buildEventStormingWorkflow } from './workflow/build-event-storming-workflow.js';
import { ensureDir, readJsonFile, writeJsonFile } from '../infrastructure/filesystem/file-system.js';
import { writeWorkbook } from '../infrastructure/filesystem/workbook-writer.js';
import { traceStep } from '../infrastructure/langsmith/tracing.js';
import { resolveAgentModels } from '../infrastructure/llm/agent-model-resolver.js';
import { CandidateContextSchema, ImageObservationSchema } from '../domain/event-storming-schema.js';
import { WorkflowStepMetrics, WorkflowStepName } from './workflow/state.js';

const logger = new Logger('run-event-storming-workflow');

export async function runEventStormingWorkflow(args: CliArgs): Promise<void> {
  const workflowStartedAt = Date.now();
  const agentModels = resolveAgentModels(args);
  const preloadedState = await loadPreloadedState(args);

  logger.info('Iniciando execução do workflow', {
    inputImage: args.inputImage,
    outputDir: args.outputDir,
    provider: args.provider,
    startFrom: args.startFrom,
    observeModel: agentModels.observeModel,
    extractModel: agentModels.extractModel,
    normalizeModel: agentModels.normalizeModel,
    maxAttempts: args.maxAttempts
  });

  await ensureDir(args.outputDir);
  const workflow = buildEventStormingWorkflow();
  const invokeWorkflow = traceStep(
    async () => workflow.invoke(
      {
        inputImage: args.inputImage,
        outputDir: args.outputDir,
        provider: args.provider,
        startFrom: args.startFrom,
        observeModel: agentModels.observeModel,
        extractModel: agentModels.extractModel,
        normalizeModel: agentModels.normalizeModel,
        maxAttempts: args.maxAttempts,
        imageObservation: preloadedState.imageObservation,
        candidateContext: preloadedState.candidateContext
      },
      {
        runName: 'event_storming_graph',
        tags: ['workflow', `provider:${args.provider}`],
        metadata: {
          inputImage: args.inputImage,
          outputDir: args.outputDir,
          provider: args.provider,
          startFrom: args.startFrom,
          observeModel: agentModels.observeModel,
          extractModel: agentModels.extractModel,
          normalizeModel: agentModels.normalizeModel,
          maxAttempts: args.maxAttempts
        }
      }
    ),
    {
      name: 'event_storming_workflow',
      runType: 'chain',
      tags: ['workflow', `provider:${args.provider}`],
      metadata: {
        observeModel: agentModels.observeModel,
        extractModel: agentModels.extractModel,
        normalizeModel: agentModels.normalizeModel,
        provider: args.provider,
        startFrom: args.startFrom
      }
    }
  );

  const result = await invokeWorkflow();
  const workflowSummary = buildWorkflowSummary(result.stepMetrics, workflowStartedAt);
  logger.info('Resumo final do workflow', workflowSummary);

  const requiredStates = {
    imageObservation: args.startFrom === 'observe' ? Boolean(result.imageObservation) : true,
    candidateContext: args.startFrom === 'normalize' ? true : Boolean(result.candidateContext),
    standardizedContext: Boolean(result.standardizedContext),
    workbook: Boolean(result.workbook)
  };

  if (!requiredStates.imageObservation || !requiredStates.candidateContext || !requiredStates.standardizedContext || !requiredStates.workbook) {
    logger.error('Workflow retornou estado incompleto', {
      requiredStates,
      failures: result.failures
    });
    throw new Error(`Workflow incompleto. Falhas: ${result.failures.join(' | ')}`);
  }

  const observationPath = path.join(args.outputDir, 'image-observation.json');
  const candidatePath = path.join(args.outputDir, 'candidate-events.json');
  const recognizedPath = path.join(args.outputDir, 'recognized-context.json');
  const standardizedPath = path.join(args.outputDir, 'standardized-context.json');
  const workbookPath = path.join(args.outputDir, 'workbook.json');
  const xlsxPath = path.join(args.outputDir, 'recognized-event-storming.xlsx');

  if (result.imageObservation) {
    await writeJsonFile(observationPath, result.imageObservation);
  }
  if (result.candidateContext) {
    await writeJsonFile(candidatePath, result.candidateContext);
  }
  if (result.standardizedContext) {
    await writeJsonFile(recognizedPath, result.standardizedContext);
    await writeJsonFile(standardizedPath, result.standardizedContext);
  }
  if (result.workbook) {
    await writeJsonFile(workbookPath, result.workbook);
    writeWorkbook(result.workbook, xlsxPath);
  }

  logger.info('Workflow finalizado com sucesso', {
    observationPath,
    candidatePath,
    recognizedPath,
    standardizedPath,
    workbookPath,
    xlsxPath
  });
}

async function loadPreloadedState(args: CliArgs): Promise<{
  imageObservation: ReturnType<typeof ImageObservationSchema.parse> | null;
  candidateContext: ReturnType<typeof CandidateContextSchema.parse> | null;
}> {
  if (args.startFrom === 'observe') {
    return { imageObservation: null, candidateContext: null };
  }

  if (args.startFrom === 'extract') {
    if (!args.imageObservation) {
      throw new Error('Argumento obrigatório ausente para --start-from extract: --image-observation');
    }

    const imageObservation = ImageObservationSchema.parse(
      await readJsonFile(args.imageObservation)
    );

    return { imageObservation, candidateContext: null };
  }

  if (!args.candidateContext) {
    throw new Error('Argumento obrigatório ausente para --start-from normalize: --candidate-context');
  }

  const candidateContext = CandidateContextSchema.parse(
    await readJsonFile(args.candidateContext)
  );

  return { imageObservation: null, candidateContext };
}

function buildWorkflowSummary(
  stepMetrics: Partial<Record<WorkflowStepName, WorkflowStepMetrics>> | undefined,
  workflowStartedAt: number
) {
  const totalDurationMs = Date.now() - workflowStartedAt;
  const orderedSteps: WorkflowStepName[] = [
    'observe_image',
    'validate_image_observation',
    'extract_events',
    'validate_candidate_events',
    'normalize_context',
    'validate_normalization',
    'create_workbook',
    'validate_workbook',
    'fail'
  ];

  const steps = orderedSteps
    .map((stepName) => {
      const metrics = stepMetrics?.[stepName];
      if (!metrics) {
        return null;
      }

      return {
        step: stepName,
        executions: metrics.executions,
        durationMs: metrics.durationMs,
        durationSeconds: Number((metrics.durationMs / 1000).toFixed(3)),
        inputTokens: metrics.inputTokens,
        outputTokens: metrics.outputTokens,
        totalTokens: metrics.totalTokens
      };
    })
    .filter((step): step is NonNullable<typeof step> => step !== null);

  const totalTokens = steps.reduce((sum, step) => sum + step.totalTokens, 0);

  return {
    totalDurationMs,
    totalDurationSeconds: Number((totalDurationMs / 1000).toFixed(3)),
    totalTokens,
    totalInputTokens: steps.reduce((sum, step) => sum + step.inputTokens, 0),
    totalOutputTokens: steps.reduce((sum, step) => sum + step.outputTokens, 0),
    steps
  };
}
