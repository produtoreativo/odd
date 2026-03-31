import { END, START, StateGraph } from '@langchain/langgraph';
import { ObservabilityWorkflowGraphState } from './state.js';
import {
  applyDatadogNode,
  buildPlanNode,
  categorizeEventsNode,
  compileTerraformNode,
  loadInputNode,
  suggestSlosNode
} from './nodes.js';
import {
  routeAfterCategorize,
  routeAfterInput,
  routeAfterPlan,
  routeAfterTerraform,
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
    .addNode('apply_datadog', applyDatadogNode)
    .addConditionalEdges(START, routeFromStart)
    .addConditionalEdges('load_input', routeAfterInput)
    .addConditionalEdges('categorize_events', routeAfterCategorize)
    .addConditionalEdges('suggest_slos', routeAfterSlos)
    .addConditionalEdges('build_plan', routeAfterPlan)
    .addConditionalEdges('compile_terraform', routeAfterTerraform)
    .addEdge('apply_datadog', END)
    .compile();
}
