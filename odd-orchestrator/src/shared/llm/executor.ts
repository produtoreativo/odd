export type JsonSchema = Record<string, unknown>;

export abstract class LlmExecutor {
  constructor(protected model: string) {}
  abstract call(prompt: string, format: JsonSchema): Promise<unknown>;
}
