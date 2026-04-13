import { globSync } from 'fs';
import { resolve } from 'path';

export interface SearchFilesArgs {
  pattern: string;
  cwd?: string;
}

const MAX_RESULTS = 100;

export async function searchFilesTool(args: SearchFilesArgs, cwd: string): Promise<string> {
  // Validate args - some models send malformed tool calls
  if (!args || typeof args.pattern !== 'string') {
    return `Error: search_files requires a "pattern" argument. Received: ${JSON.stringify(args)}`;
  }
  const searchDir = args.cwd ? resolve(cwd, args.cwd) : cwd;

  try {
    const matches = globSync(args.pattern, {
      cwd: searchDir,
      // @ts-expect-error glob types are inconsistent
      ignore: ['node_modules/**', '.git/**', 'dist/**', '.next/**', '__pycache__/**'],
    }) as string[];

    if (matches.length === 0) {
      return `No files found matching pattern: ${args.pattern}`;
    }

    const sorted = matches.sort();
    const truncated = sorted.length > MAX_RESULTS;
    const display = truncated ? sorted.slice(0, MAX_RESULTS) : sorted;

    const lines = display.map((f) => `  ${f}`).join('\n');
    return [
      `Found ${matches.length} file(s) matching "${args.pattern}" in ${searchDir}:`,
      lines,
      truncated ? `\n[Showing first ${MAX_RESULTS} of ${matches.length} results]` : '',
    ]
      .filter(Boolean)
      .join('\n');
  } catch (err) {
    return `Error searching files: ${String(err)}`;
  }
}
