import { END, START, StateGraph } from '@langchain/langgraph';
import { GraphState } from './state.js';
import {
  createWorkbookNode,
  extractEventsNode,
  failNode,
  classifyOcrEventCandidatesNode,
  composeDeterministicImageObservationNode,
  composeSpatialObservationNode,
  composeObservePromptContextNode,
  composeOcrTextObservationsNode,
  detectArrowGeometryNode,
  detectShapeGeometryNode,
  extractFlowLegendsNode,
  observeImageNode,
  normalizeContextNode,
  prepareImageOcrNode,
  prepareSupportingOcrNode,
  validateCandidateEventsNode,
  validateImageObservationNode,
  validateNormalizationNode,
  validateWorkbookNode
} from './nodes.js';
import {
  routeFromStart,
  routeAfterStep,
  routeAfterObservation,
  routeAfterExtraction,
  routeAfterNormalization,
  routeAfterWorkbook
} from './routes.js';
import { Logger } from '../../shared/logger.js';

const logger = new Logger('workflow-builder');

export function buildEventStormingWorkflow() {
  logger.info('Construindo grafo LangGraph do workflow de event storming');

  return new StateGraph(GraphState)
    .addNode('prepare_image_ocr', prepareImageOcrNode)
    .addNode('prepare_supporting_ocr', prepareSupportingOcrNode)
    .addNode('classify_ocr_event_candidates', classifyOcrEventCandidatesNode)
    .addNode('detect_shape_geometry', detectShapeGeometryNode)
    .addNode('detect_arrow_geometry', detectArrowGeometryNode)
    .addNode('extract_flow_legends', extractFlowLegendsNode)
    .addNode('compose_spatial_observation', composeSpatialObservationNode)
    .addNode('compose_ocr_text_observations', composeOcrTextObservationsNode)
    .addNode('compose_observe_prompt_context', composeObservePromptContextNode)
    .addNode('compose_deterministic_image_observation', composeDeterministicImageObservationNode)
    .addNode('observe_image', observeImageNode)
    .addNode('validate_image_observation', validateImageObservationNode)
    .addNode('extract_events', extractEventsNode)
    .addNode('validate_candidate_events', validateCandidateEventsNode)
    .addNode('normalize_context', normalizeContextNode)
    .addNode('validate_normalization', validateNormalizationNode)
    .addNode('create_workbook', createWorkbookNode)
    .addNode('validate_workbook', validateWorkbookNode)
    .addNode('fail', failNode)
    .addConditionalEdges(START, routeFromStart)
    .addConditionalEdges('prepare_image_ocr', routeAfterStep('prepare_image_ocr', 'prepare_supporting_ocr'))
    .addConditionalEdges('prepare_supporting_ocr', routeAfterStep('prepare_supporting_ocr', 'classify_ocr_event_candidates'))
    .addConditionalEdges('classify_ocr_event_candidates', routeAfterStep('classify_ocr_event_candidates', 'detect_shape_geometry'))
    .addConditionalEdges('detect_shape_geometry', routeAfterStep('detect_shape_geometry', 'detect_arrow_geometry'))
    .addConditionalEdges('detect_arrow_geometry', routeAfterStep('detect_arrow_geometry', 'extract_flow_legends'))
    .addConditionalEdges('extract_flow_legends', routeAfterStep('extract_flow_legends', 'compose_spatial_observation'))
    .addConditionalEdges('compose_spatial_observation', routeAfterStep('compose_spatial_observation', 'compose_ocr_text_observations'))
    .addConditionalEdges('compose_ocr_text_observations', routeAfterStep('compose_ocr_text_observations', 'compose_observe_prompt_context'))
    .addConditionalEdges('compose_observe_prompt_context', routeAfterStep('compose_observe_prompt_context', 'compose_deterministic_image_observation'))
    .addConditionalEdges('compose_deterministic_image_observation', routeAfterStep('compose_deterministic_image_observation', 'validate_image_observation'))
    .addConditionalEdges('observe_image', routeAfterStep('observe_image', 'validate_image_observation'))
    .addConditionalEdges('validate_image_observation', routeAfterObservation)
    .addConditionalEdges('extract_events', routeAfterStep('extract_events', 'validate_candidate_events'))
    .addConditionalEdges('validate_candidate_events', routeAfterExtraction)
    .addConditionalEdges('normalize_context', routeAfterStep('normalize_context', 'validate_normalization'))
    .addConditionalEdges('validate_normalization', routeAfterNormalization)
    .addConditionalEdges('create_workbook', routeAfterStep('create_workbook', 'validate_workbook'))
    .addConditionalEdges('validate_workbook', routeAfterWorkbook)
    .addEdge('fail', END)
    .compile();
}
