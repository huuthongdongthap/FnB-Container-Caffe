import { Command } from 'commander';
import chalk from 'chalk';
import { execFileSync, execSync, spawn } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateWorkerConfig } from '../deploy/worker-config.js';
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
  return domain.replace(/^aura-cafe-(?=.+\.pages\.dev$)/, '').replace(/\.pages\.dev$/, '');
}

function runStep(label: string, args: string[], cwd: string): boolean {
  console.log(chalk.cyan(`\n  [${label}]...`));
  try {
    const output = execFileSync('npm', args, { cwd, stdio: 'pipe', timeout: 300_000 });
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

function buildFrontend(rootDir: string, brand: BrandConfig, buildConfigPath: string, apiOrigin: string): boolean {
  // The frontend imports config/brand.json directly. Override that module in
  // this build only, preserving defaults needed by the partial wizard config.
  const defaults = JSON.parse(readFileSync(resolve(rootDir, 'config/brand.json'), 'utf-8')) as BrandConfig;
  const buildBrand = {
    ...defaults,
    ...brand,
    brand: { ...defaults.brand, ...brand.brand },
    theme: {
      ...defaults.theme,
      ...brand.theme,
      colors: { ...defaults.theme.colors, ...brand.theme?.colors },
    },
  };
  const brandModuleId = resolve(rootDir, 'config/brand.json');
  const buildConfig = `
import baseConfig from '../vite.config.js';
import { mergeConfig } from 'vite';
export default (env) => mergeConfig(baseConfig(env), {
  define: { 'import.meta.env.VITE_API_BASE': ${JSON.stringify(JSON.stringify(apiOrigin))} },
  plugins: [{
    name: 'aura-deploy-brand',
    enforce: 'pre',
    load(id) {
      if (id === ${JSON.stringify(brandModuleId)}) return ${JSON.stringify(JSON.stringify(buildBrand))};
    },
  }],
});
`;
  writeFileSync(buildConfigPath, buildConfig);
  return runStep('npm run build', ['run', 'build', '--', '--config', buildConfigPath], rootDir);
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function runStepStream(label: string, args: string[], cwd: string): Promise<boolean> {
  return new Promise((resolvePromise) => {
    console.log(chalk.cyan(`\n  [${label}]...`));
    const child = spawn('npx', args, {
      cwd,
      stdio: ['ignore', 'inherit', 'inherit'],
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

function writeDistArtifacts(rootDir: string, clientSlug: string, apiOrigin: string): void {
  const distDir = resolve(rootDir, 'dist');
  mkdirSync(distDir, { recursive: true });

  for (const staticFile of ['robots.txt', 'sitemap.xml']) {
    const srcPath = resolve(rootDir, staticFile);
    if (existsSync(srcPath)) {
      copyFileSync(srcPath, resolve(distDir, staticFile));
    }
  }

  // Vite copies both public assets and the root Pages files. Replace their
  // API routing in the build output only; never mutate the shared templates.
  const redirects = readFileSync(resolve(rootDir, '_redirects'), 'utf8');
  const apiRule = /^([\t ]*\/api\/\*[\t ]+)\S+([\t ]+307[\t ]*)$/gm;
  if (![...redirects.matchAll(apiRule)].length) throw new Error('Missing API redirect in Pages template');
  writeFileSync(resolve(distDir, '_redirects'), redirects.replace(apiRule, (_line, prefix: string, suffix: string) => `${prefix}${apiOrigin}/api/:splat${suffix}`));
  const headers = readFileSync(resolve(rootDir, '_headers'), 'utf8');
  if (!headers.includes("connect-src 'self'")) throw new Error('Missing connect-src in Pages security headers');
  writeFileSync(resolve(distDir, '_headers'), headers.replace(/connect-src 'self'[^;]*/, (directive) => {
    const externalServices = directive.split(/\s+/).filter((token) => !token.includes('auraspace.cafe') && !token.includes('.workers.dev'));
    return `${externalServices.join(' ')} ${apiOrigin}`;
  }));

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
  apiOrigin?: string;
  dryRun?: boolean;
}

export async function deployAction(
  domainSlugArg?: string,
  options: DeployCommandOptions = {},
): Promise<void> {
  // ── 1. Load brand config ──────────────────────────────────────────
  const resolvedBrandPath = resolve(options.brand || resolve(OUTPUT_DIR, 'brand.json'));
  const brand = loadBrandConfig(resolvedBrandPath);

  if (!brand) {
    console.error(chalk.red(`\n  Brand config not found at: ${resolvedBrandPath}`));
    console.log(chalk.yellow('  Run "aura-deploy init" first to generate a brand config.'));
    console.log(chalk.yellow('  Or specify a path with --brand <path>.'));
    return process.exit(1);
  }

  const domainSlug = domainSlugArg || extractDomainSlug(brand.brand.domain);
  const projectName = options.project ?? `aura-cafe-${domainSlug}`;
  const targetValidation = validateDeployTarget(domainSlug, projectName);
  if (!targetValidation.valid) {
    for (const err of targetValidation.errors) {
      console.error(chalk.red(`\n  ${err}`));
    }
    return process.exit(1);
  }
  const rootDir = resolve(PACKAGE_ROOT, '..', '..');
  const workerDir = resolve(rootDir, 'worker');
  const workerConfigPath = resolve(OUTPUT_DIR, 'wrangler.toml');
  const workerName = `aura-cafe-${domainSlug}`;
  let apiOrigin: string;
  try {
    if (!options.apiOrigin) throw new Error('Provide --api-origin with the client Worker HTTPS origin / Cần địa chỉ HTTPS của API riêng cho quán');
    const api = new URL(options.apiOrigin);
    if (api.protocol !== 'https:' || api.username || api.password || api.pathname !== '/' || api.search || api.hash || api.port) {
      throw new Error('--api-origin must be an HTTPS origin without credentials, port, path, query or fragment');
    }
    if (api.hostname.endsWith('.workers.dev') && api.hostname.split('.')[0] !== workerName) {
      throw new Error(`--api-origin must target the client Worker ${workerName}, not another Worker`);
    }
    if (api.hostname === 'api.auraspace.cafe' || api.hostname === 'auraspace.cafe') {
      throw new Error('--api-origin must not target the flagship API');
    }
    apiOrigin = api.origin;
    const config = readFileSync(workerConfigPath, 'utf-8');
    validateWorkerConfig(config, workerConfigPath, workerDir, workerName);
    const hostname = brand.brand.domain.toLowerCase().replace(/\.$/, '');
    if (hostname.endsWith('.pages.dev') && hostname !== `${projectName}.pages.dev`) {
      throw new Error(`Brand domain ${brand.brand.domain} does not match Pages project ${projectName} (expected ${projectName}.pages.dev)`);
    }
  } catch (error) {
    console.error(chalk.red(`\n  Invalid deployment target at ${workerConfigPath}: ${(error as Error).message}`));
    return process.exit(1);
  }

  const pagesArgs = ['--no-install', 'wrangler', 'pages', 'deploy', 'dist', `--project-name=${projectName}`, '--branch=main'];
  const workerArgs = ['--no-install', 'wrangler', 'deploy', '--config', workerConfigPath, '--name', workerName];
  const buildCommand = (path: string) => `npm run build -- --config ${shellQuote(path)}`;

  console.log(chalk.bold.cyan('\n  AURA CAFE - Deploy'));
  console.log(chalk.bold(`  Brand: ${brand.brand.name}`));
  console.log(chalk.bold(`  Project: ${projectName}`));
  console.log(chalk.bold(`  Domain: ${brand.brand.domain}`));
  console.log(`  Brand config: ${resolvedBrandPath}`);
  console.log(`  Worker config: ${workerConfigPath}`);
  console.log(`  Client API: ${apiOrigin}`);
  console.log('');

  if (options.dryRun) {
    console.log(chalk.yellow('  [DRY RUN] Planned execution steps:'));
    console.log(chalk.dim(`    1. (cwd ${rootDir}) ${buildCommand(join(rootDir, '.aura-build-<temporary>/vite.config.mjs'))} using ${resolvedBrandPath}`));
    console.log(chalk.dim(`    2. (cwd ${rootDir}) npx ${pagesArgs.join(' ')}`));
    console.log(chalk.dim(`    3. (cwd ${workerDir}) npx ${workerArgs.map((arg) => arg === workerConfigPath ? shellQuote(arg) : arg).join(' ')} --var GIT_COMMIT_SHA:<HEAD>`));
    return;
  }

  // ── 2. Build frontend ─────────────────────────────────────────────
  console.log(chalk.bold('  Step 1 of 3: Build frontend'));
  let buildOk = false;
  const buildDir = mkdtempSync(join(rootDir, '.aura-build-'));
  try {
    const buildConfigPath = join(buildDir, 'vite.config.mjs');
    buildOk = buildFrontend(rootDir, brand, buildConfigPath, apiOrigin);
  } finally {
    rmSync(buildDir, { recursive: true, force: true });
  }
  if (!buildOk) {
    console.error(chalk.red('\n  Build failed. Aborting deploy.'));
    process.exit(1);
  }
  writeDistArtifacts(rootDir, domainSlug, apiOrigin);

  // ── 3. Deploy to Cloudflare Pages ──────────────────────────────────
  console.log(chalk.bold('\n  Step 2 of 3: Deploy to Cloudflare Pages'));
  const pagesDeployOk = await runStepStream(
    'wrangler pages deploy',
    pagesArgs,
    rootDir,
  );
  if (!pagesDeployOk) {
    console.error(chalk.red('\n  Cloudflare Pages deploy failed. Aborting.'));
    process.exit(1);
  }

  // ── 4. Deploy Cloudflare Worker ────────────────────────────────────
  console.log(chalk.bold('\n  Step 3 of 3: Deploy Cloudflare Worker'));
  const gitSha = execSync('git rev-parse HEAD', { cwd: rootDir }).toString().trim();
  const workerDeployOk = await runStepStream(
    'wrangler worker deploy',
    [...workerArgs, '--var', `GIT_COMMIT_SHA:${gitSha}`],
    workerDir,
  );
  if (!workerDeployOk) {
    console.error(chalk.red('\n  Cloudflare Worker deploy failed. Aborting.'));
    process.exit(1);
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
    .option('--api-origin <url>', 'Required client Worker HTTPS origin / Địa chỉ HTTPS của API riêng cho quán')
    .option('--project <name>', 'Cloudflare Pages project name (auto-derived from domain)')
    .option('--dry-run', 'Validate deployment config and print deployment steps without running cloud commands')
    .action(async (domainSlug: string | undefined, opts: DeployCommandOptions) => {
      await deployAction(domainSlug, opts);
    });

  return cmd;
}
