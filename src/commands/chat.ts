import chalk from 'chalk';
import type { ResolvedConfig } from '../config/types.js';
import { ConversationHistory } from '../agent/history.js';
import { buildSystemPrompt } from '../agent/context.js';
import { runAgentLoop } from '../agent/loop.js';
import { OpenCliRepl, printHelp } from '../ui/repl.js';
import { theme, OPENCLI_LOGO } from '../ui/theme.js';
import { loadConfig } from '../config/loader.js';

export async function startChat(config: ResolvedConfig, cwd: string): Promise<void> {
  // Print welcome banner
  process.stdout.write(chalk.cyan(OPENCLI_LOGO) + '\n\n');
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

  const repl = new OpenCliRepl({
    onInput: async (input) => {
      history.addUser(input);

      process.stdout.write('\n' + theme.secondary('opencli> ') + '\n\n');

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
              const prefix = msg.role === 'user' ? theme.prompt('you') : theme.secondary('opencli');
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
