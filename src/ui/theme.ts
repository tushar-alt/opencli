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

export const SPECIES_LOGO = `
${chalk.cyan('╔══════════════════════════════════════════════════════════════════╗')}
${chalk.cyan('║')}                                                                  ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.hex('#00D4FF')('███████╗')}${chalk.hex('#7B61FF')('██████╗ ')}${chalk.hex('#FF61DC')('███████╗')}${chalk.hex('#00D4FF')('██╗   ██╗')}${chalk.hex('#7B61FF')('███████╗')} ${chalk.hex('#FF61DC')('██████╗ ')}${chalk.hex('#00D4FF')('███████╗')}   ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.hex('#00D4FF')('██╔════╝')}${chalk.hex('#7B61FF')('██╔══██╗')}${chalk.hex('#FF61DC')('██╔════╝')}${chalk.hex('#00D4FF')('██║   ██║')}${chalk.hex('#7B61FF')('██╔════╝')} ${chalk.hex('#FF61DC')('██╔══██╗')}${chalk.hex('#00D4FF')('██╔════╝')}   ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.hex('#00D4FF')('███████╗')}${chalk.hex('#7B61FF')('██████╔╝')}${chalk.hex('#FF61DC')('█████╗  ')}${chalk.hex('#00D4FF')('██║   ██║')}${chalk.hex('#7B61FF')('█████╗  ')} ${chalk.hex('#FF61DC')('██████╔╝')}${chalk.hex('#00D4FF')('███████╗')}   ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.hex('#00D4FF')('╚════██║')}${chalk.hex('#7B61FF')('██╔═══╝ ')}${chalk.hex('#FF61DC')('██╔══╝  ')}${chalk.hex('#00D4FF')('██║   ██║')}${chalk.hex('#7B61FF')('██╔══╝  ')} ${chalk.hex('#FF61DC')('██╔══██╗')}${chalk.hex('#00D4FF')('╚════██║')}   ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.hex('#00D4FF')('███████║')}${chalk.hex('#7B61FF')('██║    ')}${chalk.hex('#FF61DC')('███████╗')}${chalk.hex('#00D4FF')('╚██████╔╝')}${chalk.hex('#7B61FF')('███████╗')} ${chalk.hex('#FF61DC')('██║  ██║')}${chalk.hex('#00D4FF')('███████║')}   ${chalk.cyan('║')}
${chalk.cyan('║')}   ${chalk.hex('#00D4FF')('╚══════╝')}${chalk.hex('#7B61FF')('╚═╝    ')}${chalk.hex('#FF61DC')('╚══════╝')} ${chalk.hex('#00D4FF')('╚═════╝ ')}${chalk.hex('#7B61FF')('╚══════╝')} ${chalk.hex('#FF61DC')('╚═╝  ╚═╝')}${chalk.hex('#00D4FF')('╚══════╝')}   ${chalk.cyan('║')}
${chalk.cyan('║')}                                                                  ${chalk.cyan('║')}
${chalk.cyan('╠══════════════════════════════════════════════════════════════════╣')}
${chalk.cyan('║')}     ${chalk.white('Universal AI Coding Assistant for Any Provider')}          ${chalk.cyan('║')}
${chalk.cyan('╚══════════════════════════════════════════════════════════════════╝')}
`.trim();
