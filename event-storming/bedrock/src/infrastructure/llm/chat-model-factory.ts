import {
  BedrockRuntimeClient,
  ConverseCommand,
  Message
} from '@aws-sdk/client-bedrock-runtime';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Logger } from '../../shared/logger.js';

const logger = new Logger('chat-model-factory');

export type SupportedProvider = 'bedrock';
export type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type ChatModelResponse = {
  content: string;
  usage: ModelUsage;
};

export function buildChatModel(provider: SupportedProvider, model: string) {
  logger.info('Construindo cliente de modelo', { provider, model });
  return new BedrockChatModel(model);
}

class BedrockChatModel {
  constructor(private readonly model: string) {}

  async invoke(messages: Array<SystemMessage | HumanMessage>): Promise<ChatModelResponse> {
    const { systemPrompts, bedrockMessages } = toBedrockConversation(messages);
    const client = createBedrockClient();

    const response = await client.send(new ConverseCommand({
      modelId: this.model,
      system: systemPrompts.map((text) => ({ text })),
      messages: bedrockMessages,
      inferenceConfig: {
        temperature: 0
      }
    }));

    return {
      content: readBedrockTextResponse(response.output?.message?.content),
      usage: {
        inputTokens: response.usage?.inputTokens ?? 0,
        outputTokens: response.usage?.outputTokens ?? 0,
        totalTokens: response.usage?.totalTokens ?? 0
      }
    };
  }
}

function toBedrockConversation(messages: Array<SystemMessage | HumanMessage>): {
  systemPrompts: string[];
  bedrockMessages: Message[];
} {
  const systemPrompts: string[] = [];
  const bedrockMessages: Message[] = [];

  for (const message of messages) {
    if (message instanceof SystemMessage) {
      systemPrompts.push(String(message.content ?? ''));
      continue;
    }

    if (!(message instanceof HumanMessage)) {
      continue;
    }

    const content = Array.isArray(message.content)
      ? message.content
      : [{ type: 'text' as const, text: String(message.content ?? '') }];
    const bedrockContent: NonNullable<Message['content']> = [];

    for (const part of content) {
      if (part.type === 'text') {
        bedrockContent.push({ text: part.text });
        continue;
      }

      if (part.type === 'image_url') {
        bedrockContent.push(imageUrlPartToBedrockBlock(part.image_url.url));
      }
    }

    bedrockMessages.push({ role: 'user', content: bedrockContent });
  }

  return { systemPrompts, bedrockMessages };
}

function imageUrlPartToBedrockBlock(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    throw new Error('Formato de image_url inválido para Bedrock.');
  }

  const [, mimeType, base64] = match;
  return {
    image: {
      format: mimeTypeToFormat(mimeType),
      source: {
        bytes: Uint8Array.from(Buffer.from(base64, 'base64'))
      }
    }
  };
}

function mimeTypeToFormat(mimeType: string): 'png' | 'jpeg' | 'gif' | 'webp' {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpeg';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    default:
      return 'png';
  }
}

function readBedrockTextResponse(content: Array<{ text?: string }> | undefined): string {
  const text = (content ?? [])
    .map((part) => part.text ?? '')
    .join('\n')
    .trim();

  if (text === '') {
    throw new Error('Bedrock retornou resposta vazia.');
  }

  return text;
}

function createBedrockClient() {
  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION ?? process.env.BEDROCK_AWS_REGION ?? 'us-east-1',
    requestHandler: new NodeHttpHandler({
      requestTimeout: Number(process.env.BEDROCK_REQUEST_TIMEOUT_MS ?? '3600000')
    })
  });
}
