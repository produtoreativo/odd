export type CliArgs = {
  inputImage: string;
  outputDir: string;
  provider: 'ollama' | 'openai';
  startFrom: 'observe' | 'extract' | 'normalize';
  imageObservation?: string;
  candidateContext?: string;
  defaultModel?: string;
  observeModel?: string;
  extractModel?: string;
  normalizeModel?: string;
  maxAttempts: number;
};

export function parseCliArgs(argv: string[]): CliArgs {
  const rawArgs = parseArgs(argv);

  return {
    inputImage: requireStringArg(rawArgs, 'input-image'),
    outputDir: requireStringArg(rawArgs, 'output-dir'),
    provider: requireProviderArg(rawArgs),
    startFrom: requireStartFromArg(rawArgs),
    imageObservation: optionalStringArg(rawArgs, 'image-observation'),
    candidateContext: optionalStringArg(rawArgs, 'candidate-context'),
    defaultModel: optionalStringArg(rawArgs, 'model'),
    observeModel: optionalStringArg(rawArgs, 'observe-model'),
    extractModel: optionalStringArg(rawArgs, 'extract-model'),
    normalizeModel: optionalStringArg(rawArgs, 'normalize-model'),
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

function requireProviderArg(args: Record<string, string>): 'ollama' | 'openai' {
  const provider = (args.provider ?? 'ollama').trim();
  if (provider !== 'ollama' && provider !== 'openai') {
    throw new Error(`Provider inválido: ${provider}`);
  }
  return provider;
}

function requireStartFromArg(args: Record<string, string>): 'observe' | 'extract' | 'normalize' {
  const startFrom = (args['start-from'] ?? 'observe').trim();
  if (startFrom !== 'observe' && startFrom !== 'extract' && startFrom !== 'normalize') {
    throw new Error(`start-from inválido: ${startFrom}`);
  }
  return startFrom;
}

function toPositiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`max-attempts inválido: ${value}`);
  }
  return parsed;
}
