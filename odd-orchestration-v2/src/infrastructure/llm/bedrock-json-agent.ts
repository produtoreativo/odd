import { BedrockRuntimeClient, ConverseCommand, Message } from '@aws-sdk/client-bedrock-runtime';
import { NodeHttpHandler } from '@smithy/node-http-handler';

export type JsonSchema = Record<string, unknown>;

export class BedrockJsonAgent {
  private readonly client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    requestHandler: new NodeHttpHandler({
      requestTimeout: Number(process.env.BEDROCK_REQUEST_TIMEOUT_MS ?? '3600000')
    })
  });

  constructor(private readonly modelId: string) {}

  async call(systemPrompt: string, userPrompt: string, _schema: JsonSchema): Promise<unknown> {
    const rawText = await this.callRawText(systemPrompt, userPrompt);
    return parseJsonLenient(extractJsonPayload(rawText));
  }

  async callWithRaw(systemPrompt: string, userPrompt: string, schema: JsonSchema): Promise<{ rawText: string; parsed: unknown }> {
    void schema;
    const rawText = await this.callRawText(systemPrompt, userPrompt);

    return {
      rawText,
      parsed: parseJsonLenient(extractJsonPayload(rawText))
    };
  }

  async callRawText(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await this.client.send(new ConverseCommand({
      modelId: this.modelId,
      inferenceConfig: { temperature: 0 },
      system: [{ text: systemPrompt }],
      messages: [{
        role: 'user',
        content: [{ text: userPrompt }]
      } satisfies Message]
    }));

    const rawText = (response.output?.message?.content ?? [])
      .map((item) => item.text ?? '')
      .join('\n')
      .trim();

    if (rawText === '') {
      throw new Error('Bedrock retornou resposta vazia.');
    }

    return rawText;
  }
}

export function parseBedrockJsonResponse(rawText: string): unknown {
  return parseJsonLenient(extractJsonPayload(rawText));
}

function extractJsonPayload(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]+?)```/i);
  if (fenced) {
    return fenced[1].trim();
  }

  const objectStart = text.indexOf('{');
  const objectEnd = text.lastIndexOf('}');
  const arrayStart = text.indexOf('[');
  const arrayEnd = text.lastIndexOf(']');

  if (objectStart >= 0 && objectEnd > objectStart && (arrayStart === -1 || objectStart < arrayStart)) {
    return text.slice(objectStart, objectEnd + 1);
  }

  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return text.slice(arrayStart, arrayEnd + 1);
  }

  throw new Error('Resposta do modelo não contém JSON válido.');
}

function parseJsonLenient(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    const repaired = repairJsonAggressive(payload);
    try {
      return JSON.parse(repaired);
    } catch {
      const repairedByLines = repairJsonByLines(repaired);
      return JSON.parse(repairedByLines);
    }
  }
}

function repairJson(payload: string): string {
  return payload
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, '\'')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/}\s*{/g, '},{')
    .replace(/]\s*\[/g, '],[')
    .replace(/\ufeff/g, '')
    .trim();
}

function repairJsonAggressive(payload: string): string {
  let repaired = repairJson(payload);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    repaired = repaired
      .replace(/"\s*\n\s*"/g, '",\n"')
      .replace(/}\s*\n\s*{/g, '},\n{')
      .replace(/]\s*\n\s*\[/g, '],\n[')
      .replace(/"\s*\n\s*}/g, '"\n}')
      .replace(/"\s*\n\s*]/g, '"\n]');
  }

  return repaired;
}

function repairJsonByLines(payload: string): string {
  const lines = payload.split('\n');
  const repaired: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];
    const next = lines[index + 1];
    if (!next) {
      repaired.push(current);
      continue;
    }

    const trimmedCurrent = current.trimEnd();
    const trimmedNext = next.trimStart();
    const shouldAppendComma =
      trimmedCurrent !== '' &&
      !trimmedCurrent.endsWith(',') &&
      !trimmedCurrent.endsWith('{') &&
      !trimmedCurrent.endsWith('[') &&
      !trimmedCurrent.endsWith(':') &&
      !trimmedNext.startsWith('}') &&
      !trimmedNext.startsWith(']') &&
      (
        trimmedNext.startsWith('"')
        || trimmedNext.startsWith('{')
        || trimmedNext.startsWith('[')
      ) &&
      (
        trimmedCurrent.endsWith('"')
        || trimmedCurrent.endsWith('}')
        || trimmedCurrent.endsWith(']')
        || /[0-9a-zA-Z]$/.test(trimmedCurrent)
      );

    repaired.push(shouldAppendComma ? `${trimmedCurrent},` : current);
  }

  return repaired.join('\n');
}
