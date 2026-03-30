import path from 'node:path';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  CandidateContextSchema,
  ImageObservation,
  ImageObservationSchema,
  NormalizationReviewSchema,
  REQUIRED_COLUMNS,
  WorkbookSchema
} from '../../domain/event-storming-schema.js';
import { Logger } from '../../shared/logger.js';
import { formatError } from '../../shared/errors.js';
import { renderPrompt } from '../../infrastructure/filesystem/prompt-repository.js';
import { buildChatModel } from '../../infrastructure/llm/chat-model-factory.js';
import { imageContentFromFile } from '../../infrastructure/llm/image-message.js';
import { parseJsonResponse } from '../../infrastructure/llm/json-response-parser.js';
import { invokeOllamaVisionJson } from '../../infrastructure/llm/ollama-vision-json-client.js';
import {
  canonicalizeContext,
  applyNormalizationReview,
  candidateContextToRecognizedContext,
  imageObservationToCandidateContext,
  normalizeCandidateContextDomainModels
} from '../../domain/context-normalizer.js';
import {
  validateCandidateContext,
  validateImageObservation,
  validateRecognizedContext,
  validateWorkbook
} from '../../domain/context-validator.js';
import { WorkflowGraphState } from './state.js';
import { traceStep } from '../../infrastructure/langsmith/tracing.js';
import { writeJsonFile } from '../../infrastructure/filesystem/file-system.js';

const logger = new Logger('workflow-nodes');

export async function observeImageNode(state: WorkflowGraphState) {
  const attempt = state.observeAttempts + 1;
  const feedback = state.observeAttempts > 0 ? state.observeFeedback : 'Nenhum.';
  logger.info('Iniciando nó observe_image', {
    attempt,
    inputImage: state.inputImage,
    feedbackLength: feedback.length
  });

  const prompt = await renderPrompt('observe-image.prompt.md', { feedback });

  const execute = traceStep(
    async () => {
      let parsedPayload: unknown;

      if (state.provider === 'ollama') {
        parsedPayload = await invokeOllamaVisionJson(
          state.observeModel,
          state.inputImage,
          [
            prompt,
            '',
            `Arquivo de entrada: ${path.basename(state.inputImage)}`,
            'Observe a imagem e retorne apenas o JSON solicitado.'
          ].join('\n')
        );
      } else {
        const response = await buildChatModel(state.provider, state.observeModel).invoke([
          new SystemMessage(prompt),
          new HumanMessage({
            content: [
              { type: 'text', text: `Arquivo de entrada: ${path.basename(state.inputImage)}` },
              { type: 'text', text: 'Observe a imagem e retorne apenas o JSON solicitado.' },
              imageContentFromFile(state.inputImage)
            ]
          })
        ]);
        parsedPayload = response.content;
      }

      const observation = sanitizeImageObservation(
        ImageObservationSchema.parse(parseJsonResponse(parsedPayload))
      );
      await persistStageJson(state.outputDir, '01-image-observation.json', observation);

      logger.info('Nó observe_image concluído com sucesso', {
        attempt,
        touchPointCount: observation.touchPointsDetected.length,
        outsideTextCount: observation.textsOutsideShapes.length
      });

      return {
        observeAttempts: attempt,
        imageObservation: observation,
        observeFeedback: 'Nenhum.'
      };
    },
    {
      name: 'observe_image_node',
      runType: 'chain',
      tags: ['node', 'observe', `provider:${state.provider}`],
      metadata: {
        attempt,
        model: state.observeModel,
        provider: state.provider,
        inputImage: state.inputImage
      }
    }
  );

  try {
    return await execute();
  } catch (error) {
    const message = formatError(error);
    logger.error('Falha no nó observe_image', { attempt, error: message });

    return {
      observeAttempts: attempt,
      imageObservation: null,
      observeFeedback: message,
      failures: [`observe: ${message}`]
    };
  }
}

export async function validateImageObservationNode(state: WorkflowGraphState) {
  logger.info('Iniciando nó validate_image_observation', {
    observeAttempts: state.observeAttempts
  });

  const execute = traceStep(
    async () => {
      const issues = validateImageObservation(state.imageObservation);
      if (issues.length === 0) {
        logger.info('Validação da observação concluída sem erros');
        return { observeFeedback: 'Nenhum.' };
      }

      logger.warn('Validação da observação encontrou inconsistências', {
        issueCount: issues.length,
        issues
      });

      return {
        observeFeedback: issues.join('\n'),
        failures: issues.map((issue) => `observe: ${issue}`)
      };
    },
    {
      name: 'validate_image_observation_node',
      runType: 'chain',
      tags: ['node', 'validate', 'observe'],
      metadata: {
        attempt: state.observeAttempts
      }
    }
  );

  return execute();
}

export async function extractEventsNode(state: WorkflowGraphState) {
  const imageObservation = state.imageObservation;
  if (!imageObservation) {
    throw new Error('Estado inválido: imageObservation ausente.');
  }

  const attempt = state.extractAttempts + 1;
  logger.info('Iniciando nó extract_events', {
    attempt,
    touchPointCount: imageObservation.touchPointsDetected.length,
    outsideTextCount: imageObservation.textsOutsideShapes.length
  });

  const prompt = await renderPrompt('extract-events.prompt.md', {
    feedback: state.extractAttempts > 0 ? state.extractFeedback : 'Nenhum.',
    input_json: JSON.stringify(imageObservation, null, 2)
  });

  const model = buildChatModel(state.provider, state.extractModel);
  const deterministicCandidateContext = normalizeCandidateContextDomainModels(
    imageObservationToCandidateContext(imageObservation)
  );
  const execute = traceStep(
    async () => {
      const response = await model.invoke([
        new SystemMessage(prompt),
        new HumanMessage('Extraia apenas os eventos candidatos e fluxos candidatos.')
      ]);

      const candidateContext = normalizeCandidateContextDomainModels(
        CandidateContextSchema.parse(parseJsonResponse(response.content))
      );
      await persistStageJson(state.outputDir, '02-candidate-events.json', candidateContext);

      logger.info('Nó extract_events concluído com sucesso', {
        attempt,
        candidateEventCount: candidateContext.candidateEvents.length,
        candidateFlowCount: candidateContext.candidateFlows.length
      });

      return {
        extractAttempts: attempt,
        candidateContext,
        extractFeedback: 'Nenhum.'
      };
    },
    {
      name: 'extract_events_node',
      runType: 'chain',
      tags: ['node', 'extract', `provider:${state.provider}`],
      metadata: {
        attempt,
        model: state.extractModel,
        provider: state.provider,
        touchPointCount: imageObservation.touchPointsDetected.length
      }
    }
  );

  try {
    return await execute();
  } catch (error) {
    const message = formatError(error);
    logger.warn('Falha na extração LLM; usando fallback determinístico baseado na observação', {
      attempt,
      error: message
    });
    await persistStageJson(state.outputDir, '02-candidate-events.json', deterministicCandidateContext);

    return {
      extractAttempts: attempt,
      candidateContext: deterministicCandidateContext,
      extractFeedback: `fallback determinístico aplicado após falha do extractor: ${message}`
    };
  }
}

export async function validateCandidateEventsNode(state: WorkflowGraphState) {
  logger.info('Iniciando nó validate_candidate_events', {
    extractAttempts: state.extractAttempts
  });

  const execute = traceStep(
    async () => {
      const issues = validateCandidateContext(state.candidateContext);
      if (issues.length === 0) {
        logger.info('Validação dos candidatos concluída sem erros');
        return { extractFeedback: 'Nenhum.' };
      }

      logger.warn('Validação dos candidatos encontrou inconsistências', {
        issueCount: issues.length,
        issues
      });

      return {
        extractFeedback: issues.join('\n'),
        failures: issues.map((issue) => `extract: ${issue}`)
      };
    },
    {
      name: 'validate_candidate_events_node',
      runType: 'chain',
      tags: ['node', 'validate', 'extract'],
      metadata: {
        attempt: state.extractAttempts
      }
    }
  );

  return execute();
}

export async function validateExtractionNode(state: WorkflowGraphState) {
  return validateCandidateEventsNode(state);
}

export async function normalizeContextNode(state: WorkflowGraphState) {
  const candidateContext = state.candidateContext;
  if (!candidateContext) {
    throw new Error('Estado inválido: candidateContext ausente.');
  }

  const attempt = state.normalizeAttempts + 1;
  logger.info('Iniciando nó normalize_context', {
    attempt,
    candidateEventCount: candidateContext.candidateEvents.length
  });

  const prompt = await renderPrompt('normalize-context.prompt.md', {
    feedback: state.normalizeAttempts > 0 ? state.normalizeFeedback : 'Nenhum.',
    input_json: JSON.stringify(candidateContext, null, 2)
  });

  const model = buildChatModel(state.provider, state.normalizeModel);
  const deterministicContext = candidateContextToRecognizedContext(candidateContext);
  const execute = traceStep(
    async () => {
      const response = await model.invoke([
        new SystemMessage(prompt),
        new HumanMessage('Revise os candidatos e devolva apenas o JSON de correções.')
      ]);

      const review = NormalizationReviewSchema.parse(parseJsonResponse(response.content));
      const standardizedContext = canonicalizeContext(applyNormalizationReview(candidateContext, review));

      await persistStageJson(state.outputDir, '03-standardized-context.json', standardizedContext);

      logger.info('Nó normalize_context concluído com sucesso', {
        attempt,
        flowCount: standardizedContext.recognizedFlows.length,
        rowCount: standardizedContext.rows.length
      });

      return {
        normalizeAttempts: attempt,
        standardizedContext,
        normalizeFeedback: 'Nenhum.'
      };
    },
    {
      name: 'normalize_context_node',
      runType: 'chain',
      tags: ['node', 'normalize', `provider:${state.provider}`],
      metadata: {
        attempt,
        model: state.normalizeModel,
        provider: state.provider,
        candidateEventCount: candidateContext.candidateEvents.length
      }
    }
  );

  try {
    return await execute();
  } catch (error) {
    const message = formatError(error);
    logger.warn('Falha na revisão LLM da normalização; usando baseline determinística', {
      attempt,
      error: message
    });

    const standardizedContext = canonicalizeContext(deterministicContext);
    await persistStageJson(state.outputDir, '03-standardized-context.json', standardizedContext);

    return {
      normalizeAttempts: attempt,
      standardizedContext,
      normalizeFeedback: `fallback determinístico aplicado após falha do reviewer: ${message}`
    };
  }
}

export async function validateNormalizationNode(state: WorkflowGraphState) {
  logger.info('Iniciando nó validate_normalization', {
    normalizeAttempts: state.normalizeAttempts
  });

  const execute = traceStep(
    async () => {
      const issues = validateRecognizedContext(state.standardizedContext, 'normalize');
      if (issues.length === 0) {
        logger.info('Validação da normalização concluída sem erros');
        return { normalizeFeedback: 'Nenhum.' };
      }

      logger.warn('Validação da normalização encontrou inconsistências', {
        issueCount: issues.length,
        issues
      });

      return {
        normalizeFeedback: issues.join('\n'),
        failures: issues.map((issue) => `normalize: ${issue}`)
      };
    },
    {
      name: 'validate_normalization_node',
      runType: 'chain',
      tags: ['node', 'validate', 'normalize'],
      metadata: {
        attempt: state.normalizeAttempts
      }
    }
  );

  return execute();
}

export async function createWorkbookNode(state: WorkflowGraphState) {
  const standardizedContext = state.standardizedContext;
  if (!standardizedContext) {
    throw new Error('Estado inválido: standardizedContext ausente.');
  }

  const attempt = state.workbookAttempts + 1;
  logger.info('Iniciando nó create_workbook', {
    attempt,
    rowCount: standardizedContext.rows.length
  });

  const execute = traceStep(
    async () => {
      const workbook = WorkbookSchema.parse({
        sheetName: 'event_storming',
        columns: [...REQUIRED_COLUMNS],
        rows: standardizedContext.rows
      });

      await persistStageJson(state.outputDir, '04-workbook.json', workbook);

      logger.info('Nó create_workbook concluído com sucesso', {
        attempt,
        rowCount: workbook.rows.length,
        sheetName: workbook.sheetName
      });

      return {
        workbookAttempts: attempt,
        workbook,
        workbookFeedback: 'Nenhum.'
      };
    },
    {
      name: 'create_workbook_node',
      runType: 'chain',
      tags: ['node', 'workbook', 'deterministic'],
      metadata: {
        attempt,
        standardizedRowCount: standardizedContext.rows.length
      }
    }
  );

  try {
    return await execute();
  } catch (error) {
    const message = formatError(error);
    logger.error('Falha no nó create_workbook', { attempt, error: message });

    return {
      workbookAttempts: attempt,
      workbook: null,
      workbookFeedback: message,
      failures: [`workbook: ${message}`]
    };
  }
}

export async function validateWorkbookNode(state: WorkflowGraphState) {
  logger.info('Iniciando nó validate_workbook', {
    workbookAttempts: state.workbookAttempts
  });

  const execute = traceStep(
    async () => {
      const issues = validateWorkbook(state.workbook);
      if (issues.length === 0) {
        logger.info('Validação do workbook concluída sem erros');
        return { workbookFeedback: 'Nenhum.' };
      }

      logger.warn('Validação do workbook encontrou inconsistências', {
        issueCount: issues.length,
        issues
      });

      return {
        workbookFeedback: issues.join('\n'),
        failures: issues.map((issue) => `workbook: ${issue}`)
      };
    },
    {
      name: 'validate_workbook_node',
      runType: 'chain',
      tags: ['node', 'validate', 'workbook'],
      metadata: {
        attempt: state.workbookAttempts
      }
    }
  );

  return execute();
}

export async function failNode(state: WorkflowGraphState) {
  const lastFailure = state.failures.at(-1) ?? 'Workflow falhou sem detalhes.';
  logger.error('Encerrando workflow em fail', {
    failures: state.failures,
    lastFailure
  });

  const execute = traceStep(
    async () => {
      throw new Error(lastFailure);
    },
    {
      name: 'fail_node',
      runType: 'chain',
      tags: ['node', 'fail'],
      metadata: {
        failures: state.failures
      }
    }
  );

  return execute();
}

async function persistStageJson(outputDir: string, fileName: string, payload: unknown): Promise<void> {
  const filePath = path.join(outputDir, fileName);
  await writeJsonFile(filePath, payload);
}

function sanitizeImageObservation(observation: ImageObservation): ImageObservation {
  const textsOutsideShapes = uniqueStrings(observation.textsOutsideShapes);
  const touchPointsDetected = uniqueStrings(observation.touchPointsDetected);
  const uncertainItems = uniqueStrings(observation.uncertainItems);

  return {
    ...observation,
    touchPointsDetected,
    textsOutsideShapes,
    eventVisualSemantics: observation.eventVisualSemantics
      .map((semantic) => ({
        ...semantic,
        eventTitle: semantic.eventTitle.trim(),
        reasoning: semantic.reasoning.trim()
      }))
      .filter((semantic) => semantic.eventTitle !== '' && textsOutsideShapes.includes(semantic.eventTitle)),
    touchPointEventCorrelations: observation.touchPointEventCorrelations
      .map((correlation) => ({
        ...correlation,
        eventsObservedAroundTouchPoint: uniqueStrings(correlation.eventsObservedAroundTouchPoint)
          .filter((eventTitle) => textsOutsideShapes.includes(eventTitle))
      }))
      .filter((correlation) => correlation.touchPointTitle.trim() !== ''),
    flowsDetected: observation.flowsDetected
      .map((flow) => ({
        ...flow,
        name: flow.name.trim(),
        orderedEventTitles: uniqueStrings(flow.orderedEventTitles)
          .filter((eventTitle) => textsOutsideShapes.includes(eventTitle)),
        touchPoints: uniqueStrings(flow.touchPoints)
          .filter((touchPointTitle) => touchPointsDetected.includes(touchPointTitle)),
        reasoning: flow.reasoning.trim()
      }))
      .filter((flow) => flow.name !== '' && flow.orderedEventTitles.length > 0),
    actorsDetected: uniqueStrings(observation.actorsDetected),
    servicesDetected: uniqueStrings(observation.servicesDetected),
    uncertainItems,
    assumptions: buildObservationAssumptions(uncertainItems)
  };
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function buildObservationAssumptions(uncertainItems: string[]): string[] {
  if (uncertainItems.length === 0) {
    return [];
  }

  return [
    `Os itens ${uncertainItems.map((item) => `'${item}'`).join(', ')} foram tratados como estruturais ou ambíguos e não como eventos.`
  ];
}
