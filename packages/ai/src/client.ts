import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';

export const DEFAULT_MODEL = 'claude-opus-5';

export type AiUsage = { model: string; inputTokens: number; outputTokens: number; ms: number; purpose: string };
export type AiLogger = (u: AiUsage) => void;

export interface AiClient {
  readonly live: boolean;
  /** Structured JSON output validated against a Zod schema. Returns null when the model refuses or output is invalid. */
  json<T extends z.ZodType>(opts: { purpose: string; system: string; prompt: string; schema: T; maxTokens?: number }): Promise<z.infer<T> | null>;
  text(opts: { purpose: string; system: string; prompt: string; maxTokens?: number }): Promise<string | null>;
}

export type AiClientOptions = {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  logger?: AiLogger;
};

/** Live client via the official Anthropic SDK. Retries 408/429/5xx (SDK), request timeout per call. */
export class AnthropicAiClient implements AiClient {
  readonly live = true;
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(private readonly opts: AiClientOptions) {
    this.client = new Anthropic({ apiKey: opts.apiKey, maxRetries: opts.maxRetries ?? 2 });
    this.model = opts.model || DEFAULT_MODEL;
    this.timeoutMs = opts.timeoutMs ?? 20_000;
  }

  async json<T extends z.ZodType>({ purpose, system, prompt, schema, maxTokens }: Parameters<AiClient['json']>[0] & { schema: T }) {
    const started = Date.now();
    const response = await this.client.messages.parse(
      {
        model: this.model,
        max_tokens: maxTokens ?? 2048,
        system,
        output_config: { effort: 'low', format: zodOutputFormat(schema) },
        messages: [{ role: 'user', content: prompt }],
      },
      { timeout: this.timeoutMs },
    );
    this.log(purpose, response.usage, started);
    if (response.stop_reason === 'refusal') return null;
    return (response.parsed_output ?? null) as z.infer<T> | null;
  }

  async text({ purpose, system, prompt, maxTokens }: Parameters<AiClient['text']>[0]) {
    const started = Date.now();
    const response = await this.client.messages.create(
      {
        model: this.model,
        max_tokens: maxTokens ?? 4096,
        system,
        output_config: { effort: 'low' },
        messages: [{ role: 'user', content: prompt }],
      },
      { timeout: this.timeoutMs },
    );
    this.log(purpose, response.usage, started);
    if (response.stop_reason === 'refusal') return null;
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
  }

  private log(purpose: string, usage: Anthropic.Usage, started: number) {
    this.opts.logger?.({ purpose, model: this.model, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens, ms: Date.now() - started });
  }
}

/** Deterministic client for dev/test/CI: delegates to registered handlers per purpose. */
export class MockAiClient implements AiClient {
  readonly live = false;
  constructor(private readonly handlers: Record<string, (prompt: string) => unknown> = {}) {}
  async json<T extends z.ZodType>({ purpose, prompt, schema }: { purpose: string; prompt: string; schema: T }) {
    const h = this.handlers[purpose];
    if (!h) return null;
    const parsed = schema.safeParse(h(prompt));
    return parsed.success ? (parsed.data as z.infer<T>) : null;
  }
  async text({ purpose, prompt }: { purpose: string; prompt: string }) {
    const h = this.handlers[purpose];
    return h ? String(h(prompt)) : null;
  }
}
