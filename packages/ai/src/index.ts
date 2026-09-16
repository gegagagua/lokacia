import { AnthropicAiClient, MockAiClient, type AiClient, type AiLogger } from './client';

export * from './client';
export * from './services';
export * from './prompts';
export { parseSearchText } from './rules/search-parser';

/** Live client only when a key is configured; otherwise the deterministic mock. */
export function createAiClient(env: { ANTHROPIC_API_KEY?: string; AI_MODEL?: string }, logger?: AiLogger): AiClient {
  if (env.ANTHROPIC_API_KEY) return new AnthropicAiClient({ apiKey: env.ANTHROPIC_API_KEY, model: env.AI_MODEL, logger });
  return new MockAiClient();
}
