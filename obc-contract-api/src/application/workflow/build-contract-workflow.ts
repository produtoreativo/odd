import { END, START, StateGraph } from '@langchain/langgraph';
import { GraphState } from './state.js';
import {
  failNode,
  identifyContractRequirementsNode,
  loadObservationNode,
  validateContractRequirementsNode
} from './nodes.js';
import { routeAfterIdentification, routeAfterLoad } from './routes.js';
import { Logger } from '../../shared/logger.js';

const logger = new Logger('workflow-builder');

export function buildContractWorkflow() {
  logger.info('Construindo grafo LangGraph do workflow obc-contract-api');

  return new StateGraph(GraphState)
    .addNode('load_observation', loadObservationNode)
    .addNode('identify_contract_requirements', identifyContractRequirementsNode)
    .addNode('validate_contract_requirements', validateContractRequirementsNode)
    .addNode('fail', failNode)
    .addEdge(START, 'load_observation')
    .addConditionalEdges('load_observation', routeAfterLoad)
    .addEdge('identify_contract_requirements', 'validate_contract_requirements')
    .addConditionalEdges('validate_contract_requirements', routeAfterIdentification)
    .addEdge('fail', END)
    .compile();
}
