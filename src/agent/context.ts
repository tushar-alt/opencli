import { execSync } from 'child_process';
import { readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';
import type { ResolvedConfig } from '../config/types.js';

const BASE_SYSTEM_PROMPT = `You are AnyOpenCLI, an expert AI coding assistant running in the terminal.

You help users with software engineering tasks: writing code, debugging, refactoring, explaining code, running commands, managing files, and anything else they need in their project.

## Capabilities
- Read, write, and edit files in the project
- Execute shell commands (with user confirmation)
- Search for files and code patterns
- Generate, explain, and review code

## Behavior Guidelines
- Always read files before editing them to understand the current content
- Prefer targeted edits (edit_file) over full rewrites (write_file) for existing files
- Run tests or build commands after making changes to verify they work
- Be direct and concise. Show code, not just descriptions.
- When writing code, follow the conventions already present in the project
- Think step by step for complex tasks, but don't over-explain simple ones
- If you are uncertain about something, say so rather than guessing
`;

const MAX_CONTEXT_CHARS = 8000;

export function buildSystemPrompt(config: ResolvedConfig, cwd: string): string {
  const parts: string[] = [BASE_SYSTEM_PROMPT];

  if (config.systemPrompt) {
    parts.push(`\n## Project-Specific Instructions\n${config.systemPrompt}`);
  }

  // Add git context
  const gitContext = getGitContext(cwd);
  if (gitContext) {
    parts.push(`\n## Git Status\n\`\`\`\n${gitContext}\`\`\``);
  }

  // Add directory structure
  const dirTree = getDirectoryTree(cwd);
  if (dirTree) {
    parts.push(`\n## Project Structure\n\`\`\`\n${dirTree}\`\`\``);
  }

  // Add current working directory
  parts.push(`\n## Current Directory\n${cwd}`);

  // Combine and truncate
  let combined = parts.join('\n');
  if (combined.length > MAX_CONTEXT_CHARS) {
    combined = combined.slice(0, MAX_CONTEXT_CHARS) + '\n[Context truncated]';
  }

  return combined;
}

function getGitContext(cwd: string): string | null {
  if (!existsSync(join(cwd, '.git')) && !isInsideGitRepo(cwd)) return null;

  try {
    const status = execSync('git status --short', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 3000,
    }).trim();

    const log = execSync('git log --oneline -8', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 3000,
    }).trim();

    const branch = execSync('git branch --show-current', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 3000,
    }).trim();

    const parts: string[] = [];
    if (branch) parts.push(`Branch: ${branch}`);
    if (status) parts.push(`\nChanges:\n${status}`);
    if (log) parts.push(`\nRecent commits:\n${log}`);
    return parts.join('\n');
  } catch {
    return null;
  }
}

function isInsideGitRepo(cwd: string): boolean {
  try {
    execSync('git rev-parse --git-dir', {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 2000,
    });
    return true;
  } catch {
    return false;
  }
}

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', '.next', '__pycache__',
  '.cache', 'coverage', '.nyc_output', 'build', '.turbo',
  'vendor', '.venv', 'venv', '.env',
]);

const MAX_DIR_ENTRIES = 80;

function getDirectoryTree(cwd: string): string | null {
  try {
    const lines: string[] = [];
    walkDir(cwd, cwd, '', lines, 0, 2);
    if (lines.length === 0) return null;
    return lines.slice(0, MAX_DIR_ENTRIES).join('\n');
  } catch {
    return null;
  }
}

function walkDir(
  root: string,
  dir: string,
  indent: string,
  lines: string[],
  depth: number,
  maxDepth: number,
): void {
  if (depth > maxDepth) return;
  if (lines.length >= MAX_DIR_ENTRIES) return;

  let entries: string[];
  try {
    entries = readdirSync(dir).filter((e) => !e.startsWith('.') || e === '.anyopencli.json');
  } catch {
    return;
  }

  for (const entry of entries) {
    if (lines.length >= MAX_DIR_ENTRIES) break;
    if (IGNORE_DIRS.has(entry)) continue;

    const full = join(dir, entry);
    const rel = relative(root, full);

    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }

    lines.push(`${indent}${isDir ? '📁 ' : ''}${rel}${isDir ? '/' : ''}`);
    if (isDir) {
      walkDir(root, full, indent + '  ', lines, depth + 1, maxDepth);
    }
  }
}
