import { END } from '@langchain/langgraph';
import { ObservabilityWorkflowState } from './state.js';

export function routeFromStart(state: ObservabilityWorkflowState) {
  switch (state.startFrom) {
    case 'categorize':
      return 'categorize_events';
    case 'slos':
      return 'suggest_slos';
    case 'plan':
      return 'build_plan';
    case 'terraform':
      return 'compile_terraform';
    case 'apply':
      return 'apply_datadog';
    default:
      return 'load_input';
  }
}

export function routeAfterInput(state: ObservabilityWorkflowState) {
  return state.endAt === 'input' ? END : 'categorize_events';
}

export function routeAfterCategorize(state: ObservabilityWorkflowState) {
  return state.endAt === 'categorize' ? END : 'suggest_slos';
}

export function routeAfterSlos(state: ObservabilityWorkflowState) {
  return state.endAt === 'slos' ? END : 'build_plan';
}

export function routeAfterPlan(state: ObservabilityWorkflowState) {
  return state.endAt === 'plan' ? END : 'compile_terraform';
}

export function routeAfterTerraform(state: ObservabilityWorkflowState) {
  return state.endAt === 'terraform' ? END : 'apply_datadog';
}
