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

// Gradient colors for the logo
const c1 = chalk.hex('#00D4FF'); // Cyan
const c2 = chalk.hex('#7B61FF'); // Purple
const c3 = chalk.hex('#FF61DC'); // Pink

export const ANYOPENCLI_LOGO = `
${c1('╔══════════════════════════════════════════════════════════════╗')}
${c1('║')}                                                              ${c1('║')}
${c1('║')}   ${c2('███████╗██╗  ██╗██████╗ ███████╗███████╗███████╗██╗    ')}${c3('██╗')}   ${c1('║')}
${c1('║')}   ${c2('██╔════╝██║  ██║██╔══██╗██╔════╝██╔════╝██╔════╝██║    ')}${c3('██║')}   ${c1('║')}
${c1('║')}   ${c2('███████╗███████║██████╔╝█████╗  █████╗  ███████╗██║ ')}${c3('╔██████╗')}  ${c1('║')}
${c1('║')}   ${c2('╚════██║██╔══██║██╔═══╝ ██╔══╝  ██╔══╝  ╚════██║██║ ')}${c3('██╔══██║')}  ${c1('║')}
${c1('║')}   ${c2('███████║██║  ██║██║     ███████╗███████╗███████║╚═╝ ')}${c3('██║  ██║')}  ${c1('║')}
${c1('║')}   ${c2('╚══════╝╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝╚══════╝    ')}${c3('╚═╝')}   ${c1('║')}
${c1('║')}                                                              ${c1('║')}
${c1('╠══════════════════════════════════════════════════════════════╣')}
${c1('║')}   ${chalk.white('Universal AI CLI — Claude Code for any AI provider')}          ${c1('║')}
${c1('╚══════════════════════════════════════════════════════════════╝')}
`.trim();
