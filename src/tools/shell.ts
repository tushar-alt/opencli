import { createInterface } from 'readline';
import { execa } from 'execa';
import chalk from 'chalk';

export interface ShellArgs {
  command: string;
  cwd?: string;
  timeout?: number;
}

const MAX_OUTPUT_SIZE = 8 * 1024; // 8KB

export async function shellTool(
  args: ShellArgs,
  cwd: string,
  autoConfirm: boolean,
): Promise<string> {
  // Validate args - some models send malformed tool calls
  if (!args || typeof args.command !== 'string') {
    return `Error: shell requires a "command" argument. Received: ${JSON.stringify(args)}`;
  }
  const workDir = args.cwd ? args.cwd : cwd;
  const timeout = args.timeout ?? 30_000;

  // Ask for confirmation unless auto-confirm
  if (!autoConfirm) {
    const confirmed = await promptConfirm(args.command);
    if (!confirmed) {
      return 'Command cancelled by user.';
    }
  } else {
    process.stderr.write(chalk.yellow(`$ ${args.command}\n`));
  }

  try {
    const result = await execa({ shell: true, cwd: workDir, timeout })`${args.command}`;
    const output = combineOutput(result.stdout, result.stderr);
    return formatOutput(output, result.exitCode ?? 0);
  } catch (err: unknown) {
    if (isExecaError(err)) {
      const output = combineOutput(err.stdout ?? '', err.stderr ?? '');
      return formatOutput(output, err.exitCode ?? 1, String(err.message));
    }
    return `Error executing command: ${String(err)}`;
  }
}

async function promptConfirm(command: string): Promise<boolean> {
  process.stdout.write(chalk.yellow(`\nRun command: `) + chalk.bold(command) + '\n');
  process.stdout.write(chalk.dim('Confirm? [y/N] '));

  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    // Temporarily resume stdin
    process.stdin.resume();
    rl.once('line', (line) => {
      rl.close();
      resolve(line.trim().toLowerCase() === 'y');
    });
  });
}

function combineOutput(stdout: string, stderr: string): string {
  const parts: string[] = [];
  if (stdout.trim()) parts.push(stdout);
  if (stderr.trim()) parts.push(`[stderr]\n${stderr}`);
  return parts.join('\n');
}

function formatOutput(output: string, exitCode: number, errorMsg?: string): string {
  let result = output;
  if (result.length > MAX_OUTPUT_SIZE) {
    result = result.slice(0, MAX_OUTPUT_SIZE) + `\n[Output truncated at ${MAX_OUTPUT_SIZE} bytes]`;
  }
  const status = exitCode === 0 ? 'success' : `exit code ${exitCode}`;
  const parts = [`[${status}]`];
  if (result.trim()) parts.push(result);
  if (errorMsg && exitCode !== 0) parts.push(`Error: ${errorMsg}`);
  return parts.join('\n');
}

interface ExecaError {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  message: string;
}

function isExecaError(err: unknown): err is ExecaError {
  return typeof err === 'object' && err !== null && 'message' in err;
}
