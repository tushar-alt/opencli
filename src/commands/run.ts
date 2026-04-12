import { writeFileSync } from 'fs';
import type { ResolvedConfig } from '../config/types.js';
import { buildSystemPrompt } from '../agent/context.js';
import { runAgentLoop } from '../agent/loop.js';
import { theme } from '../ui/theme.js';

export interface RunOptions {
  outputFile?: string | undefined;
  quiet?: boolean | undefined;
}

export async function runOneShot(
  prompt: string,
  config: ResolvedConfig,
  cwd: string,
  options: RunOptions = {},
): Promise<void> {
  if (!options.quiet) {
    process.stderr.write(
      theme.muted(`[anyopencli] ${config.provider}/${config.model}\n`),
    );
    process.stderr.write(theme.separator + '\n\n');
  }

  const systemPrompt = buildSystemPrompt(config, cwd);

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: prompt },
  ];

  try {
    const result = await runAgentLoop(messages, config, cwd);

    if (options.outputFile) {
      writeFileSync(options.outputFile, result.text, 'utf-8');
      process.stderr.write(theme.success(`\nOutput written to: ${options.outputFile}\n`));
    }
  } catch (err) {
    process.stderr.write(theme.error(`\nError: ${String(err)}\n`));
    process.exit(1);
  }
}
