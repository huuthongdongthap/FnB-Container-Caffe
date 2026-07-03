import chalk from 'chalk';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { getQuestions } from '../wizard/questions.js';
import { generateConfig } from '../template/index.js';
import type { WizardAnswers } from '../template/index.js';

export async function initCommand(): Promise<void> {
  const questions = getQuestions();
  const answers: Record<string, string> = {};

  console.log(chalk.bold.cyan('\n  AURA CAFE - Setup Wizard\n'));

  const rl = readline.createInterface({ input, output });

  // ------------------------------------------------------------------
  // Phase 1: ask every question with inline validation and transform
  // ------------------------------------------------------------------
  for (const q of questions) {
    let prompt = chalk.yellow(`? ${q.message}`);
    if (q.default && q.default.length > 0) {
      prompt += chalk.gray(` (${q.default})`);
    }
    prompt += ': ';

    let valid = false;
    while (!valid) {
      let raw: string;
      try {
        raw = (await rl.question(prompt)).trim();
      } catch {
        // Handle Ctrl+C gracefully
        console.log(chalk.red('\n  Setup cancelled.'));
        rl.close();
        process.exit(0);
      }

      // Apply value (use default when input is empty)
      let value = raw.length > 0 ? raw : (q.default ?? '');

      // Apply transform hook (e.g. auto-suggest for domainSlug)
      if (q.transform) {
        const transformed = q.transform(value, answers);
        if (transformed !== value && value.length > 0) {
          console.log(chalk.gray(`  -> ${transformed}`));
        }
        value = transformed;
      }

      const error = q.validate(value);
      if (error) {
        console.log(chalk.red(`  ${error}`));
        continue;
      }

      answers[q.name] = value;
      valid = true;
    }
  }

  rl.close();

  // ------------------------------------------------------------------
  // Phase 2: print summary
  // ------------------------------------------------------------------
  console.log(chalk.bold('\n' + '='.repeat(50)));
  console.log(chalk.bold.cyan('  Configuration Summary'));
  console.log('='.repeat(50));

  for (const q of questions) {
    const val = answers[q.name];
    const display = q.name === 'adminPassword' ? '*'.repeat(val.length) : val;
    console.log(`  ${chalk.bold(q.message)}: ${chalk.green(display)}`);
  }

  console.log('='.repeat(50) + '\n');

  // ------------------------------------------------------------------
  // Phase 3: confirm & execute
  // ------------------------------------------------------------------
  const rl2 = readline.createInterface({ input, output });
  let confirmRaw: string;
  try {
    confirmRaw = (await rl2.question(chalk.yellow('Proceed with these values? (Y/n): '))).trim();
  } catch {
    console.log(chalk.red('\n  Setup cancelled.'));
    rl2.close();
    process.exit(0);
  }
  rl2.close();

  if (confirmRaw.toLowerCase() === 'n' || confirmRaw.toLowerCase() === 'no') {
    console.log(chalk.red('\n  Setup cancelled. No files were written.\n'));
    process.exit(0);
  }

  console.log(chalk.green('\n  Generating configuration...\n'));

  const paths = await generateConfig(answers as unknown as WizardAnswers);

  console.log(chalk.green('  Configuration generated successfully!\n'));
  console.log(chalk.bold('  Generated files:'));
  console.log(`    ${chalk.cyan(paths.brandJson)}`);
  console.log(`    ${chalk.cyan(paths.envFile)}`);
  console.log(`    ${chalk.cyan(paths.wranglerToml)}`);

  console.log(chalk.bold('\n  Next steps:'));
  console.log('    1. Review the generated files in the output/ directory');
  console.log('    2. Install Wrangler CLI if not already installed:');
  console.log('       npm i -g wrangler');
  console.log('    3. Deploy to Cloudflare:');
  console.log('       aura-deploy deploy ' + answers.domainSlug);
  console.log('');

  console.log(chalk.dim('  To deploy now, run: aura-deploy deploy ' + answers.domainSlug + '\n'));
}
