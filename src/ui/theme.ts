import chalk from 'chalk';

export const theme = {
  // Text
  primary: chalk.cyan,
  secondary: chalk.gray,
  muted: chalk.dim,
  bold: chalk.bold,

  // Status
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  info: chalk.blue,

  // Code / tool
  toolName: chalk.magenta.bold,
  toolArg: chalk.magenta,
  thinking: chalk.dim.italic,
  code: chalk.cyan,

  // UI chrome
  prompt: chalk.cyan.bold,
  separator: chalk.dim('─'.repeat(60)),
  logo: chalk.cyan.bold,
};

export const OPENAICLI_LOGO = `
   ____                   __   ________    _  __
  / __ \____  ___  ____  / /  / ____/ /   | |/ /
 / / / / __ \/ _ \/ __ \/ /  / /   / /    |   /
/ /_/ / /_/ /  __/ / / / /  / /___/ /___ /   |
\____/ .___/\___/_/ /_/_/   \____/_____//_/|_|
    /_/
`.trim();
