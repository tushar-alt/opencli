import { Command } from 'commander';
import { loadConfig } from './config/loader.js';
import { startChat } from './commands/chat.js';
import { runOneShot } from './commands/run.js';
import { configCommand } from './commands/config-cmd.js';
import { PROVIDERS } from './config/types.js';
import { theme } from './ui/theme.js';

const VERSION = '0.1.0';

export function buildCli(): Command {
  const program = new Command();

  program
    .name('species')
    .description('Universal AI coding CLI — works with any AI provider')
    .version(VERSION)
    // Global flags
    .option('-p, --provider <provider>', `AI provider (${PROVIDERS.join(', ')})`)
    .option('-m, --model <model>', 'Model name to use')
    .option('-e, --endpoint <url>', 'API base URL / endpoint')
    .option('-k, --api-key <key>', 'API key')
    .option('--think', 'Enable thinking/reasoning mode')
    .option('--think-budget <tokens>', 'Thinking token budget', parseInt)
    .option('--max-turns <n>', 'Max agent turns', parseInt)
    .option('-s, --system <prompt>', 'System prompt override')
    .option('-y, --yes', 'Auto-confirm shell commands (no prompts)')
    .option('--no-tools', 'Disable all tools (pure chat mode)')
    .option('-o, --output <file>', 'Write response to file (one-shot mode)')
    .option('-q, --quiet', 'Suppress status messages')
    .argument('[prompt]', 'Optional prompt for one-shot mode');

  // ── Default action: interactive REPL or one-shot ─────────────────────────
  program.action(async (prompt: string | undefined, options: Record<string, unknown>) => {
    const cwd = process.cwd();

    const flags = {
      provider: options['provider'] as string | undefined,
      model: options['model'] as string | undefined,
      endpoint: options['endpoint'] as string | undefined,
      apiKey: options['apiKey'] as string | undefined,
      think: options['think'] as boolean | undefined,
      thinkBudget: options['thinkBudget'] as number | undefined,
      maxTurns: options['maxTurns'] as number | undefined,
      system: options['system'] as string | undefined,
      yes: options['yes'] as boolean | undefined,
      noTools: options['noTools'] as boolean | undefined,
    };

    try {
      const config = loadConfig(cwd, flags);

      // Show warning if no API key, but don't exit - let user configure in interactive mode
      if (config.provider !== 'ollama' && !config.apiKey) {
        process.stderr.write(
          theme.warning(`⚠️  No API key configured for provider "${config.provider}".\n`),
        );
        process.stderr.write(
          theme.muted(
            `Run "/auth" in interactive mode to set up your API key.\n\n`,
          ),
        );
      }

      if (prompt) {
        // One-shot mode
        await runOneShot(prompt, config, cwd, {
          outputFile: options['output'] as string | undefined,
          quiet: options['quiet'] as boolean | undefined,
        });
      } else {
        // Interactive REPL
        await startChat(config, cwd);
      }
    } catch (err) {
      process.stderr.write(theme.error(`\nFatal error: ${String(err)}\n`));
      process.exit(1);
    }
  });

  // ── Config subcommand ─────────────────────────────────────────────────────
  const configCmd = program
    .command('config')
    .description('Manage species configuration');

  configCmd
    .command('list')
    .alias('show')
    .description('Show current configuration')
    .action(() => void configCommand('list'));

  configCmd
    .command('get <key>')
    .description('Get a configuration value')
    .action((key: string) => void configCommand('get', key));

  configCmd
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action((key: string, value: string) => void configCommand('set', key, value));

  configCmd
    .command('unset <key>')
    .description('Remove a configuration value')
    .action((key: string) => void configCommand('unset', key));

  configCmd
    .command('reset')
    .description('Reset configuration to defaults')
    .action(() => void configCommand('reset'));

  configCmd
    .command('use <provider>')
    .description(`Switch to a provider preset (${PROVIDERS.join(', ')})`)
    .action((provider: string) => void configCommand('use', provider));

  configCmd
    .command('validate')
    .description('Validate current configuration')
    .action(() => void configCommand('validate'));

  // ── Providers command ─────────────────────────────────────────────────────
  program
    .command('providers')
    .description('List available AI providers')
    .action(async () => {
      const { PROVIDER_PRESETS } = await import('./config/presets.js');
      process.stdout.write('\nAvailable providers:\n\n');
      for (const [name, preset] of Object.entries(PROVIDER_PRESETS)) {
        process.stdout.write(
          `  ${theme.primary(name.padEnd(12))} ${theme.muted(`${preset.model ?? 'custom'} — ${preset.endpoint ?? 'native SDK'}`)}\n`,
        );
      }
      process.stdout.write(
        '\nConfigure: species config use <provider>\n',
      );
    });

  return program;
}
