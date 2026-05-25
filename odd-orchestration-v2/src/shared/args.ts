export type WorkflowStepArg = 'input' | 'categorize' | 'slos' | 'openslo' | 'plan' | 'terraform' | 'apply';

export type WorkflowCliArgs = {
  input?: string;
  output: string;
  env: string;
  dashboardTitle?: string;
  dashboardKey?: string;
  provider: string;
  startFrom: WorkflowStepArg;
  endAt: WorkflowStepArg;
  dryRun: boolean;
  rowsFile?: string;
  categorizedFile?: string;
  sloFile?: string;
  planFile?: string;
  burstCount?: number;
  burstIntervalMs?: number;
  copiesPerEvent?: number;
  randomizeEventCounts: boolean;
};

export function parseWorkflowCliArgs(args: Record<string, string | boolean>, defaultEndAt: WorkflowCliArgs['endAt']): WorkflowCliArgs {
  return {
    input: optionalStringArg(args, 'input'),
    output: optionalStringArg(args, 'output') ?? './generated',
    env: optionalStringArg(args, 'env') ?? 'dev',
    dashboardTitle: optionalStringArg(args, 'dashboard-title'),
    dashboardKey: optionalStringArg(args, 'dashboard-key'),
    provider: requireStringArg(args, 'provider'),
    startFrom: parseStepArg(args['start-from'], 'input'),
    endAt: parseStepArg(args['end-at'], defaultEndAt),
    dryRun: args['dry-run'] === true,
    rowsFile: optionalStringArg(args, 'rows-file'),
    categorizedFile: optionalStringArg(args, 'categorized-file'),
    sloFile: optionalStringArg(args, 'slo-file'),
    planFile: optionalStringArg(args, 'plan-file'),
    burstCount: parseOptionalIntegerArg(args, 'burst-count'),
    burstIntervalMs: parseOptionalIntegerArg(args, 'burst-interval-ms'),
    copiesPerEvent: parseOptionalIntegerArg(args, 'copies-per-event'),
    randomizeEventCounts: args['randomize-event-counts'] === true
  };
}

function optionalStringArg(args: Record<string, string | boolean>, key: string): string | undefined {
  const value = args[key];
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  return value.trim();
}

function requireStringArg(args: Record<string, string | boolean>, key: string): string {
  const value = optionalStringArg(args, key);
  if (!value) {
    throw new Error(`Argumento obrigatório ausente: --${key}`);
  }

  return value;
}

function parseOptionalIntegerArg(args: Record<string, string | boolean>, key: string): number | undefined {
  const value = args[key];
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Valor inválido para --${key}: ${value}`);
  }

  return parsed;
}

const VALID_STEPS: ReadonlySet<WorkflowStepArg> = new Set([
  'input',
  'categorize',
  'slos',
  'openslo',
  'plan',
  'terraform',
  'apply'
]);

function parseStepArg(
  value: string | boolean | undefined,
  fallback: WorkflowStepArg
): WorkflowStepArg {
  if (typeof value !== 'string' || value.trim() === '') {
    return fallback;
  }

  if ((VALID_STEPS as ReadonlySet<string>).has(value)) {
    return value as WorkflowStepArg;
  }

  throw new RangeError(`Etapa inválida: ${value}`);
}
