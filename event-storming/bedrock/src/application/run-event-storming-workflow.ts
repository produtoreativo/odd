import path from 'node:path';
import { CliArgs } from '../shared/args.js';
import { Logger } from '../shared/logger.js';
import { buildEventStormingWorkflow } from './workflow/build-event-storming-workflow.js';
import { ensureDir, readJsonFile, writeJsonFile } from '../infrastructure/filesystem/file-system.js';
import { writeWorkbook } from '../infrastructure/filesystem/workbook-writer.js';
import { traceStep } from '../infrastructure/langsmith/tracing.js';
import { AgentModels, resolveAgentModels } from '../infrastructure/llm/agent-model-resolver.js';
import { CandidateContextSchema, ImageObservationSchema } from '../domain/event-storming-schema.js';
import { setLocale, t } from '../shared/i18n.js';
import { buildWorkflowSummary } from './workflow/metrics.js';
import { shouldRequireState } from './workflow/steps.js';
import { WorkflowGraphState } from './workflow/state.js';

const logger = new Logger('run-event-storming-workflow');

export async function runEventStormingWorkflow(args: CliArgs): Promise<void> {
  setLocale(args.locale);
  const workflowStartedAt = Date.now();
  const agentModels = resolveAgentModels(args);
  const preloadedState = await loadPreloadedState(args);

  logger.info(t('log.workflow.start'), {
    inputImage: args.inputImage,
    outputRoot: args.outputRoot,
    outputDir: args.outputDir,
    workflowKey: args.workflowKey,
    runId: args.runId,
    legacyOutputDir: args.legacyOutputDir,
    env: args.env,
    provider: args.provider,
    locale: args.locale,
    startFrom: args.startFrom,
    endAt: args.endAt,
    extractModel: agentModels.extractModel,
    normalizeModel: agentModels.normalizeModel,
    maxAttempts: args.maxAttempts
  });

  await ensureDir(args.outputDir);
  const workflow = buildEventStormingWorkflow();
  const invokeWorkflow = traceStep(
    async () => workflow.invoke(buildInitialWorkflowState(args, agentModels, preloadedState), {
      runName: 'event_storming_graph',
      tags: ['workflow', `provider:${args.provider}`],
      metadata: buildWorkflowTraceMetadata(args, agentModels)
    }),
    {
      name: 'event_storming_workflow',
      runType: 'chain',
      tags: ['workflow', `provider:${args.provider}`],
      metadata: {
        extractModel: agentModels.extractModel,
        normalizeModel: agentModels.normalizeModel,
        provider: args.provider,
        env: args.env,
        locale: args.locale,
        startFrom: args.startFrom
      }
    }
  );

  const result = await invokeWorkflow();
  const workflowSummary = buildWorkflowSummary(result.stepMetrics, workflowStartedAt);
  logger.info(t('log.workflow.summary'), workflowSummary);

  assertRequiredStates(args, result);
  const outputPaths = buildOutputPaths(args.outputDir);
  await persistWorkflowOutputs(args, agentModels, result, outputPaths);
  logger.info('Workflow finalizado com sucesso', outputPaths);
}

type PreloadedState = {
  imageObservation: ReturnType<typeof ImageObservationSchema.parse> | null;
  candidateContext: ReturnType<typeof CandidateContextSchema.parse> | null;
};

function buildInitialWorkflowState(
  args: CliArgs,
  agentModels: AgentModels,
  preloadedState: PreloadedState
): Partial<WorkflowGraphState> {
  return {
    inputImage: args.inputImage,
    outputDir: args.outputDir,
    env: args.env,
    provider: args.provider,
    locale: args.locale,
    startFrom: args.startFrom,
    endAt: args.endAt,
    extractModel: agentModels.extractModel,
    normalizeModel: agentModels.normalizeModel,
    maxAttempts: args.maxAttempts,
    extractFeedback: t('feedback.none'),
    normalizeFeedback: t('feedback.none'),
    workbookFeedback: t('feedback.none'),
    ocrObservation: null,
    supportingOcrObservation: null,
    ocrEventCandidates: null,
    shapeGeometry: null,
    arrowDetections: null,
    flowLegendDetections: null,
    spatialObservation: null,
    ocrTextObservations: [],
    observePromptContext: null,
    deterministicImageObservation: null,
    imageObservation: preloadedState.imageObservation,
    candidateContext: preloadedState.candidateContext
  };
}

function buildWorkflowTraceMetadata(args: CliArgs, agentModels: AgentModels) {
  return {
    inputImage: args.inputImage,
    outputRoot: args.outputRoot,
    outputDir: args.outputDir,
    workflowKey: args.workflowKey,
    runId: args.runId,
    env: args.env,
    provider: args.provider,
    locale: args.locale,
    startFrom: args.startFrom,
    endAt: args.endAt,
    extractModel: agentModels.extractModel,
    normalizeModel: agentModels.normalizeModel,
    maxAttempts: args.maxAttempts
  };
}

function assertRequiredStates(args: CliArgs, result: WorkflowGraphState): void {
  const requiredStates = {
    imageObservation: shouldRequireState(args.endAt, 'compose_deterministic_image_observation') && args.startFrom === 'observe'
      ? Boolean(result.imageObservation)
      : true,
    candidateContext: shouldRequireState(args.endAt, 'extract_events') && args.startFrom !== 'normalize'
      ? Boolean(result.candidateContext)
      : true,
    standardizedContext: shouldRequireState(args.endAt, 'normalize_context')
      ? Boolean(result.standardizedContext)
      : true,
    workbook: shouldRequireState(args.endAt, 'create_workbook')
      ? Boolean(result.workbook)
      : true
  };

  if (requiredStates.imageObservation && requiredStates.candidateContext && requiredStates.standardizedContext && requiredStates.workbook) {
    return;
  }

  logger.error(t('log.workflow.incomplete'), {
    requiredStates,
    failures: result.failures
  });
  throw new Error(t('error.workflowIncomplete', { failures: result.failures.join(' | ') }));
}

function buildOutputPaths(outputDir: string) {
  return {
    metadataPath: path.join(outputDir, 'event-storming-metadata.json'),
    observationPath: path.join(outputDir, 'image-observation.json'),
    ocrObservationPath: path.join(outputDir, 'ocr-observation.json'),
    supportingOcrObservationPath: path.join(outputDir, 'ocr-supporting-observation.json'),
    ocrEventCandidatesPath: path.join(outputDir, 'ocr-event-candidates.json'),
    shapeGeometryPath: path.join(outputDir, 'shape-geometry.json'),
    arrowDetectionsPath: path.join(outputDir, 'arrow-detections.json'),
    flowLegendsPath: path.join(outputDir, 'flow-legends.json'),
    spatialObservationPath: path.join(outputDir, 'spatial-observation.json'),
    ocrTextObservationsPath: path.join(outputDir, 'ocr-text-observations.json'),
    observePromptContextPath: path.join(outputDir, 'observe-prompt-context.json'),
    deterministicImageObservationPath: path.join(outputDir, 'deterministic-image-observation.json'),
    candidatePath: path.join(outputDir, 'candidate-events.json'),
    recognizedPath: path.join(outputDir, 'recognized-context.json'),
    standardizedPath: path.join(outputDir, 'standardized-context.json'),
    workbookPath: path.join(outputDir, 'workbook.json'),
    xlsxPath: path.join(outputDir, 'recognized-event-storming.xlsx')
  };
}

async function persistWorkflowOutputs(
  args: CliArgs,
  agentModels: AgentModels,
  result: WorkflowGraphState,
  outputPaths: ReturnType<typeof buildOutputPaths>
): Promise<void> {
  await writeJsonFile(outputPaths.metadataPath, {
    ...buildWorkflowTraceMetadata(args, agentModels),
    generatedAt: new Date().toISOString()
  });

  if (result.ocrObservation) {
    await writeJsonFile(outputPaths.ocrObservationPath, result.ocrObservation);
  }
  if (result.supportingOcrObservation) {
    await writeJsonFile(outputPaths.supportingOcrObservationPath, result.supportingOcrObservation);
  }
  if (result.ocrEventCandidates) {
    await writeJsonFile(outputPaths.ocrEventCandidatesPath, result.ocrEventCandidates);
  }
  if (result.shapeGeometry) {
    await writeJsonFile(outputPaths.shapeGeometryPath, result.shapeGeometry);
  }
  if (result.arrowDetections) {
    await writeJsonFile(outputPaths.arrowDetectionsPath, result.arrowDetections);
  }
  if (result.flowLegendDetections) {
    await writeJsonFile(outputPaths.flowLegendsPath, result.flowLegendDetections);
  }
  if (result.spatialObservation) {
    await writeJsonFile(outputPaths.spatialObservationPath, result.spatialObservation);
  }
  if (result.ocrTextObservations.length > 0) {
    await writeJsonFile(outputPaths.ocrTextObservationsPath, result.ocrTextObservations);
  }
  if (result.observePromptContext) {
    await writeJsonFile(outputPaths.observePromptContextPath, result.observePromptContext);
  }
  if (result.deterministicImageObservation) {
    await writeJsonFile(outputPaths.deterministicImageObservationPath, result.deterministicImageObservation);
  }
  if (result.imageObservation) {
    await writeJsonFile(outputPaths.observationPath, result.imageObservation);
  }
  if (result.candidateContext) {
    await writeJsonFile(outputPaths.candidatePath, result.candidateContext);
  }
  if (result.standardizedContext) {
    await writeJsonFile(outputPaths.recognizedPath, result.standardizedContext);
    await writeJsonFile(outputPaths.standardizedPath, result.standardizedContext);
  }
  if (result.workbook) {
    await writeJsonFile(outputPaths.workbookPath, result.workbook);
    writeWorkbook(result.workbook, outputPaths.xlsxPath);
  }
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

  const imageObservation = args.imageObservation
    ? ImageObservationSchema.parse(await readJsonFile(args.imageObservation))
    : null;
  const candidateContext = CandidateContextSchema.parse(await readJsonFile(args.candidateContext));

  return { imageObservation, candidateContext };
}
