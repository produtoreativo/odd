import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama } from '@langchain/ollama';
import { Logger } from '../../shared/logger.js';

const logger = new Logger('chat-model-factory');

export type SupportedProvider = 'ollama' | 'openai';

export function buildChatModel(provider: SupportedProvider, model: string) {
  logger.info('Construindo cliente de modelo', { provider, model });

  if (provider === 'openai') {
    return new ChatOpenAI({
      model,
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
      configuration: process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : undefined
    });
  }

  return new ChatOllama({
    model,
    temperature: 0,
    baseUrl: (process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434').replace('://localhost:', '://127.0.0.1:')
  });
}
