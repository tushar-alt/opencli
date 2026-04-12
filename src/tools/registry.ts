import type { ResolvedConfig } from '../config/types.js';
import type { ToolDefinition } from '../providers/types.js';
import { getToolDefinitions } from './definitions.js';
import { readFileTool } from './read-file.js';
import { writeFileTool } from './write-file.js';
import { editFileTool } from './edit-file.js';
import { shellTool } from './shell.js';
import { searchFilesTool } from './search-files.js';
import { searchContentTool } from './search-content.js';

type ToolHandler = (args: Record<string, unknown>, config: ResolvedConfig, cwd: string) => Promise<string>;

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  read_file: (args, _config, cwd) =>
    readFileTool(args as unknown as Parameters<typeof readFileTool>[0], cwd),

  write_file: (args, _config, cwd) =>
    writeFileTool(args as unknown as Parameters<typeof writeFileTool>[0], cwd),

  edit_file: (args, _config, cwd) =>
    editFileTool(args as unknown as Parameters<typeof editFileTool>[0], cwd),

  shell: (args, config, cwd) =>
    shellTool(args as unknown as Parameters<typeof shellTool>[0], cwd, config.autoConfirm),

  search_files: (args, _config, cwd) =>
    searchFilesTool(args as unknown as Parameters<typeof searchFilesTool>[0], cwd),

  search_content: (args, _config, cwd) =>
    searchContentTool(args as unknown as Parameters<typeof searchContentTool>[0], cwd),
};

export function getEnabledDefinitions(config: ResolvedConfig): ToolDefinition[] {
  return getToolDefinitions(config.enabledTools);
}

export async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  config: ResolvedConfig,
  cwd: string,
): Promise<string> {
  const handler = TOOL_HANDLERS[name];
  if (!handler) {
    return `Error: Unknown tool "${name}"`;
  }
  try {
    return await handler(args, config, cwd);
  } catch (err) {
    return `Tool "${name}" threw an error: ${String(err)}`;
  }
}
