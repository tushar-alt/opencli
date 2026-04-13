import chalk from 'chalk';
import { createInterface } from 'readline';
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
          // Simple interactive auth setup
          repl.pause();
          
          // Remove all existing listeners to prevent key duplication
          process.stdin.removeAllListeners('keypress');
          process.stdin.removeAllListeners('data');
          
          const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const ask = (question: string, defaultValue?: string): Promise<string> => {
            return new Promise((resolve) => {
              const def = defaultValue ? theme.muted(` (${defaultValue})`) : '';
              rl.question(`${chalk.cyan('?')} ${question}${def}: `, (answer) => {
                resolve(answer.trim() || defaultValue || '');
              });
            });
          };

          const askPassword = (question: string): Promise<string> => {
            return new Promise((resolve) => {
              process.stdout.write(`${chalk.cyan('?')} ${question}: `);
              
              // Hide input
              const stdin = process.stdin;
              const oldRawMode = stdin.isRaw;
              if (stdin.isTTY) {
                stdin.setRawMode(true);
              }
              
              let password = '';
              const onData = (data: Buffer) => {
                const char = data.toString();
                const code = char.charCodeAt(0);
                
                if (code === 13) { // Enter
                  stdin.removeListener('data', onData);
                  if (stdin.isTTY) {
                    stdin.setRawMode(oldRawMode || false);
                  }
                  process.stdout.write('\n');
                  resolve(password);
                } else if (code === 3) { // Ctrl+C
                  stdin.removeListener('data', onData);
                  if (stdin.isTTY) {
                    stdin.setRawMode(oldRawMode || false);
                  }
                  process.stdout.write('\n');
                  resolve('');
                } else if (code === 127) { // Backspace
                  password = password.slice(0, -1);
                  process.stdout.write('\b \b');
                } else if (code >= 32 && code <= 126) {
                  password += char;
                  process.stdout.write('*');
                }
              };
              
              stdin.on('data', onData);
            });
          };

          (async () => {
            try {
              process.stdout.write('\n' + chalk.bold('┌────────────────────────────────────────┐\n'));
              process.stdout.write(chalk.bold('│     🔐 Authentication Setup            │\n'));
              process.stdout.write(chalk.bold('└────────────────────────────────────────┘\n\n'));

              // Show provider options
              process.stdout.write(chalk.bold('Available providers:\n'));
              const providers = ['openai', 'anthropic', 'gemini', 'groq', 'mistral', 'ollama', 'custom'];
              providers.forEach((p, i) => {
                process.stdout.write(`  ${i + 1}. ${p}\n`);
              });
              process.stdout.write('\n');

              const provider = await ask('Select provider', sessionConfig.provider);
              const model = await ask('Model name', sessionConfig.model);
              
              let endpoint = sessionConfig.endpoint;
              if (provider === 'custom') {
                endpoint = await ask('Endpoint URL', sessionConfig.endpoint || 'https://api.example.com/v1');
              }
              
              const apiKey = await askPassword('API Key');

              // Show summary
              process.stdout.write('\n');
              process.stdout.write(chalk.bold('┌────────────────────────────────────────┐\n'));
              process.stdout.write(chalk.bold('│     🔐 Configuration Summary           │\n'));
              process.stdout.write(chalk.bold('├────────────────────────────────────────┤\n'));
              process.stdout.write(`│ Provider: ${chalk.cyan(provider.padEnd(28))}│\n`);
              process.stdout.write(`│ Model:    ${chalk.cyan(model.padEnd(28))}│\n`);
              if (endpoint) {
                process.stdout.write(`│ Endpoint: ${chalk.cyan(endpoint.padEnd(28))}│\n`);
              }
              process.stdout.write(`│ API Key:  ${chalk.cyan(apiKey ? '**********' : '(not set)').padEnd(28)}│\n`);
              process.stdout.write(chalk.bold('└────────────────────────────────────────┘\n\n'));

              const confirm = await ask('Save this configuration? (y/n)', 'y');

              if (confirm.toLowerCase() === 'y') {
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
            } catch (err) {
              process.stdout.write('\n' + theme.error(`Error: ${String(err)}\n\n`));
            } finally {
              rl.close();
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
