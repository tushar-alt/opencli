import { execSync } from 'child_process';
import { resolve } from 'path';

export interface SearchContentArgs {
  pattern: string;
  glob?: string;
  cwd?: string;
  case_insensitive?: boolean;
}

const MAX_OUTPUT = 6 * 1024;

export async function searchContentTool(args: SearchContentArgs, cwd: string): Promise<string> {
  // Validate args - some models send malformed tool calls
  if (!args || typeof args.pattern !== 'string') {
    return `Error: search_content requires a "pattern" argument. Received: ${JSON.stringify(args)}`;
  }
  const searchDir = args.cwd ? resolve(cwd, args.cwd) : cwd;

  try {
    // Try ripgrep first, fall back to grep
    const result = tryRipgrep(args, searchDir) ?? tryGrep(args, searchDir);
    if (result === null) {
      return `No matches found for pattern: ${args.pattern}`;
    }
    let output = result;
    if (output.length > MAX_OUTPUT) {
      output = output.slice(0, MAX_OUTPUT) + '\n[Output truncated]';
    }
    return output;
  } catch (err) {
    return `Error searching content: ${String(err)}`;
  }
}

function tryRipgrep(args: SearchContentArgs, dir: string): string | null {
  try {
    const flags = [
      '-n', // line numbers
      '--color=never',
      args.case_insensitive ? '-i' : '',
      args.glob ? `--glob="${args.glob}"` : '',
      '--max-count=50',
      `--glob=!node_modules`,
      `--glob=!.git`,
      `--glob=!dist`,
    ]
      .filter(Boolean)
      .join(' ');

    const cmd = `rg ${flags} "${escapeShellArg(args.pattern)}" "${dir}"`;
    const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return output.trim() || null;
  } catch (err: unknown) {
    // rg exits with 1 when no matches found, not an error
    if (isExecError(err) && err.status === 1) return null;
    // rg not available
    if (isExecError(err) && (err.status === 127 || String(err.message).includes('not found'))) {
      return undefined as unknown as null; // fall through to grep
    }
    return null;
  }
}

function tryGrep(args: SearchContentArgs, dir: string): string | null {
  try {
    const flags = [
      '-rn',
      '--include=' + (args.glob ? args.glob : '*'),
      args.case_insensitive ? '-i' : '',
      '--exclude-dir=node_modules',
      '--exclude-dir=.git',
      '--exclude-dir=dist',
    ]
      .filter(Boolean)
      .join(' ');

    const cmd = `grep ${flags} "${escapeShellArg(args.pattern)}" "${dir}"`;
    const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return output.trim() || null;
  } catch (err: unknown) {
    if (isExecError(err) && err.status === 1) return null;
    return null;
  }
}

function escapeShellArg(arg: string): string {
  return arg.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

interface ExecError {
  status: number;
  message: string;
}

function isExecError(err: unknown): err is ExecError {
  return typeof err === 'object' && err !== null && 'status' in err;
}
