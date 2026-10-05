import { END, START, StateGraph } from '@langchain/langgraph';
import { GraphState } from './state.js';
import {
  createWorkbookNode,
  extractEventsNode,
  failNode,
  observeImageNode,
  normalizeContextNode,
  validateCandidateEventsNode,
  validateImageObservationNode,
  validateNormalizationNode,
  validateWorkbookNode
} from './nodes.js';
import {
  routeFromStart,
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
    .addEdge('observe_image', 'validate_image_observation')
    .addConditionalEdges('validate_image_observation', routeAfterObservation)
    .addEdge('extract_events', 'validate_candidate_events')
    .addConditionalEdges('validate_candidate_events', routeAfterExtraction)
    .addEdge('normalize_context', 'validate_normalization')
    .addConditionalEdges('validate_normalization', routeAfterNormalization)
    .addEdge('create_workbook', 'validate_workbook')
    .addConditionalEdges('validate_workbook', routeAfterWorkbook)
    .addEdge('fail', END)
    .compile();
}
