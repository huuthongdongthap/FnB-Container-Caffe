import { Command } from 'commander';
import chalk from 'chalk';
import { execSync, spawn } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDeployTarget } from '../wizard/validators.js';

export { validateDeployTarget };

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
  theme: {
    colors: {
      primary: string;
    };
  };
}

function loadBrandConfig(brandPath: string): BrandConfig | null {
  if (!existsSync(brandPath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync(brandPath, 'utf-8')) as BrandConfig;
    if (
      !parsed ||
      typeof parsed.brand?.name !== 'string' ||
      !parsed.brand.name.trim() ||
      typeof parsed.brand?.domain !== 'string' ||
      !parsed.brand.domain.trim()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function extractDomainSlug(domain: string): string {
  return domain.replace(/\.pages\.dev$/, '');
}

function runStep(label: string, command: string, cwd: string): boolean {
  console.log(chalk.cyan(`\n  [${label}]...`));
  try {
    const output = execSync(command, { cwd, stdio: 'pipe', timeout: 300_000 });
    const lines = output.toString().trim().split('\n').slice(-5);
    for (const line of lines) {
      console.log(`    ${chalk.dim(line)}`);
    }
    return true;
  } catch (err: unknown) {
    const error = err as { stdout?: Buffer; stderr?: Buffer; message?: string };
    if (error.stdout) console.log(error.stdout.toString());
    if (error.stderr) console.error(chalk.red(error.stderr.toString()));
    else if (error.message) console.error(chalk.red(error.message));
    return false;
  }
}

function runStepStream(label: string, fullCommand: string, cwd: string): Promise<boolean> {
  return new Promise((resolvePromise) => {
    console.log(chalk.cyan(`\n  [${label}]...`));
    const child = spawn(fullCommand, {
      cwd,
      stdio: ['ignore', 'inherit', 'inherit'],
      shell: true,
      timeout: 300_000,
    });

    child.on('close', (code: number | null) => {
      resolvePromise(code === 0);
    });

    child.on('error', (err: Error) => {
      console.error(chalk.red(`  Error: ${err.message}`));
      resolvePromise(false);
    });
  });
}

function writeDistArtifacts(rootDir: string, clientSlug: string): void {
  const distDir = resolve(rootDir, 'dist');
  mkdirSync(distDir, { recursive: true });

  for (const staticFile of ['robots.txt', 'sitemap.xml']) {
    const srcPath = resolve(rootDir, staticFile);
    if (existsSync(srcPath)) {
      copyFileSync(srcPath, resolve(distDir, staticFile));
    }
  }

  const signageSrcDir = resolve(rootDir, 'signage-widgets');
  if (existsSync(signageSrcDir)) {
    const signageDistDir = resolve(distDir, 'signage');
    mkdirSync(signageDistDir, { recursive: true });
    for (const entry of readdirSync(signageSrcDir)) {
      if (entry.endsWith('.html')) {
        copyFileSync(resolve(signageSrcDir, entry), resolve(signageDistDir, entry));
      }
    }
  }

  let gitShaFull = 'unknown';
  try {
    gitShaFull = execSync('git rev-parse HEAD', { cwd: rootDir, stdio: 'pipe' })
      .toString()
      .trim();
  } catch {
    gitShaFull = 'unknown';
  }
  const versionManifest = {
    sha: gitShaFull,
    shortSha: gitShaFull.slice(0, 8),
    buildTime: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    client: clientSlug,
    deployScript: 'aura-deploy',
  };
  writeFileSync(resolve(distDir, 'version.json'), `${JSON.stringify(versionManifest, null, 2)}\n`, 'utf-8');
}

export interface DeployCommandOptions {
  brand?: string;
  project?: string;
  dryRun?: boolean;
}

export async function deployAction(
  domainSlugArg?: string,
  options: DeployCommandOptions = {},
): Promise<void> {
  // ── 1. Load brand config ──────────────────────────────────────────
  const resolvedBrandPath = options.brand || resolve(OUTPUT_DIR, 'brand.json');
  const brand = loadBrandConfig(resolvedBrandPath);

  if (!brand) {
    console.error(chalk.red(`\n  Brand config not found at: ${resolvedBrandPath}`));
    console.log(chalk.yellow('  Run "aura-deploy init" first to generate a brand config.'));
    console.log(chalk.yellow('  Or specify a path with --brand <path>.'));
    return process.exit(1);
  }

  const domainSlug = domainSlugArg || extractDomainSlug(brand.brand.domain);
  const projectName = options.project || `aura-cafe-${domainSlug}`;
  const targetValidation = validateDeployTarget(domainSlug, projectName);
  if (!targetValidation.valid) {
    for (const err of targetValidation.errors) {
      console.error(chalk.red(`\n  ${err}`));
    }
    return process.exit(1);
  }
  const rootDir = resolve(PACKAGE_ROOT, '..', '..');

  console.log(chalk.bold.cyan('\n  AURA CAFE - Deploy'));
  console.log(chalk.bold(`  Brand: ${brand.brand.name}`));
  console.log(chalk.bold(`  Project: ${projectName}`));
  console.log(chalk.bold(`  Domain: ${brand.brand.domain}`));
  console.log('');

  if (options.dryRun) {
    console.log(chalk.yellow('  [DRY RUN] Validated brand configuration. Planned execution steps:'));
    console.log(chalk.dim('    1. npm run build + generate dist/version.json + copy SEO/signage assets'));
    console.log(chalk.dim(`    2. npx --no-install wrangler pages deploy dist --project-name=${projectName} --branch=main`));
    console.log(chalk.dim('    3. npx --no-install wrangler deploy --config wrangler.toml --var GIT_COMMIT_SHA:<HEAD>'));
    return;
  }

  // ── 2. Build frontend ─────────────────────────────────────────────
  console.log(chalk.bold('  Step 1 of 3: Build frontend'));
  const buildOk = runStep('npm run build', 'npm run build 2>&1', rootDir);
  if (!buildOk) {
    console.error(chalk.red('\n  Build failed. Aborting deploy.'));
    process.exit(1);
  }
  writeDistArtifacts(rootDir, domainSlug);

  // ── 3. Deploy to Cloudflare Pages ──────────────────────────────────
  console.log(chalk.bold('\n  Step 2 of 3: Deploy to Cloudflare Pages'));
  const pagesDeployOk = await runStepStream(
    'wrangler pages deploy',
    `npx --no-install wrangler pages deploy dist --project-name=${projectName} --branch=main`,
    rootDir,
  );
  if (!pagesDeployOk) {
    console.error(chalk.red('\n  Cloudflare Pages deploy failed. Aborting.'));
    process.exit(1);
  }

  // ── 4. Deploy Cloudflare Worker ────────────────────────────────────
  console.log(chalk.bold('\n  Step 3 of 3: Deploy Cloudflare Worker'));
  const workerDir = resolve(rootDir, 'worker');
  if (existsSync(workerDir)) {
    const gitSha = execSync('git rev-parse HEAD', { cwd: rootDir })
      .toString().trim();
    const workerDeployOk = await runStepStream(
      'wrangler worker deploy',
      `npx --no-install wrangler deploy --config wrangler.toml --var GIT_COMMIT_SHA:${gitSha}`,
      workerDir,
    );
    if (!workerDeployOk) {
      console.error(chalk.red('\n  Cloudflare Worker deploy failed. Aborting.'));
      process.exit(1);
    }
  } else {
    console.log(chalk.dim('  No worker directory found, skipping worker deploy.'));
  }

  // ── 5. Print results ──────────────────────────────────────────────
  const pagesUrl = `https://${brand.brand.domain}`;
  const apiUrl = `https://${brand.brand.domain}/api`;

  console.log(chalk.bold.green('\n  Deploy complete!\n'));
  console.log(chalk.bold('  URLs:'));
  console.log(`    Pages:  ${chalk.cyan(pagesUrl)}`);
  console.log(`    API:    ${chalk.cyan(apiUrl)}`);
  console.log('');
  console.log(chalk.dim('  Run "aura-deploy verify" to check deployment health.\n'));
}

export function createDeployCommand(): Command {
  const cmd = new Command('deploy')
    .description('Deploy a branded AURA CAFE instance to Cloudflare')
    .argument('[domainSlug]', 'Optional domain slug override from init wizard')
    .option('--brand <path>', 'Path to brand.json (defaults to output/brand.json)')
    .option('--project <name>', 'Cloudflare Pages project name (auto-derived from domain)')
    .option('--dry-run', 'Validate brand config and print deployment steps without running cloud commands')
    .action(async (domainSlug: string | undefined, opts: DeployCommandOptions) => {
      await deployAction(domainSlug, opts);
    });

  return cmd;
}
