import { Annotation } from '@langchain/langgraph';
import { CategorizedEvents, DashboardPlan, DatadogApplyReport, EventStormingRow, SloSuggestion } from '../../shared/types.js';
import { ObservabilityProvider } from '../../shared/provider.js';

export const ObservabilityWorkflowGraphState = Annotation.Root({
  input: Annotation<string>(),
  dashboardTitle: Annotation<string>(),
  outputDir: Annotation<string>(),
  provider: Annotation<ObservabilityProvider>(),
  dryRun: Annotation<boolean>(),
  startFrom: Annotation<'input' | 'categorize' | 'slos' | 'plan' | 'terraform' | 'apply'>(),
  endAt: Annotation<'input' | 'categorize' | 'slos' | 'plan' | 'terraform' | 'apply'>(),
  rows: Annotation<EventStormingRow[]>({ default: () => [], reducer: (_, right) => right }),
  categorized: Annotation<CategorizedEvents | null>({ default: () => null, reducer: (_, right) => right }),
  sloSuggestions: Annotation<SloSuggestion[]>({ default: () => [], reducer: (_, right) => right }),
  plan: Annotation<DashboardPlan | null>({ default: () => null, reducer: (_, right) => right }),
  terraformJson: Annotation<Record<string, unknown> | null>({ default: () => null, reducer: (_, right) => right }),
  applyReport: Annotation<DatadogApplyReport | null>({ default: () => null, reducer: (_, right) => right })
});

export type ObservabilityWorkflowState = typeof ObservabilityWorkflowGraphState.State;
