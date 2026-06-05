import { Annotation } from '@langchain/langgraph';
import {
  CandidateContext,
  ArrowDetections,
  FlowLegendDetections,
  ImageObservation,
  OcrEventCandidates,
  OcrObservation,
  OcrPromptContext,
  RecognizedContext,
  ShapeGeometry,
  WorkbookPayload
} from '../../domain/event-storming-schema.js';
import { SupportedProvider } from '../../infrastructure/llm/chat-model-factory.js';

export type WorkflowStepName =
  | 'prepare_image_ocr'
  | 'prepare_supporting_ocr'
  | 'classify_ocr_event_candidates'
  | 'detect_shape_geometry'
  | 'detect_arrow_geometry'
  | 'extract_flow_legends'
  | 'compose_spatial_observation'
  | 'compose_ocr_text_observations'
  | 'compose_observe_prompt_context'
  | 'compose_deterministic_image_observation'
  | 'observe_image'
  | 'validate_image_observation'
  | 'extract_events'
  | 'validate_candidate_events'
  | 'normalize_context'
  | 'validate_normalization'
  | 'create_workbook'
  | 'validate_workbook'
  | 'fail';

export type WorkflowEndAt = Exclude<WorkflowStepName, 'fail'>;

export type WorkflowStepMetrics = {
  executions: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export const GraphState = Annotation.Root({
  inputImage: Annotation<string>(),
  outputDir: Annotation<string>(),
  env: Annotation<string>(),
  provider: Annotation<SupportedProvider>(),
  startFrom: Annotation<'observe' | 'extract' | 'normalize'>(),
  endAt: Annotation<WorkflowEndAt>(),
  observeModel: Annotation<string>(),
  extractModel: Annotation<string>(),
  normalizeModel: Annotation<string>(),
  maxAttempts: Annotation<number>(),
  observeAttempts: Annotation<number>({ default: () => 0, reducer: (_, right) => right }),
  extractAttempts: Annotation<number>({ default: () => 0, reducer: (_, right) => right }),
  normalizeAttempts: Annotation<number>({ default: () => 0, reducer: (_, right) => right }),
  workbookAttempts: Annotation<number>({ default: () => 0, reducer: (_, right) => right }),
  observeFeedback: Annotation<string>({ default: () => 'Nenhum.', reducer: (_, right) => right }),
  extractFeedback: Annotation<string>({ default: () => 'Nenhum.', reducer: (_, right) => right }),
  normalizeFeedback: Annotation<string>({ default: () => 'Nenhum.', reducer: (_, right) => right }),
  workbookFeedback: Annotation<string>({ default: () => 'Nenhum.', reducer: (_, right) => right }),
  ocrObservation: Annotation<OcrObservation | null>({ default: () => null, reducer: (_, right) => right }),
  supportingOcrObservation: Annotation<OcrObservation | null>({ default: () => null, reducer: (_, right) => right }),
  ocrEventCandidates: Annotation<OcrEventCandidates | null>({ default: () => null, reducer: (_, right) => right }),
  shapeGeometry: Annotation<ShapeGeometry | null>({ default: () => null, reducer: (_, right) => right }),
  arrowDetections: Annotation<ArrowDetections | null>({ default: () => null, reducer: (_, right) => right }),
  flowLegendDetections: Annotation<FlowLegendDetections | null>({ default: () => null, reducer: (_, right) => right }),
  spatialObservation: Annotation<OcrPromptContext['spatialComposition'] | null>({ default: () => null, reducer: (_, right) => right }),
  ocrTextObservations: Annotation<ImageObservation['textObservations']>({ default: () => [], reducer: (_, right) => right }),
  observePromptContext: Annotation<OcrPromptContext | null>({ default: () => null, reducer: (_, right) => right }),
  deterministicImageObservation: Annotation<ImageObservation | null>({ default: () => null, reducer: (_, right) => right }),
  imageObservation: Annotation<ImageObservation | null>({ default: () => null, reducer: (_, right) => right }),
  candidateContext: Annotation<CandidateContext | null>({ default: () => null, reducer: (_, right) => right }),
  standardizedContext: Annotation<RecognizedContext | null>({ default: () => null, reducer: (_, right) => right }),
  workbook: Annotation<WorkbookPayload | null>({ default: () => null, reducer: (_, right) => right }),
  stepMetrics: Annotation<Partial<Record<WorkflowStepName, WorkflowStepMetrics>>>({
    default: () => ({}),
    reducer: (left, right) => mergeStepMetrics(left, right)
  }),
  failures: Annotation<string[]>({
    default: () => [],
    reducer: (left, right) => [...left, ...right]
  })
});

export type WorkflowGraphState = typeof GraphState.State;

function mergeStepMetrics(
  left: Partial<Record<WorkflowStepName, WorkflowStepMetrics>>,
  right: Partial<Record<WorkflowStepName, WorkflowStepMetrics>>
): Partial<Record<WorkflowStepName, WorkflowStepMetrics>> {
  const merged: Partial<Record<WorkflowStepName, WorkflowStepMetrics>> = { ...left };

  for (const [stepName, metrics] of Object.entries(right) as Array<[WorkflowStepName, WorkflowStepMetrics]>) {
    const current = merged[stepName];
    merged[stepName] = {
      executions: (current?.executions ?? 0) + metrics.executions,
      durationMs: (current?.durationMs ?? 0) + metrics.durationMs,
      inputTokens: (current?.inputTokens ?? 0) + metrics.inputTokens,
      outputTokens: (current?.outputTokens ?? 0) + metrics.outputTokens,
      totalTokens: (current?.totalTokens ?? 0) + metrics.totalTokens
    };
  }

  return merged;
}
