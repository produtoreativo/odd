import { END, START, StateGraph } from '@langchain/langgraph';
import { ObservabilityWorkflowGraphState } from './state.js';
import {
  applyProviderNode,
  buildPlanNode,
  categorizeEventsNode,
  compileTerraformNode,
  compileSloTerraformNode,
  loadInputNode,
  suggestSlosNode
} from './nodes.js';
import {
  routeAfterCategorize,
  routeAfterDashboardTerraform,
  routeAfterInput,
  routeAfterPlan,
  routeAfterSloTerraform,
  routeAfterSlos,
  routeFromStart
} from './routes.js';

export function buildObservabilityWorkflow() {
  return new StateGraph(ObservabilityWorkflowGraphState)
    .addNode('load_input', loadInputNode)
    .addNode('categorize_events', categorizeEventsNode)
    .addNode('suggest_slos', suggestSlosNode)
    .addNode('build_plan', buildPlanNode)
    .addNode('compile_terraform', compileTerraformNode)
    .addNode('compile_slo_terraform', compileSloTerraformNode)
    .addNode('apply_provider', applyProviderNode)
    .addConditionalEdges(START, routeFromStart)
    .addConditionalEdges('load_input', routeAfterInput)
    .addConditionalEdges('categorize_events', routeAfterCategorize)
    .addConditionalEdges('suggest_slos', routeAfterSlos)
    .addConditionalEdges('build_plan', routeAfterPlan)
    .addConditionalEdges('compile_terraform', routeAfterDashboardTerraform)
    .addConditionalEdges('compile_slo_terraform', routeAfterSloTerraform)
    .addEdge('apply_provider', END)
    .compile();
}
