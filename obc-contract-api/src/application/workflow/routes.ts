import { END } from '@langchain/langgraph';
import { validateContractRequirements } from '../../domain/contract-validator.js';
import { WorkflowGraphState } from './state.js';
import { Logger } from '../../shared/logger.js';

const logger = new Logger('workflow-routes');

export function routeAfterLoad(state: WorkflowGraphState) {
  const hasObservation = Boolean(state.observation);
  logger.info('Avaliando transição após carregar a observação', { hasObservation });

  if (hasObservation) {
    return 'identify_contract_requirements';
  }
  return 'fail';
}

export function routeAfterIdentification(state: WorkflowGraphState) {
  const hasValidContracts =
    validateContractRequirements(state.contractRequirements, state.observation).length === 0;
  logger.info('Avaliando transição após identificação dos requisitos de contrato', {
    identifyAttempts: state.identifyAttempts,
    maxAttempts: state.maxAttempts,
    hasValidContracts
  });

  if (hasValidContracts) {
    return END;
  }
  if (state.identifyAttempts < state.maxAttempts) {
    return 'identify_contract_requirements';
  }
  return 'fail';
}
