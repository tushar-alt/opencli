import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface ReadFileArgs {
  path: string;
  start_line?: number;
  end_line?: number;
}

const MAX_FILE_SIZE = 200 * 1024; // 200KB
const MAX_LINES = 500;

export async function readFileTool(args: ReadFileArgs, cwd: string): Promise<string> {
  const filePath = resolve(cwd, args.path);

  if (!existsSync(filePath)) {
    return `Error: File not found: ${filePath}`;
  }

  let content: string;
  try {
    const buf = readFileSync(filePath);
    if (buf.length > MAX_FILE_SIZE) {
      content = buf.toString('utf-8', 0, MAX_FILE_SIZE);
      content += `\n\n[File truncated at ${MAX_FILE_SIZE} bytes — ${buf.length} total]`;
    } else {
      content = buf.toString('utf-8');
    }
  } catch (err) {
    return `Error reading file: ${String(err)}`;
  }

  const lines = content.split('\n');

  const startLine = args.start_line ? Math.max(1, args.start_line) : 1;
  const endLine = args.end_line ? Math.min(lines.length, args.end_line) : lines.length;

  const slice = lines.slice(startLine - 1, endLine);

  // Add line numbers
  const numbered = slice
    .map((line, i) => `${String(startLine + i).padStart(4, ' ')} | ${line}`)
    .join('\n');

  const truncated = slice.length > MAX_LINES;
  const header = `File: ${filePath} (lines ${startLine}–${Math.min(endLine, startLine + slice.length - 1)} of ${lines.length})`;

  return truncated
    ? `${header}\n\n${numbered}\n\n[Output truncated at ${MAX_LINES} lines]`
    : `${header}\n\n${numbered}`;
}
