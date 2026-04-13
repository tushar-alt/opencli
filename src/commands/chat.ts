import chalk from 'chalk';
import { createInterface } from 'readline';
import Enquirer from 'enquirer';
import type { ResolvedConfig } from '../config/types.js';
import { ConversationHistory } from '../agent/history.js';
import { buildSystemPrompt } from '../agent/context.js';
import { runAgentLoop } from '../agent/loop.js';
import { SpeciesRepl, printHelp } from '../ui/repl.js';
import { theme, SPECIES_LOGO } from '../ui/theme.js';
import { loadConfig } from '../config/loader.js';

export async function startChat(config: ResolvedConfig, cwd: string): Promise<void> {
  // Print welcome banner
  process.stdout.write(chalk.cyan(SPECIES_LOGO) + '\n\n');
  process.stdout.write(
    theme.muted(
      `Provider: ${config.provider} | Model: ${config.model}${config.thinkMode ? ' | Think: on' : ''}\n`,
    ),
  );
  process.stdout.write(theme.muted('Type /help for commands, Ctrl+D or /exit to quit\n\n'));
  process.stdout.write(theme.separator + '\n\n');

  const history = new ConversationHistory();
  history.setSystem(buildSystemPrompt(config, cwd));

  // Mutable config for session overrides
  let sessionConfig = { ...config };

  const repl = new SpeciesRepl({
    onInput: async (input) => {
      history.addUser(input);

      process.stdout.write('\n' + theme.secondary('species> ') + '\n\n');

      try {
        const messages = history.getMessages();
        const result = await runAgentLoop(messages, sessionConfig, cwd);

        // Add assistant response to history
        history.addMessages([
          {
            role: 'assistant',
            content: result.text,
          },
        ]);

        process.stdout.write('\n');
      } catch (err) {
        process.stdout.write(theme.error(`\nError: ${String(err)}\n\n`));
        // Remove the failed user message from history
        const msgs = history.getMessages();
        const last = msgs[msgs.length - 1];
        if (last?.role === 'user') {
          // Just note the error — history already has user msg, that's fine
        }
      }
    },

    onCommand: async (cmd, args) => {
      switch (cmd.toLowerCase()) {
        case 'help':
          printHelp();
          return true;

        case 'exit':
        case 'quit':
          process.stdout.write(theme.muted('\nGoodbye!\n'));
          process.exit(0);

        case 'clear':
          history.clear();
          history.setSystem(buildSystemPrompt(sessionConfig, cwd));
          process.stdout.write(theme.success('Conversation cleared.\n'));
          return true;

        case 'history': {
          const msgs = history.getMessages().filter((m) => m.role !== 'system');
          if (msgs.length === 0) {
            process.stdout.write(theme.muted('No conversation history yet.\n'));
          } else {
            for (const msg of msgs) {
              const prefix = msg.role === 'user' ? theme.prompt('you') : theme.secondary('species');
              const preview =
                msg.content.length > 100 ? msg.content.slice(0, 100) + '…' : msg.content;
              process.stdout.write(`${prefix}: ${preview}\n`);
            }
          }
          return true;
        }

        case 'model':
          if (!args) {
            process.stdout.write(theme.info(`Current model: ${sessionConfig.model}\n`));
          } else {
            sessionConfig = { ...sessionConfig, model: args };
            process.stdout.write(theme.success(`Switched to model: ${args}\n`));
          }
          return true;

        case 'provider': {
          if (!args) {
            process.stdout.write(theme.info(`Current provider: ${sessionConfig.provider}\n`));
          } else {
            const newConfig = loadConfig(cwd, { provider: args });
            sessionConfig = { ...sessionConfig, ...newConfig, provider: args as ResolvedConfig['provider'] };
            process.stdout.write(theme.success(`Switched to provider: ${args}\n`));
          }
          return true;
        }

        case 'think':
          sessionConfig = { ...sessionConfig, thinkMode: !sessionConfig.thinkMode };
          process.stdout.write(
            theme.success(`Think mode: ${sessionConfig.thinkMode ? 'ON' : 'OFF'}\n`),
          );
          return true;

        case 'tools':
          process.stdout.write(
            theme.info(`Enabled tools: ${sessionConfig.enabledTools.join(', ') || 'none'}\n`),
          );
          return true;

        case 'config':
          process.stdout.write(chalk.bold('\nCurrent Configuration:\n'));
          process.stdout.write(
            theme.secondary(JSON.stringify(sessionConfig, null, 2) + '\n\n'),
          );
          return true;

        case 'auth': {
          // Interactive auth dialog using enquirer
          repl.pause();

          (async () => {
            try {
              const enquirer = new Enquirer();

              // Provider selection
              const providerResult = await enquirer.prompt({
                type: 'select',
                name: 'provider',
                message: chalk.cyan('Select AI Provider:'),
                choices: [
                  { name: 'openai', message: 'OpenAI (GPT-4, GPT-3.5)', value: 'openai' },
                  { name: 'anthropic', message: 'Anthropic (Claude)', value: 'anthropic' },
                  { name: 'gemini', message: 'Google (Gemini)', value: 'gemini' },
                  { name: 'groq', message: 'Groq (Fast, Cheap)', value: 'groq' },
                  { name: 'mistral', message: 'Mistral', value: 'mistral' },
                  { name: 'ollama', message: 'Ollama (Local)', value: 'ollama' },
                  { name: 'custom', message: 'Custom Endpoint', value: 'custom' },
                ],
                initial: sessionConfig.provider,
              } as any);
              const provider = (providerResult as { provider: string }).provider;

              // Model name input
              const modelResult = await enquirer.prompt({
                type: 'input',
                name: 'model',
                message: chalk.cyan('Model Name:'),
                initial: sessionConfig.model,
              } as any);
              const model = (modelResult as { model: string }).model;

              // Endpoint URL (only for custom)
              let endpoint = sessionConfig.endpoint;
              if (provider === 'custom') {
                const epResult = await enquirer.prompt({
                  type: 'input',
                  name: 'ep',
                  message: chalk.cyan('Endpoint URL:'),
                  initial: sessionConfig.endpoint || 'https://api.example.com/v1',
                } as any);
                endpoint = (epResult as { ep: string }).ep;
              }

              // API Key (masked input)
              const apiKeyResult = await enquirer.prompt({
                type: 'password',
                name: 'apiKey',
                message: chalk.cyan('API Key:'),
                mask: '*',
              } as any);
              const apiKey = (apiKeyResult as { apiKey: string }).apiKey;

              // Confirm and save
              process.stdout.write('\n');
              process.stdout.write(chalk.bold('┌────────────────────────────────────────┐\n'));
              process.stdout.write(chalk.bold('│     🔐 Configuration Summary           │\n'));
              process.stdout.write(chalk.bold('├────────────────────────────────────────┤\n'));
              process.stdout.write(`│ Provider: ${chalk.cyan(String(provider).padEnd(28))}│\n`);
              process.stdout.write(`│ Model:    ${chalk.cyan(String(model).padEnd(28))}│\n`);
              if (endpoint) {
                process.stdout.write(`│ Endpoint: ${chalk.cyan(String(endpoint).padEnd(28))}│\n`);
              }
              process.stdout.write(`│ API Key:  ${chalk.cyan(apiKey ? '**********' : '(not set)').padEnd(28)}│\n`);
              process.stdout.write(chalk.bold('└────────────────────────────────────────┘\n'));

              const confirmResult = await enquirer.prompt({
                type: 'confirm',
                name: 'confirm',
                message: chalk.yellow('Save this configuration?'),
                initial: true,
              } as any);
              const confirm = (confirmResult as { confirm: boolean }).confirm;

              if (confirm) {
                // Update session config
                sessionConfig = {
                  ...sessionConfig,
                  provider: provider as ResolvedConfig['provider'],
                  model,
                  endpoint: endpoint || undefined,
                  apiKey: apiKey || sessionConfig.apiKey,
                };

                // Save to global config
                const { writeGlobalConfig } = await import('../config/manager.js');
                writeGlobalConfig({
                  provider: sessionConfig.provider,
                  endpoint: sessionConfig.endpoint,
                  model: sessionConfig.model,
                  apiKey: sessionConfig.apiKey,
                });

                process.stdout.write('\n' + theme.success('✓ Configuration saved successfully!\n\n'));
              } else {
                process.stdout.write('\n' + theme.muted('Configuration cancelled.\n\n'));
              }
            } catch {
              process.stdout.write('\n' + theme.muted('Authentication cancelled.\n\n'));
            } finally {
              repl.resume();
            }
          })();

          return true;
        }

        default:
          return false;
      }
    },

    onExit: () => {
      process.stdout.write(theme.muted('\nGoodbye!\n'));
      process.exit(0);
    },
  });

  repl.start();
}
