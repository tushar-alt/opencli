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
          // Interactive auth setup
          process.stdout.write(chalk.bold.cyan('\n🔐 Authentication Setup\n'));
          process.stdout.write(theme.muted('Press Enter to keep current values.\n\n'));
          
          const rl = createInterface({ input: process.stdin, output: process.stdout });
          
          // Helper to prompt
          const prompt = (q: string, current: string): Promise<string> => {
            return new Promise((resolve) => {
              const hint = current ? theme.muted(` [${current}]`) : '';
              process.stdout.write(`${q}${hint}: `);
              rl.once('line', (line) => {
                resolve(line.trim() || current);
              });
            });
          };

          // Run prompts sequentially
          (async () => {
            try {
              const provider = await prompt('Provider (openai/anthropic/gemini/groq/mistral/ollama/custom)', sessionConfig.provider);
              const endpoint = await prompt('Endpoint URL (leave empty for default)', sessionConfig.endpoint || '');
              const model = await prompt('Model name', sessionConfig.model);
              const apiKey = await prompt('API Key', sessionConfig.apiKey ? '***' : '');

              // Update session config
              sessionConfig = {
                ...sessionConfig,
                provider: provider as ResolvedConfig['provider'],
                model,
              };
              if (endpoint) sessionConfig.endpoint = endpoint;
              if (apiKey && apiKey !== '***') sessionConfig.apiKey = apiKey;

              // Also save to global config
              const { writeGlobalConfig } = await import('../config/manager.js');
              writeGlobalConfig({
                provider: sessionConfig.provider,
                endpoint: sessionConfig.endpoint,
                model: sessionConfig.model,
                apiKey: sessionConfig.apiKey,
              });

              process.stdout.write('\n' + theme.success('✓ Authentication saved!\n'));
              process.stdout.write(theme.info(`Provider: ${sessionConfig.provider}\n`));
              process.stdout.write(theme.info(`Model: ${sessionConfig.model}\n`));
              if (sessionConfig.endpoint) {
                process.stdout.write(theme.info(`Endpoint: ${sessionConfig.endpoint}\n`));
              }
            } catch (err) {
              process.stdout.write(theme.error(`Error: ${String(err)}\n`));
            } finally {
              rl.close();
              repl.resume();
            }
          })();

          repl.pause();
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
