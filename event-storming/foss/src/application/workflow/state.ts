import { Annotation } from '@langchain/langgraph';
import {
  CandidateContext,
  ImageObservation,
  RecognizedContext,
  WorkbookPayload
} from '../../domain/event-storming-schema.js';
import { SupportedProvider } from '../../infrastructure/llm/chat-model-factory.js';

export const GraphState = Annotation.Root({
  inputImage: Annotation<string>(),
  outputDir: Annotation<string>(),
  provider: Annotation<SupportedProvider>(),
  startFrom: Annotation<'observe' | 'extract' | 'normalize'>(),
  endAt: Annotation<'observe' | undefined>(),
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
  imageObservation: Annotation<ImageObservation | null>({ default: () => null, reducer: (_, right) => right }),
  candidateContext: Annotation<CandidateContext | null>({ default: () => null, reducer: (_, right) => right }),
  standardizedContext: Annotation<RecognizedContext | null>({ default: () => null, reducer: (_, right) => right }),
  workbook: Annotation<WorkbookPayload | null>({ default: () => null, reducer: (_, right) => right }),
  failures: Annotation<string[]>({
    default: () => [],
    reducer: (left, right) => [...left, ...right]
  })
});

export type WorkflowGraphState = typeof GraphState.State;
