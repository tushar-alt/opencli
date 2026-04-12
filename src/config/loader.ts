import { OpenCliConfigSchema, type ResolvedConfig, type StoredConfig } from './types.js';
import { readGlobalConfig, readProjectConfig } from './manager.js';
import { getPreset } from './presets.js';

export interface CliFlags {
  provider?: string | undefined;
  model?: string | undefined;
  endpoint?: string | undefined;
  apiKey?: string | undefined;
  think?: boolean | undefined;
  thinkBudget?: number | undefined;
  maxTurns?: number | undefined;
  system?: string | undefined;
  yes?: boolean | undefined;
  noTools?: boolean | undefined;
}

export function loadConfig(cwd: string, flags: CliFlags = {}): ResolvedConfig {
  const globalConfig = readGlobalConfig();
  const projectConfig = readProjectConfig(cwd);

  // Determine provider: flags > project > global > default
  const provider = (flags.provider ?? projectConfig.provider ?? globalConfig.provider ?? 'openai') as ResolvedConfig['provider'];

  // Apply preset as base, then layer configs on top
  const preset = getPreset(provider);

  const merged: StoredConfig = {
    ...preset,
    ...globalConfig,
    ...projectConfig,
    // CLI flags take highest priority
    ...(flags.provider !== undefined ? { provider: flags.provider as ResolvedConfig['provider'] } : {}),
    ...(flags.model !== undefined ? { model: flags.model } : {}),
    ...(flags.endpoint !== undefined ? { endpoint: flags.endpoint } : {}),
    ...(flags.apiKey !== undefined ? { apiKey: flags.apiKey } : {}),
    ...(flags.think !== undefined ? { thinkMode: flags.think } : {}),
    ...(flags.thinkBudget !== undefined ? { thinkBudget: flags.thinkBudget } : {}),
    ...(flags.maxTurns !== undefined ? { maxTurns: flags.maxTurns } : {}),
    ...(flags.system !== undefined ? { systemPrompt: flags.system } : {}),
    ...(flags.yes !== undefined ? { autoConfirm: flags.yes } : {}),
    ...(flags.noTools ? { enabledTools: [] } : {}),
  };

  // Apply API key from environment if not set
  if (!merged.apiKey) {
    const envKey = getEnvKey(provider);
    if (envKey) merged.apiKey = envKey;
  }

  const parsed = OpenCliConfigSchema.parse(merged);

  return {
    ...parsed,
    endpoint: parsed.endpoint,
    apiKey: parsed.apiKey,
    systemPrompt: parsed.systemPrompt,
  } as ResolvedConfig;
}

function getEnvKey(provider: string): string | undefined {
  const envMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    gemini: 'GEMINI_API_KEY',
    groq: 'GROQ_API_KEY',
    mistral: 'MISTRAL_API_KEY',
    ollama: '',
    custom: 'OPENCLI_API_KEY',
  };
  const envVar = envMap[provider];
  if (!envVar) return undefined;
  return process.env[envVar];
}
