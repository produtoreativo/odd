import path from 'node:path';
import { CliArgs } from '../shared/args.js';
import { Logger } from '../shared/logger.js';
import { buildContractWorkflow } from './workflow/build-contract-workflow.js';
import { ensureDir, writeJsonFile } from '../infrastructure/filesystem/file-system.js';
import { traceStep } from '../infrastructure/langsmith/tracing.js';
import { resolveAgentModels } from '../infrastructure/llm/agent-model-resolver.js';
import { WorkflowStepMetrics, WorkflowStepName } from './workflow/state.js';

const logger = new Logger('run-contract-workflow');

export async function runContractWorkflow(args: CliArgs): Promise<void> {
  const workflowStartedAt = Date.now();
  const agentModels = resolveAgentModels(args);

  logger.info('Iniciando execução do workflow', {
    inputObservation: args.inputObservation,
    outputRoot: args.outputRoot,
    outputDir: args.outputDir,
    workflowKey: args.workflowKey,
    runId: args.runId,
    env: args.env,
    provider: args.provider,
    identifyModel: agentModels.identifyModel,
    maxAttempts: args.maxAttempts
  });

  await ensureDir(args.outputDir);
  const workflow = buildContractWorkflow();
  const invokeWorkflow = traceStep(
    async () => workflow.invoke(
      {
        inputObservation: args.inputObservation,
        outputDir: args.outputDir,
        env: args.env,
        provider: args.provider,
        identifyModel: agentModels.identifyModel,
        maxAttempts: args.maxAttempts,
        observation: null,
        contractRequirements: null
      },
      {
        runName: 'obc_contract_api_graph',
        tags: ['workflow', `provider:${args.provider}`],
        metadata: {
          inputObservation: args.inputObservation,
          outputRoot: args.outputRoot,
          outputDir: args.outputDir,
          workflowKey: args.workflowKey,
          runId: args.runId,
          env: args.env,
          provider: args.provider,
          identifyModel: agentModels.identifyModel,
          maxAttempts: args.maxAttempts
        }
      }
    ),
    {
      name: 'obc_contract_api_workflow',
      runType: 'chain',
      tags: ['workflow', `provider:${args.provider}`],
      metadata: {
        identifyModel: agentModels.identifyModel,
        provider: args.provider,
        env: args.env
      }
    }
  );

  const result = await invokeWorkflow();
  const workflowSummary = buildWorkflowSummary(result.stepMetrics, workflowStartedAt);
  logger.info('Resumo final do workflow', workflowSummary);

  if (!result.contractRequirements) {
    logger.error('Workflow retornou estado incompleto', { failures: result.failures });
    throw new Error(`Workflow incompleto. Falhas: ${result.failures.join(' | ')}`);
  }

  const metadataPath = path.join(args.outputDir, 'contract-workflow-metadata.json');
  const contractRequirementsPath = path.join(args.outputDir, 'contract-requirements.json');

  await writeJsonFile(metadataPath, {
    workflowKey: args.workflowKey,
    runId: args.runId,
    inputObservation: args.inputObservation,
    outputRoot: args.outputRoot,
    outputDir: args.outputDir,
    provider: args.provider,
    env: args.env,
    identifyModel: agentModels.identifyModel,
    maxAttempts: args.maxAttempts,
    generatedAt: new Date().toISOString()
  });
  await writeJsonFile(contractRequirementsPath, result.contractRequirements);

  logger.info('Workflow finalizado com sucesso', {
    metadataPath,
    contractRequirementsPath
  });
}

function buildWorkflowSummary(
  stepMetrics: Partial<Record<WorkflowStepName, WorkflowStepMetrics>> | undefined,
  workflowStartedAt: number
) {
  const totalDurationMs = Date.now() - workflowStartedAt;
  const orderedSteps: WorkflowStepName[] = [
    'load_observation',
    'identify_contract_requirements',
    'validate_contract_requirements',
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

  return {
    totalDurationMs,
    totalDurationSeconds: Number((totalDurationMs / 1000).toFixed(3)),
    totalTokens: steps.reduce((sum, step) => sum + step.totalTokens, 0),
    totalInputTokens: steps.reduce((sum, step) => sum + step.inputTokens, 0),
    totalOutputTokens: steps.reduce((sum, step) => sum + step.outputTokens, 0),
    steps
  };
}
