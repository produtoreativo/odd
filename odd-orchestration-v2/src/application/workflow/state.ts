import { Annotation } from '@langchain/langgraph';
import { CategorizedEvents, DashboardPlan, DatadogApplyReport, EventBurstConfig, EventStormingRow, SloSuggestion } from '../../shared/types.js';
import { ObservabilityProvider } from '../../shared/provider.js';

export const ObservabilityWorkflowGraphState = Annotation.Root({
  dashboardKey: Annotation<string>(),
  input: Annotation<string>(),
  env: Annotation<string>(),
  dashboardTitle: Annotation<string>(),
  outputDir: Annotation<string>(),
  terraformWorkspaceDir: Annotation<string>(),
  provider: Annotation<ObservabilityProvider>(),
  dryRun: Annotation<boolean>(),
  eventBurstConfig: Annotation<Partial<EventBurstConfig>>({ default: () => ({}), reducer: (_, right) => right }),
  startFrom: Annotation<'input' | 'categorize' | 'slos' | 'plan' | 'terraform' | 'apply'>(),
  endAt: Annotation<'input' | 'categorize' | 'slos' | 'plan' | 'terraform' | 'apply'>(),
  rows: Annotation<EventStormingRow[]>({ default: () => [], reducer: (_, right) => right }),
  categorized: Annotation<CategorizedEvents | null>({ default: () => null, reducer: (_, right) => right }),
  sloSuggestions: Annotation<SloSuggestion[]>({ default: () => [], reducer: (_, right) => right }),
  plan: Annotation<DashboardPlan | null>({ default: () => null, reducer: (_, right) => right }),
  dashboardTerraformJson: Annotation<Record<string, unknown> | null>({ default: () => null, reducer: (_, right) => right }),
  sloTerraformJson: Annotation<Record<string, unknown> | null>({ default: () => null, reducer: (_, right) => right }),
  terraformJson: Annotation<Record<string, unknown> | null>({ default: () => null, reducer: (_, right) => right }),
  applyReport: Annotation<DatadogApplyReport | null>({ default: () => null, reducer: (_, right) => right })
});

export type ObservabilityWorkflowState = typeof ObservabilityWorkflowGraphState.State;
