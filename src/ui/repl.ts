import { createInterface, type Interface, emitKeypressEvents } from 'readline';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import chalk from 'chalk';
import { theme } from './theme.js';
import { getHistoryFile } from '../config/manager.js';

const COMMANDS = [
  { name: 'help', description: 'Show help' },
  { name: 'auth', description: 'Setup authentication' },
  { name: 'clear', description: 'Clear conversation' },
  { name: 'history', description: 'Show history' },
  { name: 'model', description: 'Switch model' },
  { name: 'provider', description: 'Switch provider' },
  { name: 'think', description: 'Toggle thinking mode' },
  { name: 'tools', description: 'List tools' },
  { name: 'config', description: 'Show config' },
  { name: 'exit', description: 'Exit' },
];

export type InputHandler = (input: string) => Promise<void>;

export interface ReplOptions {
  onInput: InputHandler;
  onCommand: (cmd: string, args: string) => Promise<boolean>;
  onExit: () => void;
}

export class AnyOpenCliRepl {
  private rl: Interface;
  private multilineBuffer: string[] = [];
  private inMultiline = false;
  private options: ReplOptions;
  private selectingCommand = false;

  constructor(options: ReplOptions) {
    this.options = options;

    const historyFile = getHistoryFile();
    const historyDir = dirname(historyFile);
    if (!existsSync(historyDir)) {
      mkdirSync(historyDir, { recursive: true });
    }

    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      historySize: 500,
    });

    try {
      (this.rl as unknown as { history: string[] }).history = [];
    } catch {
      // ignore
    }

    // Enable keypress events for detecting '/' immediately
    emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
  }

  start(): void {
    this.prompt();
    
    // Listen for keypress to detect '/' and show menu immediately
    process.stdin.on('keypress', (str: string, key: { name?: string; sequence?: string; ctrl?: boolean }) => {
      // Skip if we're already in a menu or multiline mode
      if (this.selectingCommand || this.inMultiline) return;
      
      // Check if user typed '/' and we're at an empty prompt
      if (str === '/' && this.rl.line === '') {
        // Clear the '/' that was printed and show menu
        process.stdout.write('\b \b'); // Erase the '/' character
        void this.showCommandMenu().then((selected) => {
          if (selected) {
            void this.executeCommand(selected, '');
          } else {
            this.prompt();
          }
        });
      }
    });
    
    this.rl.on('line', (line) => void this.handleLine(line));
    this.rl.on('close', () => this.options.onExit());
    process.on('SIGINT', () => {
      if (this.selectingCommand) {
        this.selectingCommand = false;
        process.stdout.write('\n');
        this.prompt();
      } else {
        process.stdout.write('\n' + theme.muted('(Use /exit or Ctrl+D to quit)\n'));
        this.prompt();
      }
    });
  }

  private prompt(): void {
    if (this.inMultiline) {
      this.rl.setPrompt(theme.secondary('... '));
    } else {
      this.rl.setPrompt(theme.prompt('you> '));
    }
    this.rl.prompt();
  }

  private async showCommandMenu(): Promise<string | null> {
    this.selectingCommand = true;
    this.rl.pause();

    let selectedIndex = 0;
    const renderMenu = () => {
      // Clear current line and show menu
      process.stdout.write('\n\x1b[2K\r'); // Clear to end of line
      process.stdout.write(chalk.bold('\nSelect command (use ↑↓ arrows, Enter to select, Esc to cancel):\n\n'));
      
      COMMANDS.forEach((cmd, index) => {
        const isSelected = index === selectedIndex;
        const pointer = isSelected ? chalk.cyan('>') : ' ';
        const name = isSelected ? chalk.cyan.bold(`/${cmd.name}`) : chalk.cyan(`/${cmd.name}`);
        const desc = chalk.gray(cmd.description);
        process.stdout.write(`  ${pointer} ${name.padEnd(15)} ${desc}\n`);
      });
      process.stdout.write('\n');
    };

    renderMenu();

    return new Promise((resolve) => {
      const stdin = process.stdin;
      
      const cleanup = () => {
        stdin.removeAllListeners('keypress');
      };

      const onKeypress = (str: string, key: { name?: string; sequence?: string; ctrl?: boolean }) => {
        // Escape, Ctrl+C, or q to cancel
        if (key.name === 'escape' || key.name === 'q' || (key.ctrl && key.name === 'c')) {
          cleanup();
          this.selectingCommand = false;
          process.stdout.write('\nCancelled\n\n');
          this.rl.resume();
          resolve(null);
          return;
        }

        // Enter to select
        if (key.name === 'return' || key.name === 'enter') {
          cleanup();
          this.selectingCommand = false;
          process.stdout.write('\n');
          this.rl.resume();
          resolve(COMMANDS[selectedIndex]?.name ?? null);
          return;
        }

        // Arrow keys
        if (key.name === 'up') {
          selectedIndex = (selectedIndex - 1 + COMMANDS.length) % COMMANDS.length;
          renderMenu();
        } else if (key.name === 'down') {
          selectedIndex = (selectedIndex + 1) % COMMANDS.length;
          renderMenu();
        }
      };

      stdin.on('keypress', onKeypress);
    });
  }

  private async handleLine(line: string): Promise<void> {
    const trimmed = line.trim();

    // Show interactive command menu when user types just "/"
    if (trimmed === '/') {
      const selected = await this.showCommandMenu();
      if (selected) {
        await this.executeCommand(selected, '');
      } else {
        this.prompt();
      }
      return;
    }

    // Multi-line continuation
    if (line.endsWith('\\')) {
      this.inMultiline = true;
      this.multilineBuffer.push(line.slice(0, -1));
      this.prompt();
      return;
    }

    let input: string;
    if (this.inMultiline) {
      this.multilineBuffer.push(line);
      input = this.multilineBuffer.join('\n');
      this.multilineBuffer = [];
      this.inMultiline = false;
    } else {
      input = line;
    }

    input = input.trim();
    if (!input) {
      this.prompt();
      return;
    }

    // Handle slash commands
    if (input.startsWith('/')) {
      const [cmd, ...rest] = input.slice(1).split(' ');
      await this.executeCommand(cmd ?? '', rest.join(' '));
      return;
    }

    // Regular input
    try {
      await this.options.onInput(input);
    } catch (err) {
      process.stdout.write(theme.error(`\nError: ${String(err)}\n`));
    }

    this.prompt();
  }

  private async executeCommand(cmd: string, args: string): Promise<void> {
    const handled = await this.options.onCommand(cmd, args);
    if (!handled) {
      process.stdout.write(theme.error(`Unknown command: /${cmd}\n`));
      process.stdout.write(theme.muted('Type / and press Enter for command menu\n'));
    }
    this.prompt();
  }

  close(): void {
    this.rl.close();
  }

  pause(): void {
    this.rl.pause();
  }

  resume(): void {
    this.rl.resume();
  }
}

export function printHelp(): void {
  const commands = [
    ['/help', 'Show this help'],
    ['/auth', 'Interactive authentication setup'],
    ['/clear', 'Clear conversation history'],
    ['/history', 'Show conversation turns'],
    ['/model <name>', 'Switch model'],
    ['/provider <name>', 'Switch provider'],
    ['/think', 'Toggle thinking mode'],
    ['/tools', 'List enabled tools'],
    ['/config', 'Show configuration'],
    ['/exit', 'Exit AnyOpenCLI'],
  ];

  process.stdout.write(chalk.bold.cyan('\nAnyOpenCLI Commands:\n'));
  process.stdout.write(chalk.dim('Type / and press Enter for interactive menu\n\n'));
  for (const [cmd, desc] of commands) {
    process.stdout.write(
      `  ${chalk.cyan(String(cmd).padEnd(18))} ${chalk.gray(String(desc))}\n`,
    );
  }
  process.stdout.write('\n');
}
