import { END } from '@langchain/langgraph';
import {
  validateCandidateContext,
  validateImageObservation,
  validateRecognizedContext,
  validateWorkbook
} from '../../domain/context-validator.js';
import { WorkflowGraphState } from './state.js';
import { Logger } from '../../shared/logger.js';

const logger = new Logger('workflow-routes');

export function routeFromStart(state: WorkflowGraphState) {
  logger.info('Avaliando nó inicial do workflow', {
    startFrom: state.startFrom
  });

  if (state.startFrom === 'extract') {
    return 'extract_events';
  }
  if (state.startFrom === 'normalize') {
    return 'normalize_context';
  }
  return 'observe_image';
}

export function routeAfterObservation(state: WorkflowGraphState) {
  const hasValidObservation = validateImageObservation(state.imageObservation).length === 0;
  logger.info('Avaliando transição após observação da imagem', {
    observeAttempts: state.observeAttempts,
    maxAttempts: state.maxAttempts,
    endAt: state.endAt,
    hasValidObservation
  });

  if (hasValidObservation) {
    if (state.endAt === 'observe') {
      return END;
    }
    return 'extract_events';
  }
  if (state.observeAttempts < state.maxAttempts) {
    return 'observe_image';
  }
  return 'fail';
}

export function routeAfterExtraction(state: WorkflowGraphState) {
  const hasValidContext = validateCandidateContext(state.candidateContext).length === 0;
  logger.info('Avaliando transição após extração', {
    extractAttempts: state.extractAttempts,
    maxAttempts: state.maxAttempts,
    hasValidContext
  });

  if (hasValidContext) {
    return 'normalize_context';
  }
  if (state.extractAttempts < state.maxAttempts) {
    return 'extract_events';
  }
  return 'fail';
}

export function routeAfterNormalization(state: WorkflowGraphState) {
  const hasValidContext = validateRecognizedContext(state.standardizedContext, 'normalize').length === 0;
  logger.info('Avaliando transição após normalização', {
    normalizeAttempts: state.normalizeAttempts,
    maxAttempts: state.maxAttempts,
    hasValidContext
  });

  if (hasValidContext) {
    return 'create_workbook';
  }
  if (state.normalizeAttempts < state.maxAttempts) {
    return 'normalize_context';
  }
  return 'fail';
}

export function routeAfterWorkbook(state: WorkflowGraphState) {
  const hasValidWorkbook = validateWorkbook(state.workbook).length === 0;
  logger.info('Avaliando transição após geração do workbook', {
    workbookAttempts: state.workbookAttempts,
    maxAttempts: state.maxAttempts,
    hasValidWorkbook
  });

  if (hasValidWorkbook) {
    return END;
  }
  if (state.workbookAttempts < state.maxAttempts) {
    return 'create_workbook';
  }
  return 'fail';
}
