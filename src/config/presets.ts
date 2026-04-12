import type { Provider, StoredConfig } from './types.js';

export const PROVIDER_PRESETS: Record<Provider, StoredConfig> = {
  openai: {
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o',
  },
  anthropic: {
    provider: 'anthropic',
    endpoint: undefined, // uses native SDK default
    model: 'claude-sonnet-4-6',
  },
  gemini: {
    provider: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash',
  },
  ollama: {
    provider: 'ollama',
    endpoint: 'http://localhost:11434/v1',
    apiKey: 'ollama', // Ollama needs a placeholder
    model: 'llama3.2',
  },
  groq: {
    provider: 'groq',
    endpoint: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
  },
  mistral: {
    provider: 'mistral',
    endpoint: 'https://api.mistral.ai/v1',
    model: 'mistral-large-latest',
  },
  custom: {
    provider: 'custom',
    endpoint: undefined,
    model: 'default',
  },
};

export function getPreset(provider: Provider): StoredConfig {
  return PROVIDER_PRESETS[provider] ?? PROVIDER_PRESETS['custom'];
}
