import { END, START, StateGraph } from '@langchain/langgraph';
import { ObservabilityWorkflowGraphState } from './state.js';
import {
  applyProviderNode,
  buildPlanNode,
  categorizeEventsNode,
  compileTerraformNode,
  compileSloTerraformNode,
  composeOpenSloAlertConditionsNode,
  composeOpenSloAlertNotificationTargetsNode,
  composeOpenSloAlertPoliciesNode,
  composeOpenSloDataSourcesNode,
  composeOpenSloServiceNode,
  composeOpenSloSlisNode,
  composeOpenSloSlosNode,
  loadInputNode,
  suggestSlosNode
} from './nodes.js';
import {
  routeAfterCategorize,
  routeAfterDashboardTerraform,
  routeAfterInput,
  routeAfterOpenSloAlertPolicies,
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
    .addNode('compose_openslo_datasources', composeOpenSloDataSourcesNode)
    .addNode('compose_openslo_service', composeOpenSloServiceNode)
    .addNode('compose_openslo_slis', composeOpenSloSlisNode)
    .addNode('compose_openslo_slos', composeOpenSloSlosNode)
    .addNode('compose_openslo_alert_conditions', composeOpenSloAlertConditionsNode)
    .addNode('compose_openslo_alert_notification_targets', composeOpenSloAlertNotificationTargetsNode)
    .addNode('compose_openslo_alert_policies', composeOpenSloAlertPoliciesNode)
    .addNode('build_plan', buildPlanNode)
    .addNode('compile_terraform', compileTerraformNode)
    .addNode('compile_slo_terraform', compileSloTerraformNode)
    .addNode('apply_provider', applyProviderNode)
    .addConditionalEdges(START, routeFromStart)
    .addConditionalEdges('load_input', routeAfterInput)
    .addConditionalEdges('categorize_events', routeAfterCategorize)
    .addConditionalEdges('suggest_slos', routeAfterSlos)
    .addEdge('compose_openslo_datasources', 'compose_openslo_service')
    .addEdge('compose_openslo_service', 'compose_openslo_slis')
    .addEdge('compose_openslo_slis', 'compose_openslo_slos')
    .addEdge('compose_openslo_slos', 'compose_openslo_alert_conditions')
    .addEdge('compose_openslo_alert_conditions', 'compose_openslo_alert_notification_targets')
    .addEdge('compose_openslo_alert_notification_targets', 'compose_openslo_alert_policies')
    .addConditionalEdges('compose_openslo_alert_policies', routeAfterOpenSloAlertPolicies)
    .addConditionalEdges('build_plan', routeAfterPlan)
    .addConditionalEdges('compile_terraform', routeAfterDashboardTerraform)
    .addConditionalEdges('compile_slo_terraform', routeAfterSloTerraform)
    .addEdge('apply_provider', END)
    .compile();
}
