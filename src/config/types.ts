import { z } from 'zod';

export const PROVIDERS = ['openai', 'anthropic', 'gemini', 'ollama', 'groq', 'mistral', 'custom'] as const;
export type Provider = (typeof PROVIDERS)[number];

export const OpenAiCliConfigSchema = z.object({
  provider: z.enum(PROVIDERS).default('openai'),
  endpoint: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().default('gpt-4o'),
  thinkMode: z.boolean().default(false),
  thinkBudget: z.number().int().min(1000).max(100000).default(10000),
  maxTurns: z.number().int().min(1).max(100).default(20),
  systemPrompt: z.string().optional(),
  enabledTools: z
    .array(z.string())
    .default(['read_file', 'write_file', 'edit_file', 'shell', 'search_files', 'search_content']),
  autoConfirm: z.boolean().default(false),
  contextLines: z.number().int().min(0).max(20).default(3),
});

export type OpenAiCliConfig = z.infer<typeof OpenAiCliConfigSchema>;

// Resolved config always has full defaults applied
export type ResolvedConfig = Required<OpenAiCliConfig> & {
  endpoint: string | undefined;
  apiKey: string | undefined;
  systemPrompt: string | undefined;
};

export interface StoredConfig extends Partial<OpenAiCliConfig> {}
