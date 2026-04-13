import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';

export interface WriteFileArgs {
  path: string;
  content: string;
}

export async function writeFileTool(args: WriteFileArgs, cwd: string): Promise<string> {
  // Validate args - some models send malformed tool calls
  if (!args || typeof args.path !== 'string') {
    return `Error: write_file requires a "path" argument. Received: ${JSON.stringify(args)}`;
  }
  if (typeof args.content !== 'string') {
    return `Error: write_file requires a "content" argument. Received: ${JSON.stringify(args)}`;
  }
  const filePath = resolve(cwd, args.path);
  const dir = dirname(filePath);
  const isNew = !existsSync(filePath);

  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, args.content, 'utf-8');
    const lineCount = args.content.split('\n').length;
    return `${isNew ? 'Created' : 'Wrote'} ${filePath} (${lineCount} lines, ${args.content.length} bytes)`;
  } catch (err) {
    return `Error writing file: ${String(err)}`;
  }
}
