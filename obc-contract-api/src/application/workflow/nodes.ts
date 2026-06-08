import path from 'node:path';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  ContractRequirementsSchema,
  ObservationInputSchema
} from '../../domain/contract-schema.js';
import { validateContractRequirements } from '../../domain/contract-validator.js';
import { Logger } from '../../shared/logger.js';
import { formatError } from '../../shared/errors.js';
import { renderPrompt } from '../../infrastructure/filesystem/prompt-repository.js';
import { buildChatModel, ModelUsage } from '../../infrastructure/llm/chat-model-factory.js';
import { extractRawResponseText, parseJsonResponse } from '../../infrastructure/llm/json-response-parser.js';
import { readJsonFile, writeJsonFile, writeTextFile } from '../../infrastructure/filesystem/file-system.js';
import { traceStep } from '../../infrastructure/langsmith/tracing.js';
import { WorkflowGraphState, WorkflowStepMetrics, WorkflowStepName } from './state.js';

const logger = new Logger('workflow-nodes');

export async function loadObservationNode(state: WorkflowGraphState) {
  const startedAt = Date.now();
  logger.info('Iniciando nó load_observation', { inputObservation: state.inputObservation });

  const execute = traceStep(
    async () => {
      const raw = await readJsonFile(state.inputObservation);
      const observation = ObservationInputSchema.parse(raw);
      await persistStageJson(state.outputDir, '00-observation-input.json', observation);

      logger.info('Nó load_observation concluído com sucesso', {
        commandCount: observation.commandsDetected.length,
        touchPointCount: observation.touchPointsDetected.length,
        actorCount: observation.actorsDetected.length,
        serviceCount: observation.servicesDetected.length
      });

      return {
        observation,
        stepMetrics: buildStepMetricUpdate('load_observation', startedAt)
      };
    },
    {
      name: 'load_observation_node',
      runType: 'chain',
      tags: ['node', 'load', 'deterministic'],
      metadata: { inputObservation: state.inputObservation }
    }
  );

  try {
    return await execute();
  } catch (error) {
    const message = formatError(error);
    logger.error('Falha no nó load_observation', { error: message });
    return {
      observation: null,
      stepMetrics: buildStepMetricUpdate('load_observation', startedAt),
      failures: [`load: ${message}`]
    };
  }
}

export async function identifyContractRequirementsNode(state: WorkflowGraphState) {
  const startedAt = Date.now();
  const attempt = state.identifyAttempts + 1;
  const feedback = state.identifyAttempts > 0 ? state.identifyFeedback : 'Nenhum.';
  const observation = state.observation;

  logger.info('Iniciando nó identify_contract_requirements', {
    attempt,
    commandCount: observation?.commandsDetected.length ?? 0,
    feedbackLength: feedback.length
  });

  const prompt = await renderPrompt('identify-contract-requirements.prompt.md', {
    feedback,
    touch_points: JSON.stringify(observation?.touchPointsDetected ?? [], null, 2),
    commands: JSON.stringify(observation?.commandsDetected ?? [], null, 2),
    correlations: JSON.stringify(observation?.touchPointEventCorrelations ?? [], null, 2),
    actors: JSON.stringify(observation?.actorsDetected ?? [], null, 2),
    services: JSON.stringify(observation?.servicesDetected ?? [], null, 2)
  });

  const execute = traceStep(
    async () => {
      const response = await buildChatModel(state.provider, state.identifyModel).invoke([
        new SystemMessage(prompt),
        new HumanMessage({
          content: [
            { type: 'text', text: 'Identifique os requisitos do contrato e retorne apenas o JSON solicitado.' }
          ]
        })
      ]);
      await persistRawResponse(state.outputDir, '01-contract-requirements', attempt, response.content);

      const contractRequirements = ContractRequirementsSchema.parse(parseJsonResponse(response.content));
      await persistStageJson(state.outputDir, '01-contract-requirements.json', contractRequirements);

      logger.info('Nó identify_contract_requirements concluído com sucesso', {
        attempt,
        contractCount: contractRequirements.contracts.length,
        usage: response.usage
      });

      return {
        identifyAttempts: attempt,
        contractRequirements,
        identifyFeedback: 'Nenhum.',
        stepMetrics: buildStepMetricUpdate('identify_contract_requirements', startedAt, response.usage)
      };
    },
    {
      name: 'identify_contract_requirements_node',
      runType: 'chain',
      tags: ['node', 'identify', `provider:${state.provider}`],
      metadata: { attempt, model: state.identifyModel, provider: state.provider }
    }
  );

  try {
    return await execute();
  } catch (error) {
    const message = formatError(error);
    logger.error('Falha no nó identify_contract_requirements', { attempt, error: message });
    return {
      identifyAttempts: attempt,
      contractRequirements: null,
      identifyFeedback: message,
      stepMetrics: buildStepMetricUpdate('identify_contract_requirements', startedAt),
      failures: [`identify: ${message}`]
    };
  }
}

export async function validateContractRequirementsNode(state: WorkflowGraphState) {
  const startedAt = Date.now();
  logger.info('Iniciando nó validate_contract_requirements', {
    identifyAttempts: state.identifyAttempts
  });

  const execute = traceStep(
    async () => {
      const issues = validateContractRequirements(state.contractRequirements, state.observation);
      if (issues.length === 0) {
        logger.info('Validação dos requisitos de contrato concluída sem erros');
        return {
          identifyFeedback: 'Nenhum.',
          stepMetrics: buildStepMetricUpdate('validate_contract_requirements', startedAt)
        };
      }

      logger.warn('Validação dos requisitos de contrato encontrou inconsistências', {
        issueCount: issues.length,
        issues
      });

      return {
        identifyFeedback: issues.join('\n'),
        stepMetrics: buildStepMetricUpdate('validate_contract_requirements', startedAt),
        failures: issues.map((issue) => `identify: ${issue}`)
      };
    },
    {
      name: 'validate_contract_requirements_node',
      runType: 'chain',
      tags: ['node', 'validate', 'identify'],
      metadata: { attempt: state.identifyAttempts }
    }
  );

  return execute();
}

export async function failNode(state: WorkflowGraphState) {
  const startedAt = Date.now();
  logger.error('Workflow encerrado no nó fail', { failures: state.failures });
  return {
    stepMetrics: buildStepMetricUpdate('fail', startedAt)
  };
}

async function persistStageJson(outputDir: string, fileName: string, payload: unknown): Promise<void> {
  const filePath = path.join(outputDir, fileName);
  await writeJsonFile(filePath, payload);
}

async function persistRawResponse(outputDir: string, stagePrefix: string, attempt: number, payload: unknown): Promise<void> {
  const filePath = path.join(outputDir, `${stagePrefix}.attempt-${attempt}.raw.txt`);
  await writeTextFile(filePath, `${extractRawResponseText(payload)}\n`);
}

function buildStepMetricUpdate(
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
