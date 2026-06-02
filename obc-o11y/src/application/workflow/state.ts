import { Annotation } from '@langchain/langgraph';
import { ApplyReport, CategorizedEvents, DashboardPlan, EventBurstConfig, EventStormingRow, FlowOccurrence, RecognizedFlow, SloSuggestion } from '../../shared/types.js';
import { ObservabilityProvider } from '../../shared/provider.js';
import { OpenSloDocument } from '../../infrastructure/observability/openslo/index.js';

export type WorkflowStep =
  | 'input'
  | 'categorize'
  | 'slos'
  | 'openslo'
  | 'plan'
  | 'terraform'
  | 'apply';

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
  startFrom: Annotation<WorkflowStep>(),
  endAt: Annotation<WorkflowStep>(),
  rows: Annotation<EventStormingRow[]>({ default: () => [], reducer: (_, right) => right }),
  recognizedFlows: Annotation<RecognizedFlow[]>({ default: () => [], reducer: (_, right) => right }),
  flowOccurrences: Annotation<FlowOccurrence[]>({ default: () => [], reducer: (_, right) => right }),
  categorized: Annotation<CategorizedEvents | null>({ default: () => null, reducer: (_, right) => right }),
  sloSuggestions: Annotation<SloSuggestion[]>({ default: () => [], reducer: (_, right) => right }),
  openSloDataSources: Annotation<OpenSloDocument[]>({ default: () => [], reducer: (_, right) => right }),
  openSloService: Annotation<OpenSloDocument | null>({ default: () => null, reducer: (_, right) => right }),
  openSloSlis: Annotation<OpenSloDocument[]>({ default: () => [], reducer: (_, right) => right }),
  openSloSlos: Annotation<OpenSloDocument[]>({ default: () => [], reducer: (_, right) => right }),
  openSloAlertConditions: Annotation<OpenSloDocument[]>({ default: () => [], reducer: (_, right) => right }),
  openSloAlertNotificationTargets: Annotation<OpenSloDocument[]>({ default: () => [], reducer: (_, right) => right }),
  openSloAlertPolicies: Annotation<OpenSloDocument[]>({ default: () => [], reducer: (_, right) => right }),
  plan: Annotation<DashboardPlan | null>({ default: () => null, reducer: (_, right) => right }),
  dashboardTerraformJson: Annotation<Record<string, unknown> | null>({ default: () => null, reducer: (_, right) => right }),
  sloTerraformJson: Annotation<Record<string, unknown> | null>({ default: () => null, reducer: (_, right) => right }),
  terraformJson: Annotation<Record<string, unknown> | null>({ default: () => null, reducer: (_, right) => right }),
  applyReport: Annotation<ApplyReport | null>({ default: () => null, reducer: (_, right) => right })
});

export type ObservabilityWorkflowState = typeof ObservabilityWorkflowGraphState.State;
