import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface EditFileArgs {
  path: string;
  old_string: string;
  new_string: string;
}

export async function editFileTool(args: EditFileArgs, cwd: string): Promise<string> {
  // Validate args - some models send malformed tool calls
  if (!args || typeof args.path !== 'string') {
    return `Error: edit_file requires a "path" argument. Received: ${JSON.stringify(args)}`;
  }
  if (typeof args.old_string !== 'string') {
    return `Error: edit_file requires an "old_string" argument. Received: ${JSON.stringify(args)}`;
  }
  if (typeof args.new_string !== 'string') {
    return `Error: edit_file requires a "new_string" argument. Received: ${JSON.stringify(args)}`;
  }
  const filePath = resolve(cwd, args.path);

  if (!existsSync(filePath)) {
    return `Error: File not found: ${filePath}`;
  }

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (err) {
    return `Error reading file: ${String(err)}`;
  }

  // Count exact occurrences
  const occurrences = countOccurrences(content, args.old_string);

  if (occurrences === 0) {
    // Try whitespace-normalized match as a fallback hint
    const hint = tryFuzzyHint(content, args.old_string);
    return [
      `Error: old_string not found in ${filePath}`,
      hint ? `\nHint: ${hint}` : '',
      '\nMake sure old_string exactly matches the file content including whitespace and indentation.',
    ].join('');
  }

  if (occurrences > 1) {
    return `Error: old_string found ${occurrences} times in ${filePath}. Make old_string more specific to uniquely identify the target.`;
  }

  const newContent = content.replace(args.old_string, args.new_string);

  try {
    writeFileSync(filePath, newContent, 'utf-8');
  } catch (err) {
    return `Error writing file: ${String(err)}`;
  }

  const oldLines = args.old_string.split('\n').length;
  const newLines = args.new_string.split('\n').length;
  const diff = newLines - oldLines;
  const diffStr = diff === 0 ? 'same line count' : diff > 0 ? `+${diff} lines` : `${diff} lines`;

  return `Edited ${filePath}: replaced ${oldLines}-line block (${diffStr})`;
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}

function tryFuzzyHint(content: string, target: string): string | null {
  // Check if trimming each line of the target finds a match
  const normalizedTarget = target
    .split('\n')
    .map((l) => l.trim())
    .join('\n');
  const normalizedContent = content
    .split('\n')
    .map((l) => l.trim())
    .join('\n');

  if (normalizedContent.includes(normalizedTarget)) {
    return 'The content exists but with different indentation. Match the exact whitespace.';
  }
  return null;
}
