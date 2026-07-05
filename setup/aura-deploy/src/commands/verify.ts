import { Command } from 'commander';
import chalk from 'chalk';
import { request } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import * as dns from 'node:dns';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = resolve(__dirname, '../..');
const OUTPUT_DIR = resolve(PACKAGE_ROOT, 'output');

interface BrandConfig {
  brand: {
    name: string;
    nameShort: string;
    tagline: string;
    domain: string;
  };
  theme?: {
    colors?: {
      primary?: string;
    };
  };
}

interface CheckResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  detail: string;
}

function loadBrandConfig(): BrandConfig | null {
  const brandPath = resolve(OUTPUT_DIR, 'brand.json');
  if (!existsSync(brandPath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(brandPath, 'utf-8')) as BrandConfig;
  } catch {
    return null;
  }
}

function getHttp(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolvePromise, reject) => {
    const lib = url.startsWith('https') ? httpsRequest : request;
    const req = lib(url, { method: 'GET', timeout: 10_000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        resolvePromise({
          status: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString('utf-8'),
        });
      });
    });
    req.on('error', (err) => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.end();
  });
}

async function checkDns(hostname: string): Promise<CheckResult> {
  return new Promise((resolvePromise) => {
    dns.resolve4(hostname, (err) => {
      if (err) {
        resolvePromise({
          name: 'DNS Resolution',
          status: 'FAIL',
          detail: `Failed to resolve ${hostname}: ${err.message}`,
        });
      } else {
        resolvePromise({
          name: 'DNS Resolution',
          status: 'PASS',
          detail: `${hostname} resolves correctly`,
        });
      }
    });
  });
}

async function checkHttps(hostname: string): Promise<CheckResult> {
  try {
    const res = await getHttp(`https://${hostname}`);
    if (res.status >= 200 && res.status < 400) {
      return {
        name: 'HTTPS Certificate',
        status: 'PASS',
        detail: `HTTPS OK (HTTP ${res.status})`,
      };
    }
    return {
      name: 'HTTPS Certificate',
      status: 'FAIL',
      detail: `Unexpected HTTP status: ${res.status}`,
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      name: 'HTTPS Certificate',
      status: 'FAIL',
      detail: `HTTPS error: ${error.message}`,
    };
  }
}

async function checkApiHealth(hostname: string): Promise<CheckResult> {
  try {
    const res = await getHttp(`https://${hostname}/api/health`);
    if (res.status === 200) {
      return {
        name: 'API Health',
        status: 'PASS',
        detail: `/api/health returned HTTP 200`,
      };
    }
    return {
      name: 'API Health',
      status: 'FAIL',
      detail: `/api/health returned HTTP ${res.status} (expected 200)`,
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      name: 'API Health',
      status: 'FAIL',
      detail: `API health check error: ${error.message}`,
    };
  }
}

async function checkBranding(hostname: string, brandName: string): Promise<CheckResult> {
  try {
    const res = await getHttp(`https://${hostname}`);
    if (res.status !== 200) {
      return {
        name: 'Branding Check',
        status: 'FAIL',
        detail: `Main page returned HTTP ${res.status} (expected 200)`,
      };
    }
    const brandLower = brandName.toLowerCase();
    const bodyLower = res.body.toLowerCase();
    if (bodyLower.includes(brandLower) || bodyLower.includes(brandName)) {
      return {
        name: 'Branding Check',
        status: 'PASS',
        detail: `Page loads and contains brand name "${brandName}"`,
      };
    }
    return {
      name: 'Branding Check',
      status: 'FAIL',
      detail: `Page loads but brand name "${brandName}" not found in content`,
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      name: 'Branding Check',
      status: 'FAIL',
      detail: `Branding check error: ${error.message}`,
    };
  }
}

async function verifyAction(domain?: string, verbose?: boolean): Promise<void> {
  let hostname: string | null = null;
  let brandName = 'AURA CAFE';

  if (domain) {
    hostname = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  } else {
    // Try reading brand.json
    const brand = loadBrandConfig();
    if (brand) {
      hostname = brand.brand.domain;
      brandName = brand.brand.name;
      if (verbose) {
        console.log(chalk.dim(`  Using brand config: ${brand.brand.name} -> ${hostname}`));
      }
    }
  }

  if (!hostname) {
    console.error(chalk.red('\n  No domain specified.'));
    console.log(chalk.yellow('  Run "aura-deploy init" first, or specify a domain:'));
    console.log(chalk.yellow('    aura-deploy verify --domain my-cafe.pages.dev'));
    process.exit(1);
  }

  console.log(chalk.bold.cyan('\n  AURA CAFE - Verify Deployment'));
  console.log(chalk.bold(`  Domain: ${hostname}\n`));

  const checks: Promise<CheckResult>[] = [
    checkDns(hostname),
    checkHttps(hostname),
    checkApiHealth(hostname),
    checkBranding(hostname, brandName),
  ];

  const results = await Promise.all(checks);

  // Report results
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

  // Summary
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
    .description('Verify a deployed AURA CAFE instance health and branding')
    .option('--domain <url>', 'Domain to verify (e.g. my-cafe.pages.dev)')
    .option('-v, --verbose', 'Show detailed check information')
    .action(async (opts: { domain?: string; verbose?: boolean }) => {
      await verifyAction(opts.domain, opts.verbose);
    });

  return cmd;
}
