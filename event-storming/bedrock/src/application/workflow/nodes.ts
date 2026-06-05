import path from 'node:path';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  ArrowDetections,
  ArrowDetectionsSchema,
  CandidateContextSchema,
  CandidateContext,
  FlowLegendDetections,
  FlowLegendDetectionsSchema,
  ImageObservation,
  ImageObservationSchema,
  NormalizationReviewSchema,
  OcrEventCandidates,
  OcrEventCandidatesSchema,
  OcrObservation,
  OcrPromptContext,
  OcrPromptContextSchema,
  OcrObservationSchema,
  PROJECT_FORMAT_COLUMNS,
  REQUIRED_COLUMNS,
  ShapeGeometry,
  ShapeGeometrySchema,
  WorkbookSchema
} from '../../domain/event-storming-schema.js';
import { Logger } from '../../shared/logger.js';
import { formatError } from '../../shared/errors.js';
import { renderPrompt } from '../../infrastructure/filesystem/prompt-repository.js';
import { buildChatModel, ModelUsage } from '../../infrastructure/llm/chat-model-factory.js';
import { imageContentFromFile } from '../../infrastructure/llm/image-message.js';
import { extractRawResponseText, parseJsonResponse } from '../../infrastructure/llm/json-response-parser.js';
import {
  canonicalizeContext,
  applyNormalizationReview,
  candidateContextToRecognizedContext,
  enrichCandidateContextFromObservation,
  imageObservationToCandidateContext,
  normalizeCandidateContextDomainModels
} from '../../domain/context-normalizer.js';
import {
  validateCandidateContext,
  validateImageObservation,
  validateRecognizedContext,
  validateWorkbook
} from '../../domain/context-validator.js';
import { WorkflowGraphState, WorkflowStepMetrics, WorkflowStepName } from './state.js';
import { traceStep } from '../../infrastructure/langsmith/tracing.js';
import { writeJsonFile, writeTextFile } from '../../infrastructure/filesystem/file-system.js';
import { getLocale, t } from '../../shared/i18n.js';
import {
  detectArrowGeometry,
  detectShapeGeometry,
  recognizeFlowLegends,
  recognizeSupportingLabels,
  recognizeTechnicalLabels
} from '../../infrastructure/ocr/technical-label-ocr.js';

const logger = new Logger('workflow-nodes');

export async function prepareImageOcrNode(state: WorkflowGraphState) {
  const startedAt = Date.now();
  logger.info('Iniciando nó prepare_image_ocr', {
    inputImage: state.inputImage
  });

  const execute = traceStep(
    async () => {
      try {
        const ocrObservation = OcrObservationSchema.parse(await recognizeTechnicalLabels(state.inputImage, {
          outputDir: state.outputDir
        }));
        await persistStageJson(state.outputDir, '00-ocr-observation.json', ocrObservation);

        logger.info('Nó prepare_image_ocr concluído com sucesso', {
          textCount: ocrObservation.texts.length
        });

        return {
          ocrObservation,
          stepMetrics: buildStepMetricUpdate('prepare_image_ocr', startedAt)
        };
      } catch (error) {
        const message = formatError(error);
        logger.warn('Falha no OCR técnico; workflow continuará apenas com observação multimodal', {
          error: message
        });

        const ocrObservation = OcrObservationSchema.parse({
          inputImage: state.inputImage,
          texts: [],
          assumptions: [`OCR técnico não executado com sucesso: ${message}`]
        });
        await persistStageJson(state.outputDir, '00-ocr-observation.json', ocrObservation);

        return {
          ocrObservation,
          stepMetrics: buildStepMetricUpdate('prepare_image_ocr', startedAt)
        };
      }
    },
    {
      name: 'prepare_image_ocr_node',
      runType: 'chain',
      tags: ['node', 'ocr', 'deterministic'],
      metadata: {
        inputImage: state.inputImage
      }
    }
  );

  return execute();
}

export async function prepareSupportingOcrNode(state: WorkflowGraphState) {
  const startedAt = Date.now();
  logger.info('Iniciando nó prepare_supporting_ocr', {
    inputImage: state.inputImage
  });

  const execute = traceStep(
    async () => {
      try {
        const supportingOcrObservation = OcrObservationSchema.parse(await recognizeSupportingLabels(state.inputImage, {
          outputDir: state.outputDir
        }));
        await persistStageJson(state.outputDir, '00-ocr-supporting-observation.json', supportingOcrObservation);

        logger.info('Nó prepare_supporting_ocr concluído com sucesso', {
          textCount: supportingOcrObservation.texts.length
        });

        return {
          supportingOcrObservation,
          stepMetrics: buildStepMetricUpdate('prepare_supporting_ocr', startedAt)
        };
      } catch (error) {
        const message = formatError(error);
        logger.warn('Falha no OCR azul; workflow continuará sem labels coadjuvantes determinísticas', {
          error: message
        });
        const supportingOcrObservation = OcrObservationSchema.parse({
          inputImage: state.inputImage,
          texts: [],
          assumptions: [`OCR azul não executado com sucesso: ${message}`]
        });
        await persistStageJson(state.outputDir, '00-ocr-supporting-observation.json', supportingOcrObservation);

        return {
          supportingOcrObservation,
          stepMetrics: buildStepMetricUpdate('prepare_supporting_ocr', startedAt)
        };
      }
    },
    {
      name: 'prepare_supporting_ocr_node',
      runType: 'chain',
      tags: ['node', 'ocr', 'deterministic'],
      metadata: {
        inputImage: state.inputImage
      }
    }
  );

  return execute();
}

export async function classifyOcrEventCandidatesNode(state: WorkflowGraphState) {
  const startedAt = Date.now();
  logger.info('Iniciando nó classify_ocr_event_candidates', {
    ocrTextCount: state.ocrObservation?.texts.length ?? 0
  });

  const execute = traceStep(
    async () => {
      const ocrEventCandidates = OcrEventCandidatesSchema.parse(
        buildOcrEventCandidates(state.ocrObservation, state.supportingOcrObservation)
      );
      await persistStageJson(state.outputDir, '00-ocr-event-candidates.json', ocrEventCandidates);

      logger.info('Nó classify_ocr_event_candidates concluído com sucesso', {
        trusted: ocrEventCandidates.trusted.length,
        uncertain: ocrEventCandidates.uncertain.length
      });

      return {
        ocrEventCandidates,
        stepMetrics: buildStepMetricUpdate('classify_ocr_event_candidates', startedAt)
      };
    },
    {
      name: 'classify_ocr_event_candidates_node',
      runType: 'chain',
      tags: ['node', 'ocr', 'deterministic'],
      metadata: {
        inputImage: state.inputImage
      }
    }
  );

  return execute();
}

export async function detectShapeGeometryNode(state: WorkflowGraphState) {
  const startedAt = Date.now();
  logger.info('Iniciando nó detect_shape_geometry', { inputImage: state.inputImage });

  const execute = traceStep(
    async () => {
      const shapeGeometry = ShapeGeometrySchema.parse(await detectShapeGeometry(state.inputImage));
      await persistStageJson(state.outputDir, '00-shape-geometry.json', shapeGeometry);

      logger.info('Nó detect_shape_geometry concluído com sucesso', {
        touchPointCandidates: shapeGeometry.touchPointCandidates.length,
        areaCandidates: shapeGeometry.areaCandidates.length
      });

      return {
        shapeGeometry,
        stepMetrics: buildStepMetricUpdate('detect_shape_geometry', startedAt)
      };
    },
    {
      name: 'detect_shape_geometry_node',
      runType: 'chain',
      tags: ['node', 'geometry', 'deterministic'],
      metadata: { inputImage: state.inputImage }
    }
  );

  return execute();
}

export async function detectArrowGeometryNode(state: WorkflowGraphState) {
  const startedAt = Date.now();
  logger.info('Iniciando nó detect_arrow_geometry', { inputImage: state.inputImage });

  const execute = traceStep(
    async () => {
      const arrowDetections = ArrowDetectionsSchema.parse(await detectArrowGeometry(state.inputImage));
      await persistStageJson(state.outputDir, '00-arrow-detections.json', arrowDetections);

      logger.info('Nó detect_arrow_geometry concluído com sucesso', {
        arrowCount: arrowDetections.arrows.length
      });

      return {
        arrowDetections,
        stepMetrics: buildStepMetricUpdate('detect_arrow_geometry', startedAt)
      };
    },
    {
      name: 'detect_arrow_geometry_node',
      runType: 'chain',
      tags: ['node', 'geometry', 'deterministic'],
      metadata: { inputImage: state.inputImage }
    }
  );

  return execute();
}

export async function extractFlowLegendsNode(state: WorkflowGraphState) {
  const startedAt = Date.now();
  logger.info('Iniciando nó extract_flow_legends', { inputImage: state.inputImage });

  const execute = traceStep(
    async () => {
      const flowLegendDetections = FlowLegendDetectionsSchema.parse(await recognizeFlowLegends(state.inputImage, {
        outputDir: state.outputDir
      }));
      await persistStageJson(state.outputDir, '00-flow-legends.json', flowLegendDetections);

      logger.info('Nó extract_flow_legends concluído com sucesso', {
        legendCount: flowLegendDetections.legends.length,
        ocrTextCount: flowLegendDetections.ocrTexts.length
      });

      return {
        flowLegendDetections,
        stepMetrics: buildStepMetricUpdate('extract_flow_legends', startedAt)
      };
    },
    {
      name: 'extract_flow_legends_node',
      runType: 'chain',
      tags: ['node', 'ocr', 'legend', 'deterministic'],
      metadata: { inputImage: state.inputImage }
    }
  );

  return execute();
}

export async function composeSpatialObservationNode(state: WorkflowGraphState) {
  const startedAt = Date.now();
  logger.info('Iniciando nó compose_spatial_observation', {
    eventCount: (state.ocrEventCandidates?.trusted.length ?? 0) + (state.ocrEventCandidates?.uncertain.length ?? 0),
    touchPointCandidates: state.shapeGeometry?.touchPointCandidates.length ?? 0,
    areaCandidates: state.shapeGeometry?.areaCandidates.length ?? 0,
    arrows: state.arrowDetections?.arrows.length ?? 0,
    legends: state.flowLegendDetections?.legends.length ?? 0
  });

  const execute = traceStep(
    async () => {
      const spatialObservation = buildSpatialObservation(
        state.ocrEventCandidates,
        state.shapeGeometry,
        state.arrowDetections,
        state.flowLegendDetections
      );
      await persistStageJson(state.outputDir, '00-spatial-observation.json', spatialObservation);

      logger.info('Nó compose_spatial_observation concluído com sucesso', {
        touchPointCount: spatialObservation.touchPointsDetected.length,
        areaCount: spatialObservation.areasDetected.length,
        flowCount: spatialObservation.flowsDetected.length
      });

      return {
        spatialObservation,
        stepMetrics: buildStepMetricUpdate('compose_spatial_observation', startedAt)
      };
    },
    {
      name: 'compose_spatial_observation_node',
      runType: 'chain',
      tags: ['node', 'spatial', 'deterministic'],
      metadata: { inputImage: state.inputImage }
    }
  );

  return execute();
}

export async function composeOcrTextObservationsNode(state: WorkflowGraphState) {
  const startedAt = Date.now();
  logger.info('Iniciando nó compose_ocr_text_observations', {
    trusted: state.ocrEventCandidates?.trusted.length ?? 0,
    uncertain: state.ocrEventCandidates?.uncertain.length ?? 0
  });

  const execute = traceStep(
    async () => {
      const ocrTextObservations = buildOcrTextObservations(state.ocrEventCandidates);
      await persistStageJson(state.outputDir, '00-ocr-text-observations.json', ocrTextObservations);

      logger.info('Nó compose_ocr_text_observations concluído com sucesso', {
        textObservationCount: ocrTextObservations.length
      });

      return {
        ocrTextObservations,
        stepMetrics: buildStepMetricUpdate('compose_ocr_text_observations', startedAt)
      };
    },
    {
      name: 'compose_ocr_text_observations_node',
      runType: 'chain',
      tags: ['node', 'ocr', 'deterministic'],
      metadata: {
        inputImage: state.inputImage
      }
    }
  );

  return execute();
}

export async function composeObservePromptContextNode(state: WorkflowGraphState) {
  const startedAt = Date.now();
  logger.info('Iniciando nó compose_observe_prompt_context', {
    trusted: state.ocrEventCandidates?.trusted.length ?? 0,
    textObservationCount: state.ocrTextObservations.length
  });

  const execute = traceStep(
    async () => {
      const observePromptContext = OcrPromptContextSchema.parse(
        buildObservePromptContext(
          state.ocrEventCandidates,
          state.ocrTextObservations,
          state.ocrObservation,
          state.supportingOcrObservation,
          state.shapeGeometry,
          state.arrowDetections,
          state.flowLegendDetections,
          state.spatialObservation
        )
      );
      await persistStageJson(state.outputDir, '00-observe-prompt-context.json', observePromptContext);

      logger.info('Nó compose_observe_prompt_context concluído com sucesso', {
        protagonistEventCount: observePromptContext.protagonistEventTitles.length,
        uncertainItemCount: observePromptContext.uncertainItems.length
      });

      return {
        observePromptContext,
        stepMetrics: buildStepMetricUpdate('compose_observe_prompt_context', startedAt)
      };
    },
    {
      name: 'compose_observe_prompt_context_node',
      runType: 'chain',
      tags: ['node', 'ocr', 'deterministic'],
      metadata: {
        inputImage: state.inputImage
      }
    }
  );

  return execute();
}

export async function composeDeterministicImageObservationNode(state: WorkflowGraphState) {
  const startedAt = Date.now();
  logger.info('Iniciando nó compose_deterministic_image_observation', {
    hasObservePromptContext: Boolean(state.observePromptContext)
  });

  const execute = traceStep(
    async () => {
      const deterministicImageObservation = ImageObservationSchema.parse(
        sanitizeImageObservation(buildDeterministicImageObservation(state.observePromptContext), state.observePromptContext)
      );
      await persistStageJson(state.outputDir, '00-deterministic-image-observation.json', deterministicImageObservation);

      logger.info('Nó compose_deterministic_image_observation concluído com sucesso', {
        touchPointCount: deterministicImageObservation.touchPointsDetected.length,
        areaCount: deterministicImageObservation.areasDetected.length,
        outsideTextCount: deterministicImageObservation.textsOutsideShapes.length,
        flowCount: deterministicImageObservation.flowsDetected.length
      });

      return {
        deterministicImageObservation,
        imageObservation: deterministicImageObservation,
        stepMetrics: buildStepMetricUpdate('compose_deterministic_image_observation', startedAt)
      };
    },
    {
      name: 'compose_deterministic_image_observation_node',
      runType: 'chain',
      tags: ['node', 'observe', 'deterministic'],
      metadata: {
        inputImage: state.inputImage
      }
    }
  );

  return execute();
}

export async function observeImageNode(state: WorkflowGraphState) {
  const startedAt = Date.now();
  const attempt = state.observeAttempts + 1;
  const feedback = state.observeAttempts > 0 ? state.observeFeedback : t('feedback.none');
  logger.info('Iniciando nó observe_image', {
    attempt,
    inputImage: state.inputImage,
    feedbackLength: feedback.length
  });

  const prompt = await renderPrompt('observe-image.prompt.md', {
    feedback,
    ocr_context_json: JSON.stringify(state.observePromptContext, null, 2),
    deterministic_observation_json: JSON.stringify(state.deterministicImageObservation, null, 2)
  });

  const execute = traceStep(
    async () => {
      const response = await buildChatModel(state.provider, state.observeModel).invoke([
        new SystemMessage(prompt),
	        new HumanMessage({
	          content: [
	            { type: 'text', text: `Arquivo de entrada: ${path.basename(state.inputImage)}` },
	            { type: 'text', text: 'Observe a imagem e retorne apenas o JSON solicitado.' },
	            imageContentFromFile(state.inputImage),
	            ...buildOcrReviewImageContent(state.ocrObservation)
	          ]
	        })
      ]);
      const parsedPayload = response.content;
      await persistRawResponse(state.outputDir, '01-image-observation', attempt, parsedPayload);

      const observation = sanitizeImageObservation(
        ImageObservationSchema.parse(parseJsonResponse(parsedPayload)),
        state.observePromptContext
      );
      await persistStageJson(state.outputDir, '01-image-observation.json', observation);

      logger.info('Nó observe_image concluído com sucesso', {
        attempt,
        touchPointCount: observation.touchPointsDetected.length,
        outsideTextCount: observation.textsOutsideShapes.length,
        usage: response.usage
      });

      return {
        observeAttempts: attempt,
        imageObservation: observation,
        observeFeedback: t('feedback.none'),
        stepMetrics: buildStepMetricUpdate('observe_image', startedAt, response.usage)
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
      stepMetrics: buildStepMetricUpdate('observe_image', startedAt),
      failures: [`observe: ${message}`]
    };
  }
}

export async function validateImageObservationNode(state: WorkflowGraphState) {
  const startedAt = Date.now();
  logger.info('Iniciando nó validate_image_observation', {
    observeAttempts: state.observeAttempts
  });

  const execute = traceStep(
    async () => {
      const issues = validateImageObservation(state.imageObservation);
      if (issues.length === 0) {
        logger.info('Validação da observação concluída sem erros');
        return {
          observeFeedback: t('feedback.none'),
          stepMetrics: buildStepMetricUpdate('validate_image_observation', startedAt)
        };
      }

      logger.warn('Validação da observação encontrou inconsistências', {
        issueCount: issues.length,
        issues
      });

      return {
        observeFeedback: issues.join('\n'),
        stepMetrics: buildStepMetricUpdate('validate_image_observation', startedAt),
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
  const startedAt = Date.now();
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
    feedback: state.extractAttempts > 0 ? state.extractFeedback : t('feedback.none'),
    input_json: JSON.stringify(imageObservation, null, 2)
  });

  const model = buildChatModel(state.provider, state.extractModel);
  const deterministicCandidateContext = normalizeCandidateContextDomainModels(
    imageObservationToCandidateContext(imageObservation, { inputImage: state.inputImage }),
    { inputImage: state.inputImage, env: state.env }
  );
  const execute = traceStep(
    async () => {
      const response = await model.invoke([
        new SystemMessage(prompt),
        new HumanMessage('Extraia apenas os eventos candidatos e fluxos candidatos.')
      ]);
      await persistRawResponse(state.outputDir, '02-candidate-events', attempt, response.content);

      const parsedCandidateContext = CandidateContextSchema.parse(parseJsonResponse(response.content));
      const candidateContext = normalizeCandidateContextDomainModels(
        shouldUseDeterministicCandidateContext(parsedCandidateContext, imageObservation)
          ? deterministicCandidateContext
          : enrichCandidateContextFromObservation(
              parsedCandidateContext,
              imageObservation,
              { inputImage: state.inputImage, env: state.env }
            ),
        { inputImage: state.inputImage, env: state.env }
      );
      await persistStageJson(state.outputDir, '02-candidate-events.json', candidateContext);

      logger.info('Nó extract_events concluído com sucesso', {
        attempt,
        candidateEventCount: candidateContext.candidateEvents.length,
        candidateFlowCount: candidateContext.candidateFlows.length,
        usage: response.usage
      });

      return {
        extractAttempts: attempt,
        candidateContext,
        extractFeedback: t('feedback.none'),
        stepMetrics: buildStepMetricUpdate('extract_events', startedAt, response.usage)
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
      extractFeedback: `fallback determinístico aplicado após falha do extractor: ${message}`,
      stepMetrics: buildStepMetricUpdate('extract_events', startedAt)
    };
  }
}

export async function validateCandidateEventsNode(state: WorkflowGraphState) {
  const startedAt = Date.now();
  logger.info('Iniciando nó validate_candidate_events', {
    extractAttempts: state.extractAttempts
  });

  const execute = traceStep(
    async () => {
      const issues = validateCandidateContext(state.candidateContext);
      if (issues.length === 0) {
        logger.info('Validação dos candidatos concluída sem erros');
        return {
          extractFeedback: t('feedback.none'),
          stepMetrics: buildStepMetricUpdate('validate_candidate_events', startedAt)
        };
      }

      logger.warn('Validação dos candidatos encontrou inconsistências', {
        issueCount: issues.length,
        issues
      });

      return {
        extractFeedback: issues.join('\n'),
        stepMetrics: buildStepMetricUpdate('validate_candidate_events', startedAt),
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
  const startedAt = Date.now();
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
    feedback: state.normalizeAttempts > 0 ? state.normalizeFeedback : t('feedback.none'),
    input_json: JSON.stringify(candidateContext, null, 2),
    observation_json: JSON.stringify(state.imageObservation ?? null, null, 2)
  });

  const model = buildChatModel(state.provider, state.normalizeModel);
  const deterministicContext = candidateContextToRecognizedContext(candidateContext, {
    inputImage: state.inputImage,
    env: state.env
  });
  const execute = traceStep(
    async () => {
      const response = await model.invoke([
        new SystemMessage(prompt),
        new HumanMessage({
          content: [
            { type: 'text', text: 'Revise os candidatos contra a observação visual e a imagem original. Devolva apenas o JSON de correções.' },
            imageContentFromFile(state.inputImage)
          ]
        })
      ]);
      await persistRawResponse(state.outputDir, '03-standardized-context', attempt, response.content);

      const review = NormalizationReviewSchema.parse(parseJsonResponse(response.content));
      const standardizedContext = canonicalizeContext(applyNormalizationReview(candidateContext, review, {
        inputImage: state.inputImage,
        env: state.env
      }), { env: state.env });

      await persistStageJson(state.outputDir, '03-standardized-context.json', standardizedContext);

      logger.info('Nó normalize_context concluído com sucesso', {
        attempt,
        flowCount: standardizedContext.recognizedFlows.length,
        rowCount: standardizedContext.rows.length,
        usage: response.usage
      });

      return {
        normalizeAttempts: attempt,
        standardizedContext,
        normalizeFeedback: t('feedback.none'),
        stepMetrics: buildStepMetricUpdate('normalize_context', startedAt, response.usage)
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

    const standardizedContext = canonicalizeContext(deterministicContext, { env: state.env });
    await persistStageJson(state.outputDir, '03-standardized-context.json', standardizedContext);

    return {
      normalizeAttempts: attempt,
      standardizedContext,
      normalizeFeedback: `fallback determinístico aplicado após falha do reviewer: ${message}`,
      stepMetrics: buildStepMetricUpdate('normalize_context', startedAt)
    };
  }
}

export async function validateNormalizationNode(state: WorkflowGraphState) {
  const startedAt = Date.now();
  logger.info('Iniciando nó validate_normalization', {
    normalizeAttempts: state.normalizeAttempts
  });

  const execute = traceStep(
    async () => {
      const issues = validateRecognizedContext(state.standardizedContext, 'normalize', { env: state.env });
      if (issues.length === 0) {
        logger.info('Validação da normalização concluída sem erros');
        return {
          normalizeFeedback: t('feedback.none'),
          stepMetrics: buildStepMetricUpdate('validate_normalization', startedAt)
        };
      }

      logger.warn('Validação da normalização encontrou inconsistências', {
        issueCount: issues.length,
        issues
      });

      return {
        normalizeFeedback: issues.join('\n'),
        stepMetrics: buildStepMetricUpdate('validate_normalization', startedAt),
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
  const startedAt = Date.now();
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
        sheetName: 'project_input',
        columns: [...PROJECT_FORMAT_COLUMNS],
        rows: standardizedContext.rows,
        notes: buildWorkbookNotes(state.inputImage, standardizedContext.assumptions)
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
        workbookFeedback: t('feedback.none'),
        stepMetrics: buildStepMetricUpdate('create_workbook', startedAt)
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
      stepMetrics: buildStepMetricUpdate('create_workbook', startedAt),
      failures: [`workbook: ${message}`]
    };
  }
}

export async function validateWorkbookNode(state: WorkflowGraphState) {
  const startedAt = Date.now();
  logger.info('Iniciando nó validate_workbook', {
    workbookAttempts: state.workbookAttempts
  });

  const execute = traceStep(
    async () => {
      const issues = validateWorkbook(state.workbook);
      if (issues.length === 0) {
        logger.info('Validação do workbook concluída sem erros');
        return {
          workbookFeedback: t('feedback.none'),
          stepMetrics: buildStepMetricUpdate('validate_workbook', startedAt)
        };
      }

      logger.warn('Validação do workbook encontrou inconsistências', {
        issueCount: issues.length,
        issues
      });

      return {
        workbookFeedback: issues.join('\n'),
        stepMetrics: buildStepMetricUpdate('validate_workbook', startedAt),
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
  const startedAt = Date.now();
  const lastFailure = state.failures.at(-1) ?? t('error.workflowNoDetails');
  logger.error('Encerrando workflow em fail', {
    failures: state.failures,
    lastFailure
  });

  const execute = traceStep(
    async () => {
      return {
        stepMetrics: buildStepMetricUpdate('fail', startedAt)
      };
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

async function persistRawResponse(outputDir: string, stagePrefix: string, attempt: number, payload: unknown): Promise<void> {
  const filePath = path.join(outputDir, `${stagePrefix}.attempt-${attempt}.raw.txt`);
  await writeTextFile(filePath, `${extractRawResponseText(payload)}\n`);
}

function buildOcrEventCandidates(
  ocrObservation: OcrObservation | null,
  supportingOcrObservation: OcrObservation | null
): OcrEventCandidates {
  const redTexts = ocrObservation?.texts ?? [];
  const blueTexts = supportingOcrObservation?.texts ?? [];
  if (redTexts.length === 0 && blueTexts.length === 0) {
    return { trusted: [], uncertain: [], assumptions: [t('ocr.technicalUnavailable')] };
  }

  const candidates = [
    ...redTexts.map((text) => ({ text, role: 'protagonist' as const, colorHex: '#FF0000' as const })),
    ...blueTexts.map((text) => ({ text, role: 'supporting' as const, colorHex: '#305CDE' as const }))
  ].map(({ text, role, colorHex }) => {
    const confidence = Number((text.confidence / 100).toFixed(3));
    return {
      eventTitle: text.text,
      role,
      colorHex,
      confidence,
      source: text.source,
      bbox: text.bbox,
      ocrAlternatives: text.ocrAlternatives,
      ambiguousCharacters: text.ambiguousCharacters,
      needsOcrReview: text.needsOcrReview,
      reasoning: text.needsOcrReview
        ? t('ocr.technicalReviewNeeded', { color: role === 'protagonist' ? translatedColor('red') : translatedColor('blue') })
        : t('ocr.technicalTrusted', { color: role === 'protagonist' ? translatedColor('red') : translatedColor('blue'), role })
    };
  });
  const compactedCandidates = removeFragmentEventCandidates(candidates);

  const trusted = compactedCandidates.filter((candidate) => !candidate.needsOcrReview);
  const uncertain = compactedCandidates.filter((candidate) => candidate.needsOcrReview);

  return {
    trusted,
    uncertain,
    assumptions: [
      ...(ocrObservation?.assumptions ?? []),
      ...(supportingOcrObservation?.assumptions ?? []),
      ...(compactedCandidates.length < candidates.length
        ? [t('ocr.fragmentsRemoved', { count: candidates.length - compactedCandidates.length })]
        : []),
      t('ocr.eventsCoverage')
    ]
  };
}

function removeFragmentEventCandidates(
  candidates: Array<OcrEventCandidates['trusted'][number]>
): Array<OcrEventCandidates['trusted'][number]> {
  return candidates.filter((candidate, index) => {
    const candidateTokens = equivalenceTokens(candidate.eventTitle);
    if (candidateTokens.length === 0) {
      return false;
    }

    return !candidates.some((other, otherIndex) => {
      if (index === otherIndex || candidate.role !== other.role || candidate.colorHex !== other.colorHex) {
        return false;
      }
      const otherTokens = equivalenceTokens(other.eventTitle);
      if (otherTokens.length <= candidateTokens.length) {
        return false;
      }
      if (!tokensContainSequence(otherTokens, candidateTokens)) {
        return false;
      }
      return candidateTokens.length <= 2 || candidateTokens.length / otherTokens.length <= 0.75;
    });
  });
}

function buildOcrTextObservations(ocrEventCandidates: OcrEventCandidates | null): ImageObservation['textObservations'] {
  if (!ocrEventCandidates) {
    return [];
  }

  return [...ocrEventCandidates.trusted, ...ocrEventCandidates.uncertain].map((candidate) => ({
    text: candidate.eventTitle,
    kind: candidate.needsOcrReview ? 'uncertain' as const : 'event_candidate' as const,
    role: candidate.role,
    colorHex: candidate.colorHex,
    confidence: candidate.confidence,
    locationHint: locationHintFromBbox(candidate.bbox),
    ocrAlternatives: candidate.ocrAlternatives,
    ambiguousCharacters: candidate.ambiguousCharacters,
    needsOcrReview: candidate.needsOcrReview,
    reasoning: candidate.reasoning
  }));
}

function buildSpatialObservation(
  ocrEventCandidates: OcrEventCandidates | null,
  shapeGeometry: ShapeGeometry | null,
  arrowDetections: ArrowDetections | null,
  flowLegendDetections: FlowLegendDetections | null
): NonNullable<OcrPromptContext['spatialComposition']> {
  const events = [...(ocrEventCandidates?.trusted ?? []), ...(ocrEventCandidates?.uncertain ?? [])]
    .filter((event) => !event.needsOcrReview && event.bbox);
  const eventTitles = events.map((event) => event.eventTitle);
  const areaCandidates = labelGeometryCandidates(shapeGeometry?.areaCandidates ?? [], flowLegendDetections, 'area')
    .filter((candidate) => candidate.label)
    .filter((candidate) => !isTechnicalEventLabel(candidate.label as string))
    .filter((candidate) => !hasEquivalent(candidate.label as string, eventTitles));
  const areaLabels = new Set(areaCandidates.map((candidate, index) => candidate.label ?? `Área ${index + 1}`));
  const shapeTouchPointCandidates = mergeAdjacentTouchPointLabelFragments(
    labelGeometryCandidates(shapeGeometry?.touchPointCandidates ?? [], flowLegendDetections, 'touch_point')
      .map((candidate) => normalizeTouchPointCandidateLabel(candidate))
  )
    .filter((candidate) => candidate.confidence >= 0.6)
    .filter((candidate) => candidate.label && isReliableTouchPointLabel(candidate.label))
    .filter((candidate) => !isTechnicalEventLabel(candidate.label as string))
    .filter((candidate) => !hasEquivalent(candidate.label as string, eventTitles))
    .filter((candidate) => !isLabelFragmentOfAny(candidate.label as string, eventTitles))
    .filter((candidate, index) => !areaLabels.has(candidate.label ?? `Touch Point ${index + 1}`));
  const ocrTouchPointCandidates = buildOcrTouchPointCandidates(
    flowLegendDetections,
    events,
    areaCandidates.map((candidate, index) => candidate.label ?? `Área ${index + 1}`)
  );
  const touchPointCandidates = mergeTouchPointCandidates([...shapeTouchPointCandidates, ...ocrTouchPointCandidates]);
  const touchPointsDetected = touchPointCandidates.map((candidate, index) => candidate.label ?? `Touch Point ${index + 1}`);
  const areasDetected = areaCandidates.map((candidate, index) => candidate.label ?? `Área ${index + 1}`);
  const textsOutsideShapes = events.map((event) => event.eventTitle);
  const touchPointEventCorrelations = buildSpatialCorrelations(events, touchPointCandidates);
  const flowsDetected = buildSpatialFlows(events, touchPointsDetected, arrowDetections, flowLegendDetections);

  return {
    touchPointsDetected,
    areasDetected,
    textsOutsideShapes,
    touchPointEventCorrelations,
    flowsDetected,
    assumptions: [
      t('spatial.assumption'),
      ...touchPointCandidates
        .filter((candidate) => !candidate.label)
        .map((candidate) => t('spatial.unlabeledShape', { id: candidate.id })),
      ...areaCandidates
        .filter((candidate) => !candidate.label)
        .map((candidate) => t('spatial.unlabeledShape', { id: candidate.id }))
    ]
  };
}

function buildOcrTouchPointCandidates(
  flowLegendDetections: FlowLegendDetections | null,
  events: Array<OcrEventCandidates['trusted'][number]>,
  areaTitles: string[]
): Array<{ id: string; label?: string; bbox: { x: number; y: number; width: number; height: number }; confidence: number; reasoning: string }> {
  const eventTitles = events.map((event) => event.eventTitle);
  const eventBboxes = events
    .map((event) => event.bbox)
    .filter((bbox): bbox is NonNullable<OcrEventCandidates['trusted'][number]['bbox']> => Boolean(bbox));

  return (flowLegendDetections?.ocrTexts ?? [])
    .filter((text) => text.bbox && !text.needsOcrReview && text.confidence >= 70)
    .filter((text) => hasNearbyEventBbox(text.bbox as NonNullable<typeof text.bbox>, eventBboxes))
    .map((text, index) => ({
      id: `ocr_touch_point_${index + 1}`,
      label: normalizeTouchPointLabel(text.text),
      bbox: text.bbox as NonNullable<typeof text.bbox>,
      confidence: Number((text.confidence / 100).toFixed(3)),
      reasoning: t('touchPoint.ocrCandidateReasoning')
    }))
    .filter((candidate) => candidate.label && isReliableTouchPointLabel(candidate.label))
    .filter((candidate) => !hasEquivalent(candidate.label as string, eventTitles))
    .filter((candidate) => !isLabelFragmentOfAny(candidate.label as string, eventTitles))
    .filter((candidate) => !hasEquivalent(candidate.label as string, areaTitles));
}

function hasNearbyEventBbox(
  labelBbox: { x: number; y: number; width: number; height: number },
  eventBboxes: Array<{ x: number; y: number; width: number; height: number }>
): boolean {
  return eventBboxes.some((eventBbox) => {
    const distance = bboxDistance(labelBbox, eventBbox);
    const verticalDistance = Math.abs(bboxCenter(labelBbox).y - bboxCenter(eventBbox).y);
    const horizontalDistance = Math.abs(bboxCenter(labelBbox).x - bboxCenter(eventBbox).x);

    return distance <= 460 && verticalDistance <= 150 && horizontalDistance <= 460;
  });
}

function normalizeTouchPointCandidateLabel<T extends { label?: string }>(candidate: T): T {
  if (!candidate.label) {
    return candidate;
  }
  return {
    ...candidate,
    label: normalizeTouchPointLabel(candidate.label)
  };
}

function normalizeTouchPointLabel(label: string): string {
  return label
    .replace(/[|]/g, ' ')
    .replace(/\bSignin\b/gi, 'Sign In')
    .replace(/\bSignup\b/gi, 'Sign Up')
    .replace(/\bP[eé]gina\b/gi, 'Página')
    .replace(/\bPágina da Curso\b/gi, 'Página do Curso')
    .replace(/\bPagina da Curso\b/gi, 'Página do Curso')
    .replace(/\bCriag(?:do| o|eio|éio)\b/gi, 'Criação')
    .replace(/\bUsuario\b/gi, 'Usuário')
    .replace(/\bCobranca\b/gi, 'Cobrança')
    .replace(/\bobranca\b/gi, 'Cobrança')
    .replace(/\bCheckour\b/gi, 'Checkout')
    .replace(/\bCadastrads\b/gi, 'Cadastrada')
    .replace(/\bCriação do do Usuário\b/gi, 'Criação do Usuário')
    .replace(/\bCriação do do Usuario\b/gi, 'Criação do Usuário')
    .replace(/\s+/g, ' ')
    .trim();
}

function isReliableTouchPointLabel(label: string): boolean {
  const key = equivalencePhraseKey(label);
  const tokens = equivalenceTokens(label);
  if (key.length < 3 || !/\p{L}/u.test(label)) {
    return false;
  }
  if (/[._]/.test(label) || isFlowLegendHeader(label)) {
    return false;
  }
  if (tokens.length === 0 || tokens.length > 10) {
    return false;
  }
  if (!tokens.some((token) => token.length >= 3)) {
    return false;
  }
  if (tokens.length <= 2 && tokens.some((token) => isLikelyOcrNoiseToken(token))) {
    return false;
  }
  if (hasHighOcrNoiseTokenRatio(tokens) || hasSuspiciousRepeatedTokens(tokens)) {
    return false;
  }
  if (tokens.length === 1 && tokens[0].length < 5) {
    return false;
  }
  if (tokens.every((token) => NON_LABEL_TOKENS.has(token))) {
    return false;
  }
  if (tokens.every((token) => STRUCTURAL_LABEL_TOKENS.has(token))) {
    return false;
  }
  if (tokens.length === 1 && WEAK_SINGLE_WORD_LABELS.has(tokens[0])) {
    return false;
  }
  return true;
}

function isTechnicalEventLabel(label: string): boolean {
  return /[._]/.test(label) || /^[a-z]+(?:\.[a-z0-9]+){2,}$/i.test(label.trim());
}

function isLikelyOcrNoiseToken(token: string): boolean {
  if (NON_LABEL_TOKENS.has(token)) {
    return false;
  }
  if (token.length <= 2) {
    return true;
  }
  if (token.length <= 4 && !/[aeiou]/i.test(token)) {
    return true;
  }
  if (/^(i+l+|l+i+|jil|iwi|oud|sll|iit|ile|wig|fit|rap|ner|ails|lise)$/i.test(token)) {
    return true;
  }
  return false;
}

function hasHighOcrNoiseTokenRatio(tokens: string[]): boolean {
  const meaningfulTokens = tokens.filter((token) => !NON_LABEL_TOKENS.has(token));
  if (meaningfulTokens.length === 0) {
    return true;
  }
  const noiseCount = meaningfulTokens.filter(isLikelyOcrNoiseToken).length;
  return noiseCount / meaningfulTokens.length >= 0.4;
}

function hasSuspiciousRepeatedTokens(tokens: string[]): boolean {
  const meaningfulTokens = tokens.filter((token) => !NON_LABEL_TOKENS.has(token));
  if (meaningfulTokens.length < 3) {
    return false;
  }
  const counts = new Map<string, number>();
  for (const token of meaningfulTokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.values()].some((count) => count >= 3);
}

const NON_LABEL_TOKENS = new Set([
  'a', 'an', 'and', 'as', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'in', 'na', 'nas', 'no', 'nos',
  'o', 'of', 'on', 'op', 'or', 'p', 'para', 'por', 'the', 'to'
]);

const WEAK_SINGLE_WORD_LABELS = new Set([
  'done', 'false', 'no', 'nao', 'none', 'null', 'ok', 'sim', 'true', 'yes'
]);

const STRUCTURAL_LABEL_TOKENS = new Set([
  'actor', 'actors', 'approver', 'earner', 'integration', 'provider', 'providers', 'role', 'roles',
  'sistema', 'system', 'user', 'users'
]);

function mergeAdjacentTouchPointLabelFragments<
  T extends { id: string; label?: string; bbox: { x: number; y: number; width: number; height: number }; confidence: number; reasoning: string }
>(candidates: T[]): T[] {
  const sortedCandidates = [...candidates].sort((left, right) => {
    if (Math.abs(left.bbox.y - right.bbox.y) > 30) return left.bbox.y - right.bbox.y;
    return left.bbox.x - right.bbox.x;
  });
  const merged: T[] = [];
  const used = new Set<T>();

  for (const candidate of sortedCandidates) {
    if (used.has(candidate)) continue;
    const pair = sortedCandidates.find((other) =>
      other !== candidate
      && !used.has(other)
      && canMergeTouchPointFragments(candidate, other)
    );
    if (!pair || !candidate.label || !pair.label) {
      merged.push(candidate);
      continue;
    }

    used.add(candidate);
    used.add(pair);
    const left = candidate.bbox.x <= pair.bbox.x ? candidate : pair;
    const right = left === candidate ? pair : candidate;
    merged.push({
      ...left,
      id: `${left.id}_${right.id}`,
      label: normalizeTouchPointLabel(`${left.label} ${right.label}`),
      bbox: mergeBboxes(left.bbox, right.bbox),
      confidence: Math.max(left.confidence, right.confidence),
      reasoning: `${left.reasoning} Label textual mesclada com ${right.id} por fragmentação OCR adjacente.`
    } as T);
  }

  return merged;
}

function canMergeTouchPointFragments(
  left: { label?: string; bbox: { x: number; y: number; width: number; height: number } },
  right: { label?: string; bbox: { x: number; y: number; width: number; height: number } }
): boolean {
  if (!left.label || !right.label) return false;
  const leftKey = equivalencePhraseKey(left.label);
  const rightKey = equivalencePhraseKey(right.label);
  const ordered = left.bbox.x <= right.bbox.x
    ? [leftKey, rightKey, left.bbox, right.bbox] as const
    : [rightKey, leftKey, right.bbox, left.bbox] as const;
  const [firstKey, secondKey, firstBbox, secondBbox] = ordered;
  const verticalOverlap = bboxOverlap1d(firstBbox.y, firstBbox.y + firstBbox.height, secondBbox.y, secondBbox.y + secondBbox.height);
  const minHeight = Math.min(firstBbox.height, secondBbox.height);
  const horizontalGap = secondBbox.x - (firstBbox.x + firstBbox.width);

  return verticalOverlap / Math.max(1, minHeight) >= 0.45
    && horizontalGap >= -50
    && horizontalGap <= 35
    && isLikelyTouchPointFragmentPair(firstKey, secondKey);
}

function isLikelyTouchPointFragmentPair(firstKey: string, secondKey: string): boolean {
  const combined = `${firstKey} ${secondKey}`.trim();
  const firstTokens = firstKey.split(' ').filter(Boolean);
  const secondTokens = secondKey.split(' ').filter(Boolean);
  const combinedTokens = [...firstTokens, ...secondTokens];

  if (combinedTokens.length < 2 || combinedTokens.length > 8 || !isReliableTouchPointLabel(combined)) {
    return false;
  }

  const firstLooksIncomplete = firstTokens.length <= 2 && (
    firstTokens.some((token) => NON_LABEL_TOKENS.has(token))
    || ['da', 'das', 'de', 'do', 'dos', 'of', 'to'].includes(firstTokens[firstTokens.length - 1] ?? '')
  );
  const secondLooksIncomplete = secondTokens.length <= 2 && (
    secondTokens.some((token) => NON_LABEL_TOKENS.has(token))
    || ['da', 'das', 'de', 'do', 'dos', 'of', 'to'].includes(secondTokens[0] ?? '')
  );

  return firstLooksIncomplete || secondLooksIncomplete || firstTokens.length === 1 || secondTokens.length === 1;
}

function mergeBboxes(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number }
): { x: number; y: number; width: number; height: number } {
  const minX = Math.min(left.x, right.x);
  const minY = Math.min(left.y, right.y);
  const maxX = Math.max(left.x + left.width, right.x + right.width);
  const maxY = Math.max(left.y + left.height, right.y + right.height);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function bboxOverlap1d(leftStart: number, leftEnd: number, rightStart: number, rightEnd: number): number {
  return Math.max(0, Math.min(leftEnd, rightEnd) - Math.max(leftStart, rightStart));
}

function mergeTouchPointCandidates<T extends { id: string; label?: string; bbox: { x: number; y: number; width: number; height: number }; confidence: number; reasoning: string }>(
  candidates: T[]
): T[] {
  const byLabel = new Map<string, T>();
  for (const candidate of candidates) {
    if (!candidate.label) continue;
    const key = equivalencePhraseKey(candidate.label);
    const current = byLabel.get(key);
    if (!current || touchPointCandidateScore(candidate) > touchPointCandidateScore(current)) {
      byLabel.set(key, candidate);
    }
  }
  return removeFragmentTouchPointCandidates([...byLabel.values()]).sort((left, right) => {
    if (Math.abs(left.bbox.y - right.bbox.y) > 40) return left.bbox.y - right.bbox.y;
    return left.bbox.x - right.bbox.x;
  });
}

function removeFragmentTouchPointCandidates<T extends { label?: string }>(candidates: T[]): T[] {
  return candidates.filter((candidate) => {
    if (!candidate.label) return false;
    return !candidates.some((other) =>
      other !== candidate
      && other.label
      && isLabelFragmentOf(candidate.label as string, other.label)
    );
  });
}

function isLabelFragmentOfAny(label: string, candidates: string[]): boolean {
  return candidates.some((candidate) => isLabelFragmentOf(label, candidate));
}

function isLabelFragmentOf(label: string, candidate: string): boolean {
  const labelTokens = equivalenceTokens(label);
  const candidateTokens = equivalenceTokens(candidate);
  if (labelTokens.length === 0 || candidateTokens.length <= labelTokens.length) {
    return false;
  }
  return tokensContainSequence(candidateTokens, labelTokens)
    && (labelTokens.length <= 2 || labelTokens.length / candidateTokens.length <= 0.75);
}

function touchPointCandidateScore(candidate: { label?: string; bbox: { width: number; height: number }; confidence: number }): number {
  const labelScore = candidate.label ? Math.min(4, equivalencePhraseKey(candidate.label).split(' ').length) : 0;
  return candidate.confidence + labelScore + Math.min(1, (candidate.bbox.width * candidate.bbox.height) / 20000);
}

function labelGeometryCandidates<T extends { id: string; bbox: { x: number; y: number; width: number; height: number }; label?: string }>(
  candidates: T[],
  flowLegendDetections: FlowLegendDetections | null,
  kind: 'area' | 'touch_point'
): T[] {
  const ocrTexts = flowLegendDetections?.ocrTexts ?? [];
  return candidates.map((candidate) => {
    const label = kind === 'area'
      ? areaLabelFromOcr(candidate.bbox, ocrTexts)
      : touchPointLabelFromOcr(candidate.bbox, ocrTexts);
    return {
      ...candidate,
      label: candidate.label ?? label
    };
  });
}

function touchPointLabelFromOcr(
  bbox: { x: number; y: number; width: number; height: number },
  ocrTexts: FlowLegendDetections['ocrTexts']
): string | undefined {
  const inside = ocrTexts
    .filter((text) => text.bbox && isUsableShapeLabelText(text) && bboxContains(expandBbox(bbox, 6), text.bbox))
    .sort((left, right) => {
      const leftBox = left.bbox as NonNullable<typeof left.bbox>;
      const rightBox = right.bbox as NonNullable<typeof right.bbox>;
      if (Math.abs(leftBox.y - rightBox.y) > 8) return leftBox.y - rightBox.y;
      return leftBox.x - rightBox.x;
    });

  return joinShapeLabelLines(inside.map((text) => text.text));
}

function isUsableShapeLabelText(text: FlowLegendDetections['ocrTexts'][number]): boolean {
  if (text.confidence < 55) {
    return false;
  }
  if (isFlowLegendHeader(text.text)) {
    return false;
  }
  if (/^(op|integration)$/i.test(text.text.trim())) {
    return false;
  }
  return true;
}

function areaLabelFromOcr(
  bbox: { x: number; y: number; width: number; height: number },
  ocrTexts: FlowLegendDetections['ocrTexts']
): string | undefined {
  const headerBand = {
    x: bbox.x,
    y: Math.max(0, bbox.y - 70),
    width: bbox.width,
    height: Math.min(bbox.height, 110)
  };
  const candidates = ocrTexts
    .filter((text) => text.bbox && !text.needsOcrReview && bboxContains(headerBand, text.bbox))
    .filter((text) => !isFlowLegendHeader(text.text))
    .map((text) => ({
      ...text,
      text: normalizeTouchPointLabel(text.text)
    }))
    .filter((text) => isReliableAreaLabel(text.text))
    .sort((left, right) => {
      const leftBox = left.bbox as NonNullable<typeof left.bbox>;
      const rightBox = right.bbox as NonNullable<typeof right.bbox>;
      if (Math.abs(leftBox.y - rightBox.y) > 8) return leftBox.y - rightBox.y;
      return leftBox.x - rightBox.x;
    });

  return candidates
    .sort((left, right) => {
      const confidenceDelta = right.confidence - left.confidence;
      if (Math.abs(confidenceDelta) > 8) return confidenceDelta;
      return right.text.length - left.text.length;
    })[0]?.text;
}

function isReliableAreaLabel(label: string): boolean {
  if (isTechnicalEventLabel(label)) {
    return false;
  }
  const tokens = equivalenceTokens(label);
  const meaningfulTokens = tokens.filter((token) => !NON_LABEL_TOKENS.has(token));
  if (meaningfulTokens.length < 2) {
    return false;
  }
  if (hasHighOcrNoiseTokenRatio(tokens) || hasSuspiciousRepeatedTokens(tokens)) {
    return false;
  }
  return true;
}

function joinShapeLabelLines(lines: string[]): string | undefined {
  const filtered = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 1)
    .filter((line) => !isFlowLegendHeader(line))
    .filter((line) => !/^(op|integration)$/i.test(line));
  if (filtered.length === 0) {
    return undefined;
  }
  return uniqueStrings(filtered).join(' ');
}

function isFlowLegendHeader(value: string): boolean {
  return /caminho\s+(feliz|alternativo|principal)|fluxo\s+(principal|alternativo)|happy\s+path|alternate\s+path/i
    .test(value.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
}

function buildSpatialCorrelations(
  events: Array<OcrEventCandidates['trusted'][number]>,
  touchPointCandidates: Array<{ id: string; label?: string; bbox: { x: number; y: number; width: number; height: number } }>
): ImageObservation['touchPointEventCorrelations'] {
  const byTouchPoint = new Map<string, string[]>();

  for (const event of events) {
    if (!event.bbox || touchPointCandidates.length === 0) {
      continue;
    }

    const nearest = touchPointCandidates
      .map((candidate, index) => ({
        title: candidate.label ?? `Touch Point ${index + 1}`,
        distance: bboxDistance(event.bbox as NonNullable<typeof event.bbox>, candidate.bbox)
      }))
      .sort((left, right) => left.distance - right.distance)[0];
    if (!nearest) continue;
    byTouchPoint.set(nearest.title, [...(byTouchPoint.get(nearest.title) ?? []), event.eventTitle]);
  }

  return [...byTouchPoint.entries()].map(([touchPointTitle, eventsObservedAroundTouchPoint]) => ({
    touchPointTitle,
    eventsObservedAroundTouchPoint,
    confidence: 0.58,
    reasoning: t('correlation.nearestBbox')
  }));
}

function buildSpatialFlows(
  events: Array<OcrEventCandidates['trusted'][number]>,
  touchPointsDetected: string[],
  arrowDetections: ArrowDetections | null,
  flowLegendDetections: FlowLegendDetections | null
): ImageObservation['flowsDetected'] {
  const eventTitleByKey = new Map(events.map((event) => [equivalenceKey(event.eventTitle), event.eventTitle]));
  const legendFlows = (flowLegendDetections?.legends ?? [])
    .map((legend) => ({
      name: legend.name,
      flowType: legend.flowType,
      arrowStyle: legend.flowType === 'alternate' ? 'dashed' as const : 'solid' as const,
      orderedEventTitles: legend.orderedEventTitles
        .map((eventTitle) => eventTitleByKey.get(equivalenceKey(eventTitle)))
        .filter((eventTitle): eventTitle is string => Boolean(eventTitle)),
      touchPoints: touchPointsDetected,
      confidence: legend.confidence,
      reasoning: t('flow.legendReasoning')
    }))
    .filter((flow) => flow.orderedEventTitles.length > 0);

  if (legendFlows.length > 0) {
    return legendFlows;
  }

  const orderedEventTitles = events
    .filter((event) => event.bbox)
    .sort((left, right) => {
      const leftBox = left.bbox as NonNullable<typeof left.bbox>;
      const rightBox = right.bbox as NonNullable<typeof right.bbox>;
      if (Math.abs(leftBox.y - rightBox.y) > 80) return leftBox.y - rightBox.y;
      return leftBox.x - rightBox.x;
    })
    .map((event) => event.eventTitle);
  if (orderedEventTitles.length === 0) {
    return [];
  }

  const primaryArrow = arrowDetections?.arrows[0];
  return [{
    name: primaryArrow?.flowType === 'alternate' ? t('flow.detectedAlternateName') : t('flow.detectedMainName'),
    flowType: primaryArrow?.flowType ?? 'unknown',
    arrowStyle: primaryArrow?.arrowStyle ?? 'unknown',
    orderedEventTitles,
    touchPoints: touchPointsDetected,
    confidence: primaryArrow ? 0.5 : 0.38,
    reasoning: primaryArrow
      ? t('flow.spatialWithArrow')
      : t('flow.spatialNoArrow')
  }];
}

function buildObservePromptContext(
  ocrEventCandidates: OcrEventCandidates | null,
  ocrTextObservations: ImageObservation['textObservations'],
  ocrObservation: OcrObservation | null,
  supportingOcrObservation: OcrObservation | null,
  shapeGeometry: ShapeGeometry | null,
  arrowDetections: ArrowDetections | null,
  flowLegendDetections: FlowLegendDetections | null,
  spatialObservation: OcrPromptContext['spatialComposition'] | null
): OcrPromptContext {
  const trusted = ocrEventCandidates?.trusted ?? [];
  const uncertain = ocrEventCandidates?.uncertain ?? [];
  const trustedProtagonists = trusted.filter((candidate) => candidate.role === 'protagonist');
  const trustedSupporting = trusted.filter((candidate) => candidate.role === 'supporting');

  return {
    protagonistEventTitles: trustedProtagonists.map((candidate) => candidate.eventTitle),
    supportingEventTitles: trustedSupporting.map((candidate) => candidate.eventTitle),
    textObservations: ocrTextObservations,
    eventVisualSemantics: trusted.map((candidate) => ({
      eventTitle: candidate.eventTitle,
      role: candidate.role,
      colorHex: candidate.colorHex,
      confidence: candidate.confidence,
      reasoning: t('semantic.deterministicClassification', { color: candidate.role === 'protagonist' ? translatedColor('red') : translatedColor('blue') })
    })),
    touchPointCandidates: shapeGeometry?.touchPointCandidates ?? [],
    areaCandidates: shapeGeometry?.areaCandidates ?? [],
    arrowDetections: arrowDetections?.arrows ?? [],
    flowLegends: flowLegendDetections?.legends ?? [],
    spatialComposition: spatialObservation ?? undefined,
    uncertainItems: uncertain.map((candidate) => candidate.eventTitle),
    assumptions: [
      ...(ocrEventCandidates?.assumptions ?? []),
      ...(ocrObservation?.preprocessedImage ? [t('ocr.preprocessedRed', { path: ocrObservation.preprocessedImage })] : []),
      ...(supportingOcrObservation?.preprocessedImage ? [t('ocr.preprocessedBlue', { path: supportingOcrObservation.preprocessedImage })] : []),
      ...(shapeGeometry?.assumptions ?? []),
      ...(arrowDetections?.assumptions ?? []),
      ...(flowLegendDetections?.assumptions ?? []),
      ...(spatialObservation?.assumptions ?? [])
    ],
    genAiResponsibilities: [
      t('genai.reviewLowConfidence'),
      t('genai.complementMissing'),
      t('genai.resolveAmbiguities')
    ]
  };
}

function bboxContains(
  outer: { x: number; y: number; width: number; height: number },
  inner: { x: number; y: number; width: number; height: number }
): boolean {
  const innerCenter = bboxCenter(inner);
  return innerCenter.x >= outer.x
    && innerCenter.x <= outer.x + outer.width
    && innerCenter.y >= outer.y
    && innerCenter.y <= outer.y + outer.height;
}

function expandBbox(
  bbox: { x: number; y: number; width: number; height: number },
  padding: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.max(0, bbox.x - padding),
    y: Math.max(0, bbox.y - padding),
    width: bbox.width + padding * 2,
    height: bbox.height + padding * 2
  };
}

function bboxDistance(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number }
): number {
  const leftCenter = bboxCenter(left);
  const rightCenter = bboxCenter(right);
  return Math.hypot(leftCenter.x - rightCenter.x, leftCenter.y - rightCenter.y);
}

function bboxCenter(bbox: { x: number; y: number; width: number; height: number }): { x: number; y: number } {
  return {
    x: bbox.x + bbox.width / 2,
    y: bbox.y + bbox.height / 2
  };
}

function locationHintFromBbox(bbox: OcrEventCandidates['trusted'][number]['bbox']): string {
  if (!bbox) {
    return 'posição não informada pelo OCR';
  }

  return `bbox x=${bbox.x}, y=${bbox.y}, w=${bbox.width}, h=${bbox.height}`;
}

function buildDeterministicImageObservation(ocrPromptContext: OcrPromptContext | null): ImageObservation {
  const spatial = ocrPromptContext?.spatialComposition;

  return {
    areasDetected: spatial?.areasDetected ?? [],
    touchPointsDetected: spatial?.touchPointsDetected ?? [],
    textsOutsideShapes: uniqueStrings([
      ...(ocrPromptContext?.protagonistEventTitles ?? []),
      ...(ocrPromptContext?.supportingEventTitles ?? []),
      ...(spatial?.textsOutsideShapes ?? [])
    ]),
    textObservations: ocrPromptContext?.textObservations ?? [],
    eventVisualSemantics: ocrPromptContext?.eventVisualSemantics ?? [],
    touchPointEventCorrelations: spatial?.touchPointEventCorrelations ?? [],
    flowsDetected: spatial?.flowsDetected ?? [],
    actorsDetected: [],
    servicesDetected: [],
    uncertainItems: ocrPromptContext?.uncertainItems ?? [],
    assumptions: uniqueStrings([
      t('observation.deterministicAssumption'),
      ...(ocrPromptContext?.assumptions ?? []),
      ...(spatial?.assumptions ?? [])
    ])
  };
}

function sanitizeImageObservation(
  observation: ImageObservation,
  ocrPromptContext: OcrPromptContext | null = null
): ImageObservation {
  const rawTextsOutsideShapes = uniqueStrings([
    ...observation.textsOutsideShapes,
    ...(ocrPromptContext?.protagonistEventTitles ?? []),
    ...(ocrPromptContext?.supportingEventTitles ?? []),
    ...(ocrPromptContext?.spatialComposition?.textsOutsideShapes ?? [])
  ]);
  const areasDetected = uniqueStrings([
    ...observation.areasDetected,
    ...(ocrPromptContext?.spatialComposition?.areasDetected ?? [])
  ]);
  const areaKeys = new Set(areasDetected.map(equivalenceKey));
  const textsOutsideShapes = removeFragmentTexts(rawTextsOutsideShapes)
    .filter((text) => !areaKeys.has(equivalenceKey(text)));
  const rawTouchPointsDetected = uniqueStrings([
    ...observation.touchPointsDetected,
    ...(ocrPromptContext?.spatialComposition?.touchPointsDetected ?? [])
  ]);
  const touchPointsDetected = rawTouchPointsDetected
    .filter((touchPointTitle) => !hasEquivalent(touchPointTitle, areasDetected))
    .filter((touchPointTitle) => !isTechnicalEventLabel(touchPointTitle))
    .filter((touchPointTitle) => isReliableTouchPointLabel(touchPointTitle));
  const droppedTouchPoints = rawTouchPointsDetected
    .filter((touchPointTitle) => hasEquivalent(touchPointTitle, areasDetected));
  const uncertainItems = uniqueStrings(observation.uncertainItems);
  const roleByEvent = new Map(
    [
      ...(ocrPromptContext?.eventVisualSemantics ?? []),
      ...observation.eventVisualSemantics
    ].map((semantic) => [
      semantic.eventTitle.trim(),
      roleFromColor(semantic.colorHex, semantic.role)
    ])
  );
  const mergedFlowsForAssignment = [
    ...(ocrPromptContext?.spatialComposition?.flowsDetected ?? []),
    ...observation.flowsDetected
  ];
  const rawCorrelationsForAssignment = [
    ...(ocrPromptContext?.spatialComposition?.touchPointEventCorrelations ?? []),
    ...observation.touchPointEventCorrelations
  ];
  const touchPointByEvent = shouldPreferSpatialCorrelationAssignment(mergedFlowsForAssignment)
    ? mergeTouchPointAssignments(
      deriveTouchPointAssignmentFromCorrelations(rawCorrelationsForAssignment, touchPointsDetected, textsOutsideShapes),
      deriveTouchPointAssignment(mergedFlowsForAssignment, roleByEvent, touchPointsDetected)
    )
    : deriveTouchPointAssignment(mergedFlowsForAssignment, roleByEvent, touchPointsDetected);
  const touchPointReassignments = collectTouchPointReassignments(
    observation.touchPointEventCorrelations,
    touchPointByEvent
  );

  return {
    ...observation,
    areasDetected,
    touchPointsDetected,
    textsOutsideShapes,
    textObservations: mergeTextObservations(ocrPromptContext?.textObservations ?? [], observation.textObservations)
      .map((textObservation) => normalizeTextObservationKind(
        {
          ...textObservation,
          text: textObservation.text.trim(),
          locationHint: textObservation.locationHint?.trim(),
          ocrAlternatives: uniqueStrings(textObservation.ocrAlternatives),
          ambiguousCharacters: uniqueStrings(textObservation.ambiguousCharacters),
          reasoning: textObservation.reasoning.trim()
        },
        touchPointsDetected,
        areasDetected,
        textsOutsideShapes
      ))
      .filter((textObservation) => textObservation.text !== ''),
    eventVisualSemantics: mergeEventVisualSemantics(ocrPromptContext?.eventVisualSemantics ?? [], observation.eventVisualSemantics)
      .map((semantic) => ({
        ...semantic,
        eventTitle: semantic.eventTitle.trim(),
        role: roleFromColor(semantic.colorHex, semantic.role),
        reasoning: semantic.reasoning.trim()
      }))
      .filter((semantic) => semantic.eventTitle !== '' && hasEquivalent(semantic.eventTitle, textsOutsideShapes)),
    touchPointEventCorrelations: rebuildTouchPointEventCorrelations(
      [
        ...(ocrPromptContext?.spatialComposition?.touchPointEventCorrelations ?? []),
        ...observation.touchPointEventCorrelations
      ],
      touchPointByEvent,
      touchPointsDetected,
      textsOutsideShapes
    ),
    flowsDetected: uniqueFlows([
      ...(ocrPromptContext?.spatialComposition?.flowsDetected ?? []),
      ...observation.flowsDetected
    ]
      .map((flow) => ({
        ...flow,
        name: flow.name.trim(),
        orderedEventTitles: uniqueStrings(flow.orderedEventTitles)
          .filter((eventTitle) => hasEquivalent(eventTitle, textsOutsideShapes)),
        touchPoints: uniqueFlowTouchPoints(flow, touchPointByEvent, touchPointsDetected),
        reasoning: flow.reasoning.trim()
      }))
      .filter((flow) => flow.name !== '' && flow.orderedEventTitles.length > 0)),
    actorsDetected: uniqueStrings(observation.actorsDetected),
    servicesDetected: uniqueStrings(observation.servicesDetected),
    uncertainItems,
    assumptions: uniqueStrings([
      ...buildObservationAssumptions(uncertainItems, droppedTouchPoints, touchPointReassignments),
      ...(ocrPromptContext?.assumptions ?? []),
      ...(ocrPromptContext?.spatialComposition?.assumptions ?? []),
      ...observation.assumptions
    ])
  };
}

function uniqueFlowTouchPoints(
  flow: ImageObservation['flowsDetected'][number],
  touchPointByEvent: Map<string, string>,
  validTouchPoints: string[]
): string[] {
  const assigned = flow.orderedEventTitles
    .map((eventTitle) => touchPointByEvent.get(eventTitle.trim()))
    .filter((touchPointTitle): touchPointTitle is string => Boolean(touchPointTitle))
    .filter((touchPointTitle) => hasEquivalent(touchPointTitle, validTouchPoints));
  if (assigned.length > 0) {
    return uniqueStrings(assigned);
  }
  return uniqueStrings(flow.touchPoints)
    .filter((touchPointTitle) => hasEquivalent(touchPointTitle, validTouchPoints));
}

function uniqueFlows(flows: ImageObservation['flowsDetected']): ImageObservation['flowsDetected'] {
  const bySignature = new Map<string, ImageObservation['flowsDetected'][number]>();
  for (const flow of flows) {
    const signature = [
      equivalenceKey(flow.name),
      flow.flowType,
      flow.arrowStyle,
      flow.orderedEventTitles.map(equivalenceKey).join('|')
    ].join('::');
    const current = bySignature.get(signature);
    bySignature.set(signature, current && current.confidence >= flow.confidence ? current : flow);
  }
  return [...bySignature.values()];
}

function mergeTextObservations(
  deterministic: ImageObservation['textObservations'],
  observed: ImageObservation['textObservations']
): ImageObservation['textObservations'] {
  const byText = new Map<string, ImageObservation['textObservations'][number]>();
  for (const item of deterministic) {
    byText.set(item.text.trim(), item);
  }
  for (const item of observed) {
    const key = item.text.trim();
    const current = byText.get(key);
    byText.set(key, current && current.confidence >= item.confidence ? current : item);
  }
  return [...byText.values()];
}

function normalizeTextObservationKind(
  textObservation: ImageObservation['textObservations'][number],
  touchPointsDetected: string[],
  areasDetected: string[],
  textsOutsideShapes: string[]
): ImageObservation['textObservations'][number] {
  if (textObservation.kind === 'area' && hasEquivalent(textObservation.text, touchPointsDetected)) {
    return {
      ...textObservation,
      kind: 'structural',
      reasoning: `${textObservation.reasoning} Normalizado para structural porque a label também aparecia como touch point.`
    };
  }

  if (textObservation.kind === 'touch_point') {
    if (!hasEquivalent(textObservation.text, touchPointsDetected) || hasEquivalent(textObservation.text, areasDetected) || looksLikeContextEvidence(textObservation)) {
      return {
        ...textObservation,
        kind: 'structural',
        reasoning: `${textObservation.reasoning} Normalizado para structural porque a evidência indicava área/contexto ou a label foi removida de touchPointsDetected.`
      };
    }
  }

  if (textObservation.kind === 'event_candidate' && (!hasEquivalent(textObservation.text, textsOutsideShapes) || hasEquivalent(textObservation.text, areasDetected))) {
    return {
      ...textObservation,
      kind: 'uncertain',
      reasoning: `${textObservation.reasoning} Normalizado para uncertain porque não está em textsOutsideShapes ou colide com área/contexto.`
    };
  }

  return textObservation;
}

function hasEquivalent(value: string, candidates: string[]): boolean {
  const key = equivalenceKey(value);
  return candidates.some((candidate) => equivalenceKey(candidate) === key);
}

function removeFragmentTexts(texts: string[]): string[] {
  const uniqueTexts = uniqueStrings(texts);
  return uniqueTexts.filter((text, index) => {
    const textTokens = equivalenceTokens(text);
    if (textTokens.length === 0) {
      return false;
    }

    return !uniqueTexts.some((other, otherIndex) => {
      if (index === otherIndex) {
        return false;
      }
      const otherTokens = equivalenceTokens(other);
      if (otherTokens.length <= textTokens.length) {
        return false;
      }
      if (!tokensContainSequence(otherTokens, textTokens)) {
        return false;
      }
      return textTokens.length <= 2 || textTokens.length / otherTokens.length <= 0.75;
    });
  });
}

function equivalenceTokens(value: string): string[] {
  return equivalenceKey(value).split('_').filter(Boolean);
}

function equivalencePhraseKey(value: string): string {
  return equivalenceKey(value).replace(/_/g, ' ');
}

function tokensContainSequence(container: string[], sequence: string[]): boolean {
  if (sequence.length === 0 || sequence.length > container.length) {
    return false;
  }
  for (let start = 0; start <= container.length - sequence.length; start += 1) {
    if (sequence.every((token, index) => token === container[start + index])) {
      return true;
    }
  }
  return false;
}

function equivalenceKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ç/g, 'c')
    .replace(/nga/g, 'nca')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function looksLikeContextEvidence(textObservation: ImageObservation['textObservations'][number]): boolean {
  const evidence = [
    textObservation.locationHint || '',
    textObservation.reasoning || ''
  ].join(' ');

  return /\b(swimlane|raia|lane|área|area|dom[ií]nio|domain|sistema|system|agrupador|container|cont[eê]iner|contexto|estrutural|structural)\b/i
    .test(evidence);
}

function mergeEventVisualSemantics(
  deterministic: ImageObservation['eventVisualSemantics'],
  observed: ImageObservation['eventVisualSemantics']
): ImageObservation['eventVisualSemantics'] {
  const byTitle = new Map<string, ImageObservation['eventVisualSemantics'][number]>();
  for (const item of deterministic) {
    byTitle.set(item.eventTitle.trim(), item);
  }
  for (const item of observed) {
    const key = item.eventTitle.trim();
    const current = byTitle.get(key);
    byTitle.set(key, current && current.confidence >= item.confidence ? current : item);
  }
  return [...byTitle.values()];
}

function deriveTouchPointAssignment(
  flows: ImageObservation['flowsDetected'],
  roleByEvent: Map<string, ImageObservation['eventVisualSemantics'][number]['role']>,
  validTouchPoints: string[]
): Map<string, string> {
  const assignment = new Map<string, string>();
  const sortedFlows = [...flows].sort((left, right) => flowPriority(left) - flowPriority(right));

  for (const flow of sortedFlows) {
    const orderedTouchPoints = flow.touchPoints.filter((touchPointTitle) => validTouchPoints.includes(touchPointTitle));
    if (orderedTouchPoints.length === 0) {
      continue;
    }
    const touchPointsWithProtagonist = new Set<string>();
    for (const [event, owner] of assignment.entries()) {
      if (orderedTouchPoints.includes(owner) && roleByEvent.get(event) === 'protagonist') {
        touchPointsWithProtagonist.add(owner);
      }
    }

    let touchPointCursor = nextAvailableTouchPoint(orderedTouchPoints, touchPointsWithProtagonist, 0);
    let lastObservedTouchPoint: string | undefined;
    const pendingEvents: string[] = [];
    const hasExplicitProtagonists = flow.orderedEventTitles.some((eventTitle) => roleByEvent.get(eventTitle) === 'protagonist');

    for (const eventTitle of flow.orderedEventTitles) {
      const existingOwner = assignment.get(eventTitle);
      const role = roleByEvent.get(eventTitle);

      if (existingOwner) {
        lastObservedTouchPoint = existingOwner;
        const ownerIndex = orderedTouchPoints.indexOf(existingOwner);
        if (ownerIndex >= 0) {
          touchPointCursor = nextAvailableTouchPoint(orderedTouchPoints, touchPointsWithProtagonist, ownerIndex + 1);
        }
        continue;
      }

      if (role === 'protagonist' || !hasExplicitProtagonists) {
        const owner = touchPointCursor !== -1
          ? orderedTouchPoints[touchPointCursor]
          : lastObservedTouchPoint || orderedTouchPoints[orderedTouchPoints.length - 1];

        assignment.set(eventTitle, owner);
        if (role === 'protagonist') {
          touchPointsWithProtagonist.add(owner);
        }

        const pendingOwner = lastObservedTouchPoint || owner;
        for (const pendingEvent of pendingEvents) {
          if (!assignment.has(pendingEvent)) {
            assignment.set(pendingEvent, pendingOwner);
          }
        }
        pendingEvents.length = 0;
        lastObservedTouchPoint = owner;
        touchPointCursor = role === 'protagonist'
          ? nextAvailableTouchPoint(orderedTouchPoints, touchPointsWithProtagonist, touchPointCursor === -1 ? 0 : touchPointCursor + 1)
          : Math.min(orderedTouchPoints.length - 1, (touchPointCursor === -1 ? 0 : touchPointCursor) + 1);
        continue;
      }

      pendingEvents.push(eventTitle);
    }

    if (pendingEvents.length > 0) {
      const fallbackOwner = lastObservedTouchPoint
        || (touchPointCursor !== -1 ? orderedTouchPoints[touchPointCursor] : orderedTouchPoints[orderedTouchPoints.length - 1]);
      for (const pendingEvent of pendingEvents) {
        if (!assignment.has(pendingEvent)) {
          assignment.set(pendingEvent, fallbackOwner);
        }
      }
    }
  }

  return assignment;
}

function shouldPreferSpatialCorrelationAssignment(flows: ImageObservation['flowsDetected']): boolean {
  return flows.length > 0
    && flows.every((flow) => /posição espacial|posicao espacial/i.test(flow.reasoning));
}

function deriveTouchPointAssignmentFromCorrelations(
  correlations: ImageObservation['touchPointEventCorrelations'],
  validTouchPoints: string[],
  observedEvents: string[]
): Map<string, string> {
  const assignment = new Map<string, string>();
  const observedEventKeys = new Set(observedEvents.map(equivalenceKey));
  for (const correlation of correlations) {
    if (!hasEquivalent(correlation.touchPointTitle, validTouchPoints)) continue;
    for (const eventTitle of correlation.eventsObservedAroundTouchPoint) {
      if (!observedEventKeys.has(equivalenceKey(eventTitle))) continue;
      assignment.set(eventTitle.trim(), correlation.touchPointTitle.trim());
    }
  }
  return assignment;
}

function mergeTouchPointAssignments(primary: Map<string, string>, fallback: Map<string, string>): Map<string, string> {
  const merged = new Map(fallback);
  for (const [eventTitle, touchPointTitle] of primary.entries()) {
    merged.set(eventTitle, touchPointTitle);
  }
  return merged;
}

function nextAvailableTouchPoint(
  orderedTouchPoints: string[],
  alreadyTaken: Set<string>,
  startIndex: number
): number {
  for (let index = Math.max(0, startIndex); index < orderedTouchPoints.length; index += 1) {
    if (!alreadyTaken.has(orderedTouchPoints[index])) {
      return index;
    }
  }
  return -1;
}

function flowPriority(flow: ImageObservation['flowsDetected'][number]): number {
  if (flow.flowType === 'main') {
    return 0;
  }
  if (flow.flowType === 'unknown') {
    return 1;
  }
  return 2;
}

function collectTouchPointReassignments(
  correlations: ImageObservation['touchPointEventCorrelations'],
  touchPointByEvent: Map<string, string>
): Array<{ eventTitle: string; from: string; to: string }> {
  const reassignments: Array<{ eventTitle: string; from: string; to: string }> = [];
  for (const correlation of correlations) {
    for (const eventTitle of correlation.eventsObservedAroundTouchPoint) {
      const expected = touchPointByEvent.get(eventTitle.trim());
      if (expected && expected !== correlation.touchPointTitle.trim()) {
        reassignments.push({
          eventTitle: eventTitle.trim(),
          from: correlation.touchPointTitle.trim(),
          to: expected
        });
      }
    }
  }
  return reassignments;
}

function rebuildTouchPointEventCorrelations(
  correlations: ImageObservation['touchPointEventCorrelations'],
  touchPointByEvent: Map<string, string>,
  validTouchPoints: string[],
  observedEvents: string[]
): ImageObservation['touchPointEventCorrelations'] {
  const correlationByTouchPoint = new Map<string, ImageObservation['touchPointEventCorrelations'][number]>();

  for (const correlation of correlations) {
    const trimmedTitle = correlation.touchPointTitle.trim();
    if (!validTouchPoints.includes(trimmedTitle)) {
      continue;
    }
    correlationByTouchPoint.set(trimmedTitle, {
      ...correlation,
      touchPointTitle: trimmedTitle,
      eventsObservedAroundTouchPoint: []
    });
  }

  for (const touchPointTitle of validTouchPoints) {
    if (!correlationByTouchPoint.has(touchPointTitle)) {
      correlationByTouchPoint.set(touchPointTitle, {
        touchPointTitle,
        eventsObservedAroundTouchPoint: [],
        confidence: 0.7,
        reasoning: t('correlation.rebuilt')
      });
    }
  }

  for (const [eventTitle, touchPointTitle] of touchPointByEvent.entries()) {
    if (!hasEquivalent(eventTitle, observedEvents)) {
      continue;
    }
    const correlation = correlationByTouchPoint.get(touchPointTitle);
    if (!correlation) {
      continue;
    }
    if (!correlation.eventsObservedAroundTouchPoint.includes(eventTitle)) {
      correlation.eventsObservedAroundTouchPoint.push(eventTitle);
    }
  }

  return [...correlationByTouchPoint.values()].filter((correlation) => correlation.eventsObservedAroundTouchPoint.length > 0);
}

function roleFromColor(
  colorHex: ImageObservation['eventVisualSemantics'][number]['colorHex'],
  fallbackRole: ImageObservation['eventVisualSemantics'][number]['role']
): ImageObservation['eventVisualSemantics'][number]['role'] {
  if (colorHex === '#FF0000') {
    return 'protagonist';
  }
  if (colorHex === '#305CDE') {
    return 'supporting';
  }
  return fallbackRole;
}

function buildOcrReviewImageContent(ocrObservation: OcrObservation | null) {
  if (!ocrObservation) {
    return [];
  }

  return ocrObservation.texts
    .filter((text) => text.needsOcrReview && text.cropImage)
    .flatMap((text, index) => [
      {
        type: 'text' as const,
        text: t('ocr.reviewCrop', { index: index + 1 })
      },
      imageContentFromFile(text.cropImage as string)
    ]);
}

function shouldUseDeterministicCandidateContext(
  candidateContext: CandidateContext,
  observation: ImageObservation
): boolean {
  const observedEvents = new Set(observation.textsOutsideShapes);
  const hasUnobservedCandidateEvent = candidateContext.candidateEvents
    .some((event) => !observedEvents.has(event.event_title));
  const hasUnobservedFlowEvent = candidateContext.candidateFlows
    .some((flow) => flow.orderedEventTitles.some((eventTitle) => !observedEvents.has(eventTitle)));

  if (hasUnobservedCandidateEvent || hasUnobservedFlowEvent) {
    logger.warn('Extração LLM gerou eventos fora de textsOutsideShapes; usando candidatos determinísticos da observação', {
      hasUnobservedCandidateEvent,
      hasUnobservedFlowEvent
    });
    return true;
  }

  return false;
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function translatedColor(color: 'red' | 'blue'): string {
  if (getLocale() === 'en') {
    return color;
  }
  return color === 'red' ? 'vermelha' : 'azul';
}

function buildObservationAssumptions(
  uncertainItems: string[],
  droppedTouchPoints: string[] = [],
  touchPointReassignments: Array<{ eventTitle: string; from: string; to: string }> = []
): string[] {
  const assumptions: string[] = [];

  if (uncertainItems.length > 0) {
    assumptions.push(
      t('observation.uncertainItems', { items: uncertainItems.map((item) => `'${item}'`).join(', ') })
    );
  }

  if (droppedTouchPoints.length > 0) {
    assumptions.push(
      t('observation.droppedTouchPoints', { items: droppedTouchPoints.map((item) => `'${item}'`).join(', ') })
    );
  }

  if (touchPointReassignments.length > 0) {
    logger.info(t('log.workflow.reassignments'), {
      reassignments: touchPointReassignments
    });
  }

  return assumptions;
}

function buildWorkbookNotes(inputImage: string, assumptions: string[]) {
  const notes = [
    {
      item: 'input_file',
      detail: path.basename(inputImage)
    },
    {
      item: 'mapping_stage',
      detail: t('workbook.mappingStage')
    },
    {
      item: 'mapping_actor',
      detail: t('workbook.mappingActor')
    },
    {
      item: 'mapping_service',
      detail: t('workbook.mappingService')
    },
    {
      item: 'mapping_tags',
      detail: t('workbook.mappingTags')
    }
  ];

  return [
    ...notes,
    ...assumptions.map((assumption, index) => ({
      item: `note_${index + 1}`,
      detail: assumption
    }))
  ];
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
