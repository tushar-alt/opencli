import chalk from 'chalk';
import { readGlobalConfig, writeGlobalConfig, setConfigValue } from '../config/manager.js';
import { OpenAiCliConfigSchema, PROVIDERS } from '../config/types.js';
import { getPreset } from '../config/presets.js';
import { theme } from '../ui/theme.js';

export async function configCommand(action: string, key?: string, value?: string): Promise<void> {
  switch (action) {
    case 'list':
    case 'show': {
      const config = readGlobalConfig();
      process.stdout.write(chalk.bold('\nGlobal Configuration (~/.openaicli/config.json):\n\n'));
      if (Object.keys(config).length === 0) {
        process.stdout.write(theme.muted('  (no configuration set — using defaults)\n'));
      } else {
        process.stdout.write(theme.secondary(JSON.stringify(config, null, 2)) + '\n');
      }
      process.stdout.write('\n');
      break;
    }

    case 'get': {
      if (!key) {
        process.stderr.write(theme.error('Usage: openaicli config get <key>\n'));
        process.exit(1);
      }
      const config = readGlobalConfig();
      const val = (config as Record<string, unknown>)[key];
      if (val === undefined) {
        process.stdout.write(theme.muted(`(not set)\n`));
      } else {
        process.stdout.write(`${JSON.stringify(val)}\n`);
      }
      break;
    }

    case 'set': {
      if (!key || value === undefined) {
        process.stderr.write(theme.error('Usage: openaicli config set <key> <value>\n'));
        process.exit(1);
      }

      // Parse value intelligently
      let parsedValue: unknown = value;
      if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      else if (!isNaN(Number(value)) && value !== '') parsedValue = Number(value);

      setConfigValue(key, parsedValue);
      process.stdout.write(theme.success(`Set ${key} = ${JSON.stringify(parsedValue)}\n`));
      break;
    }

    case 'unset':
    case 'delete': {
      if (!key) {
        process.stderr.write(theme.error('Usage: openaicli config unset <key>\n'));
        process.exit(1);
      }
      const config = readGlobalConfig();
      delete (config as Record<string, unknown>)[key];
      writeGlobalConfig(config);
      process.stdout.write(theme.success(`Unset ${key}\n`));
      break;
    }

    case 'reset': {
      writeGlobalConfig({});
      process.stdout.write(theme.success('Configuration reset to defaults.\n'));
      break;
    }

    case 'use': {
      // Shorthand: openaicli config use anthropic
      const providerName = key;
      if (!providerName || !PROVIDERS.includes(providerName as typeof PROVIDERS[number])) {
        process.stderr.write(
          theme.error(`Invalid provider. Valid: ${PROVIDERS.join(', ')}\n`),
        );
        process.exit(1);
      }
      const preset = getPreset(providerName as typeof PROVIDERS[number]);
      const current = readGlobalConfig();
      writeGlobalConfig({ ...current, ...preset });
      process.stdout.write(theme.success(`Using provider: ${providerName}\n`));
      process.stdout.write(
        theme.muted(`  Model: ${preset.model ?? '(default)'}\n`),
      );
      if (preset.endpoint) {
        process.stdout.write(theme.muted(`  Endpoint: ${preset.endpoint}\n`));
      }
      process.stdout.write(
        theme.muted(`  Set your API key: openaicli config set apiKey YOUR_KEY\n`),
      );
      break;
    }

    case 'validate': {
      const config = readGlobalConfig();
      const result = OpenAiCliConfigSchema.safeParse(config);
      if (result.success) {
        process.stdout.write(theme.success('Configuration is valid.\n'));
      } else {
        process.stderr.write(theme.error('Configuration errors:\n'));
        for (const issue of result.error.issues) {
          process.stderr.write(`  ${issue.path.join('.')}: ${issue.message}\n`);
        }
        process.exit(1);
      }
      break;
    }

    default:
      process.stderr.write(theme.error(`Unknown config action: ${action}\n`));
      process.stderr.write(
        theme.muted('Valid actions: list, get, set, unset, reset, use, validate\n'),
      );
      process.exit(1);
  }
}
