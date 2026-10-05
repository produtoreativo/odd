import { CliArgs } from '../../shared/args.js';
import { Logger } from '../../shared/logger.js';

const logger = new Logger('agent-model-resolver');

export type AgentModels = {
  extractModel: string;
  normalizeModel: string;
};

export function resolveAgentModels(args: CliArgs): AgentModels {
  const envDefaultModel = process.env.EVENT_STORMING_DEFAULT_MODEL?.trim();
  const fallbackDefaultModel = args.defaultModel?.trim() || envDefaultModel;

  const extractModel = pickModel(args.extractModel, process.env.EVENT_STORMING_EXTRACT_MODEL, fallbackDefaultModel);
  const normalizeModel = pickModel(args.normalizeModel, process.env.EVENT_STORMING_NORMALIZE_MODEL, fallbackDefaultModel);

  if (!extractModel || !normalizeModel) {
    throw new Error(
      'Modelos ausentes. Defina EVENT_STORMING_DEFAULT_MODEL ou os modelos específicos por agente no .env, ou passe --model/--extract-model/--normalize-model.'
    );
  }

  const models = { extractModel, normalizeModel };
  logger.info('Modelos resolvidos por agente', models);
  return models;
}

function pickModel(
  cliSpecific: string | undefined,
  envSpecific: string | undefined,
  fallbackDefault: string | undefined
): string | undefined {
  return cliSpecific?.trim() || envSpecific?.trim() || fallbackDefault?.trim();
}
