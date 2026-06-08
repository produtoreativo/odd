export type CliArgs = {
  inputObservation: string;
  outputRoot: string;
  outputDir: string;
  workflowKey?: string;
  runId?: string;
  legacyOutputDir: boolean;
  env: string;
  provider: 'bedrock';
  defaultModel?: string;
  identifyModel?: string;
  maxAttempts: number;
};

export function parseCliArgs(argv: string[]): CliArgs {
  const rawArgs = parseArgs(argv);

  return {
    inputObservation: optionalStringArg(rawArgs, 'input')
      ?? requireStringArg(rawArgs, 'input-observation'),
    outputRoot: optionalStringArg(rawArgs, 'output')
      ?? optionalStringArg(rawArgs, 'output-root')
      ?? './generated',
    outputDir: optionalStringArg(rawArgs, 'output-dir') ?? '',
    workflowKey: optionalStringArg(rawArgs, 'workflow-key'),
    runId: optionalStringArg(rawArgs, 'run-id'),
    legacyOutputDir: Boolean(optionalStringArg(rawArgs, 'output-dir')),
    env: optionalStringArg(rawArgs, 'env') ?? 'dev',
    provider: requireProviderArg(rawArgs),
    defaultModel: optionalStringArg(rawArgs, 'model'),
    identifyModel: optionalStringArg(rawArgs, 'identify-model'),
    maxAttempts: toPositiveInteger(rawArgs['max-attempts'] ?? '2')
  };
}

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`Valor ausente para --${key}`);
    }

    result[key] = next;
    index += 1;
  }

  return result;
}

function requireStringArg(args: Record<string, string>, key: string): string {
  const value = args[key];
  if (!value || value.trim() === '') {
    throw new Error(`Argumento obrigatório ausente: --${key}`);
  }
  return value.trim();
}

function optionalStringArg(args: Record<string, string>, key: string): string | undefined {
  const value = args[key];
  if (!value || value.trim() === '') {
    return undefined;
  }
  return value.trim();
}

function requireProviderArg(args: Record<string, string>): 'bedrock' {
  const provider = (args.provider ?? 'bedrock').trim();
  if (provider !== 'bedrock') {
    throw new Error(`Provider inválido: ${provider}`);
  }
  return provider;
}

function toPositiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`max-attempts inválido: ${value}`);
  }
  return parsed;
}
