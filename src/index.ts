#!/usr/bin/env node
import { buildCli } from './cli.js';

const program = buildCli();
program.parseAsync(process.argv).catch((err: unknown) => {
  process.stderr.write(`Error: ${String(err)}\n`);
  process.exit(1);
});
