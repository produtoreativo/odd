import { ModelUsage } from '../../infrastructure/llm/chat-model-factory.js';
import { ORDERED_WORKFLOW_STEPS, WorkflowStepName } from './steps.js';

export type WorkflowStepMetrics = {
  executions: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export function buildStepMetricUpdate(
  stepName: WorkflowStepName,
  startedAt: number,
  usage?: ModelUsage
): Partial<Record<WorkflowStepName, WorkflowStepMetrics>> {
  return {
    [stepName]: {
      executions: 1,
      durationMs: Date.now() - startedAt,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      totalTokens: usage?.totalTokens ?? 0
    }
  };
}

export function mergeStepMetrics(
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

export function buildWorkflowSummary(
  stepMetrics: Partial<Record<WorkflowStepName, WorkflowStepMetrics>> | undefined,
  workflowStartedAt: number
) {
  const totalDurationMs = Date.now() - workflowStartedAt;
  const steps = ORDERED_WORKFLOW_STEPS
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

  return {
    totalDurationMs,
    totalDurationSeconds: Number((totalDurationMs / 1000).toFixed(3)),
    totalTokens: steps.reduce((sum, step) => sum + step.totalTokens, 0),
    totalInputTokens: steps.reduce((sum, step) => sum + step.inputTokens, 0),
    totalOutputTokens: steps.reduce((sum, step) => sum + step.outputTokens, 0),
    steps
  };
}
