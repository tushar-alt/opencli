import { createInterface, type Interface } from 'readline';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import chalk from 'chalk';
import { theme } from './theme.js';
import { getHistoryFile } from '../config/manager.js';

export type InputHandler = (input: string) => Promise<void>;

export interface ReplOptions {
  onInput: InputHandler;
  onCommand: (cmd: string, args: string) => Promise<boolean>; // returns true if handled
  onExit: () => void;
}

export class AnyOpenCliRepl {
  private rl: Interface;
  private multilineBuffer: string[] = [];
  private inMultiline = false;
  private options: ReplOptions;

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

    // Enable history file persistence
    try {
      (this.rl as unknown as { history: string[] }).history = [];
    } catch {
      // ignore
    }
  }

  start(): void {
    this.prompt();
    this.rl.on('line', (line) => void this.handleLine(line));
    this.rl.on('close', () => this.options.onExit());
    process.on('SIGINT', () => {
      process.stdout.write('\n' + theme.muted('(Use /exit or Ctrl+D to quit)\n'));
      this.prompt();
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

  private async handleLine(line: string): Promise<void> {
    // Multi-line continuation: line ends with backslash
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
      const cmdName = cmd ?? '';
      const args = rest.join(' ');
      const handled = await this.options.onCommand(cmdName, args);
      if (!handled) {
        process.stdout.write(theme.error(`Unknown command: /${cmdName}\n`));
        process.stdout.write(theme.muted('Type /help for available commands\n'));
      }
      this.prompt();
      return;
    }

    // Regular input — delegate to handler
    try {
      await this.options.onInput(input);
    } catch (err) {
      process.stdout.write(theme.error(`\nError: ${String(err)}\n`));
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
    ['/clear', 'Clear conversation history'],
    ['/history', 'Show conversation turns'],
    ['/model <name>', 'Switch model for this session'],
    ['/provider <name>', 'Switch provider for this session'],
    ['/think', 'Toggle thinking mode'],
    ['/tools', 'List enabled tools'],
    ['/config', 'Show current configuration'],
    ['/exit', 'Exit AnyOpenCLI'],
  ];

  process.stdout.write(chalk.bold.cyan('\nAnyOpenCLI Commands:\n'));
  for (const [cmd, desc] of commands) {
    process.stdout.write(
      `  ${chalk.cyan(String(cmd).padEnd(20))} ${chalk.gray(String(desc))}\n`,
    );
  }
  process.stdout.write('\n');
}
