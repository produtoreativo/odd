import { Annotation } from '@langchain/langgraph';
import { ContractRequirements, ObservationInput } from '../../domain/contract-schema.js';
import { SupportedProvider } from '../../infrastructure/llm/chat-model-factory.js';

export type WorkflowStepName =
  | 'load_observation'
  | 'identify_contract_requirements'
  | 'validate_contract_requirements'
  | 'fail';

export type WorkflowStepMetrics = {
  executions: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export const GraphState = Annotation.Root({
  inputObservation: Annotation<string>(),
  outputDir: Annotation<string>(),
  env: Annotation<string>(),
  provider: Annotation<SupportedProvider>(),
  identifyModel: Annotation<string>(),
  maxAttempts: Annotation<number>(),
  identifyAttempts: Annotation<number>({ default: () => 0, reducer: (_, right) => right }),
  identifyFeedback: Annotation<string>({ default: () => 'Nenhum.', reducer: (_, right) => right }),
  observation: Annotation<ObservationInput | null>({ default: () => null, reducer: (_, right) => right }),
  contractRequirements: Annotation<ContractRequirements | null>({ default: () => null, reducer: (_, right) => right }),
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
