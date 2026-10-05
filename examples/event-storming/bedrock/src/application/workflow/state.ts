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
import { SupportedLocale, t } from '../../shared/i18n.js';
import { WorkflowEndAt, WorkflowStepName } from './steps.js';
import { mergeStepMetrics, WorkflowStepMetrics } from './metrics.js';

export const GraphState = Annotation.Root({
  inputImage: Annotation<string>(),
  outputDir: Annotation<string>(),
  env: Annotation<string>(),
  provider: Annotation<SupportedProvider>(),
  locale: Annotation<SupportedLocale>({ default: () => 'pt-BR', reducer: (_, right) => right }),
  startFrom: Annotation<'observe' | 'extract' | 'normalize'>(),
  endAt: Annotation<WorkflowEndAt>(),
  extractModel: Annotation<string>(),
  normalizeModel: Annotation<string>(),
  maxAttempts: Annotation<number>(),
  extractAttempts: Annotation<number>({ default: () => 0, reducer: (_, right) => right }),
  normalizeAttempts: Annotation<number>({ default: () => 0, reducer: (_, right) => right }),
  workbookAttempts: Annotation<number>({ default: () => 0, reducer: (_, right) => right }),
  extractFeedback: Annotation<string>({ default: () => t('feedback.none'), reducer: (_, right) => right }),
  normalizeFeedback: Annotation<string>({ default: () => t('feedback.none'), reducer: (_, right) => right }),
  workbookFeedback: Annotation<string>({ default: () => t('feedback.none'), reducer: (_, right) => right }),
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
