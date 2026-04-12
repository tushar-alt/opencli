import type { ToolDefinition } from '../providers/types.js';

export const ALL_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'read_file',
    description:
      'Read the contents of a file. Returns the file content as a string. Use this to inspect existing code before editing it.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or relative path to the file to read.',
        },
        start_line: {
          type: 'number',
          description: 'Optional: 1-based line number to start reading from.',
        },
        end_line: {
          type: 'number',
          description: 'Optional: 1-based line number to stop reading at (inclusive).',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description:
      'Write content to a file, creating it if it does not exist or overwriting it if it does. Use this to create new files or completely replace file content.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or relative path to write the file to.',
        },
        content: {
          type: 'string',
          description: 'The full content to write to the file.',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description:
      'Edit a file by replacing an exact string with a new string. Use this for targeted edits without rewriting the whole file. The old_string must match exactly (including whitespace and indentation).',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or relative path to the file to edit.',
        },
        old_string: {
          type: 'string',
          description: 'The exact string to find and replace. Must be unique in the file.',
        },
        new_string: {
          type: 'string',
          description: 'The string to replace old_string with.',
        },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'shell',
    description:
      'Execute a shell command and return its output. Use for running tests, installing packages, git operations, building projects, etc. Will prompt user for confirmation unless auto-confirm is enabled.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute.',
        },
        cwd: {
          type: 'string',
          description: 'Optional: working directory to run the command in. Defaults to current directory.',
        },
        timeout: {
          type: 'number',
          description: 'Optional: timeout in milliseconds. Defaults to 30000 (30 seconds).',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'search_files',
    description:
      'Search for files by name pattern (glob). Use to find files in the project without knowing their exact location.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern to match file names (e.g., "**/*.ts", "src/**/*.test.js").',
        },
        cwd: {
          type: 'string',
          description: 'Optional: directory to search in. Defaults to current directory.',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'search_content',
    description:
      'Search for text content across files using regex. Use to find where a function/variable/pattern is used.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Regular expression pattern to search for.',
        },
        glob: {
          type: 'string',
          description: 'Optional: glob filter for which files to search (e.g., "*.ts").',
        },
        cwd: {
          type: 'string',
          description: 'Optional: directory to search in. Defaults to current directory.',
        },
        case_insensitive: {
          type: 'boolean',
          description: 'Optional: whether to search case-insensitively. Defaults to false.',
        },
      },
      required: ['pattern'],
    },
  },
];

export function getToolDefinitions(enabledToolNames: string[]): ToolDefinition[] {
  if (enabledToolNames.length === 0) return [];
  return ALL_TOOL_DEFINITIONS.filter((t) => enabledToolNames.includes(t.name));
}
