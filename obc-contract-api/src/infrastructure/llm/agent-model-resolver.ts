import { CliArgs } from '../../shared/args.js';
import { Logger } from '../../shared/logger.js';

const logger = new Logger('agent-model-resolver');

export type AgentModels = {
  identifyModel: string;
};

export function resolveAgentModels(args: CliArgs): AgentModels {
  const envDefaultModel = process.env.OBC_CONTRACT_DEFAULT_MODEL?.trim();
  const fallbackDefaultModel = args.defaultModel?.trim() || envDefaultModel;

  const identifyModel = pickModel(args.identifyModel, process.env.OBC_CONTRACT_IDENTIFY_MODEL, fallbackDefaultModel);

  if (!identifyModel) {
    throw new Error(
      'Modelo ausente. Defina OBC_CONTRACT_DEFAULT_MODEL ou OBC_CONTRACT_IDENTIFY_MODEL no .env, ou passe --model/--identify-model.'
    );
  }

  const models = { identifyModel };
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
