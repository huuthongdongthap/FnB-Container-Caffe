import { Command } from 'commander';
import chalk from 'chalk';
import {
  type CheckResult,
  loadBrandConfig,
  checkDns,
  checkHttps,
  checkApiHealth,
  checkVersionParity,
  checkBranding,
} from './verify-checks.js';

export {
  type CheckResult,
  type HttpGetter,
  loadBrandConfig,
  checkDns,
  checkHttps,
  checkApiHealth,
  checkVersionParity,
  checkBranding,
} from './verify-checks.js';

export interface VerifyCommandOptions {
  domain?: string;
  brand?: string;
  expectedSha?: string;
  verbose?: boolean;
}

export async function verifyAction(options: VerifyCommandOptions = {}): Promise<void> {
  let hostname: string | null = null;
  let brandName = 'AURA CAFE';

  const brand = loadBrandConfig(options.brand);
  if (brand) {
    brandName = brand.brand.name;
    hostname = brand.brand.domain;
    if (options.verbose) {
      console.log(chalk.dim(`  Using brand config: ${brand.brand.name} -> ${hostname}`));
    }
  }
  if (options.domain) {
    hostname = options.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  }

  if (!hostname) {
    console.error(chalk.red('\n  No domain specified.'));
    console.log(chalk.yellow('  Run "aura-deploy init" first, or specify a domain:'));
    console.log(chalk.yellow('    aura-deploy verify --domain my-cafe.pages.dev'));
    return process.exit(1);
  }

  console.log(chalk.bold.cyan('\n  AURA CAFE - Verify Deployment'));
  console.log(chalk.bold(`  Domain: ${hostname}\n`));

  const checks: Promise<CheckResult>[] = [
    checkDns(hostname),
    checkHttps(hostname),
    checkApiHealth(hostname),
    checkVersionParity(hostname, options.expectedSha),
    checkBranding(hostname, brandName),
  ];

  const results = await Promise.all(checks);

  let passed = 0;
  let failed = 0;

  for (const check of results) {
    const icon = check.status === 'PASS' ? chalk.green('PASS') : chalk.red('FAIL');
    console.log(`  [${icon}] ${check.name}`);
    console.log(`         ${chalk.dim(check.detail)}`);
    console.log('');
    if (check.status === 'PASS') passed++;
    else failed++;
  }

  const total = results.length;
  console.log(chalk.bold('═'.repeat(40)));
  if (failed === 0) {
    console.log(chalk.bold.green(`  All ${total} checks passed. Deployment is healthy.\n`));
  } else {
    console.log(chalk.bold.red(`  ${passed}/${total} checks passed. ${failed} failure(s).\n`));
    process.exitCode = 1;
  }
}

export function createVerifyCommand(): Command {
  const cmd = new Command('verify')
    .description('Verify a deployed AURA CAFE instance health, version parity, and branding')
    .option('--domain <url>', 'Domain to verify (e.g. my-cafe.pages.dev)')
    .option('--brand <path>', 'Path to brand.json (defaults to output/brand.json)')
    .option('--expected-sha <sha>', 'Expected git commit SHA (full or 8-char prefix)')
    .option('-v, --verbose', 'Show detailed check information')
    .action(async (opts: VerifyCommandOptions) => {
      await verifyAction(opts);
    });

  return cmd;
}
