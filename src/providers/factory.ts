import type { ResolvedConfig } from '../config/types.js';
import type { ProviderAdapter } from './types.js';
import { AnthropicAdapter } from './anthropic-adapter.js';
import { OpenAIAdapter } from './openai-adapter.js';

export function createAdapter(config: ResolvedConfig): ProviderAdapter {
  if (config.provider === 'anthropic') {
    return new AnthropicAdapter(config);
  }
  return new OpenAIAdapter(config);
}
