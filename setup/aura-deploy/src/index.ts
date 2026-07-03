import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));

const program = new Command();

program
  .name('aura-deploy')
  .description('Deploy branded AURA CAFE instances for F&B clients')
  .version(pkg.version);

program
  .command('init')
  .description('Start interactive setup wizard for a new client deployment')
  .action(initCommand);

program.parse(process.argv);
