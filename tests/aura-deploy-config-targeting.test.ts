// @vitest-environment node
import { execFileSync, execSync, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { generateConfig } from '../setup/aura-deploy/src/template/generate';
import { deployAction as runDeployAction } from '../setup/aura-deploy/src/commands/deploy';

// Commander is only used by CLI registration, not deployAction.
vi.mock('commander', () => ({ Command: vi.fn() }));
vi.mock('node:child_process', () => ({ execFileSync: vi.fn(), execSync: vi.fn(), spawn: vi.fn() }));
vi.mock('node:fs', async (original) => {
  const fs = await original<typeof import('node:fs')>();
  return { ...fs, readFileSync: vi.fn(fs.readFileSync), writeFileSync: vi.fn(), mkdirSync: vi.fn(), copyFileSync: vi.fn() };
});

const apiOrigin = 'https://aura-cafe-client-cafe.example.workers.dev';
const deployAction: typeof runDeployAction = (slug, options) => runDeployAction(slug, { apiOrigin, ...options });

const output = resolve('setup/aura-deploy/output');
const brandPath = resolve(output, 'brand.json');
const workerPath = resolve(output, 'wrangler.toml');
const templatePath = resolve('setup/aura-deploy/config/wrangler.toml');
let domain: string;
let provisionedConfig: string;
let worker: string | undefined;

beforeEach(async () => {
  const fs = await vi.importActual<typeof import('node:fs')>('node:fs');
  domain = 'aura-cafe-client-cafe.pages.dev';
  provisionedConfig = fs.readFileSync(templatePath, 'utf8')
    .replaceAll('{{DOMAIN_SLUG}}', 'client-cafe')
    .replace('main = "src/index.ts"', 'main = "../../../worker/src/index.ts"')
    .replace('database_id = ""', 'database_id = "00000000-0000-4000-8000-000000000001"')
    .replace('\nid = ""', `\nid = "${'1'.repeat(32)}"`);
  worker = provisionedConfig;
  vi.mocked(readFileSync).mockImplementation((path, options) => {
    if (path === brandPath || path === resolve('client config/brand.json')) return JSON.stringify({ brand: { name: 'Client Cafe', domain } });
    if (path === workerPath) {
      if (worker === undefined) throw new Error('Missing config');
      return worker;
    }
    return fs.readFileSync(path, options);
  });
  vi.mocked(execSync).mockReturnValue(Buffer.from('a'.repeat(40)));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(process, 'exit').mockImplementation((code) => { throw new Error(`exit ${code}`); });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

it.each([undefined, 'client config/brand.json'])('prints resolved build and deploy inputs for --brand %s', async (override) => {
  await deployAction(undefined, { brand: override, dryRun: true });
  const outputText = vi.mocked(console.log).mock.calls.flat().join('\n');
  expect(outputText).toContain(override ? resolve(override) : brandPath);
  expect(outputText).toContain(workerPath);
  expect(outputText).toContain('npm run build');
  expect(outputText).toContain('--project-name=aura-cafe-client-cafe');
  expect(outputText).not.toContain(resolve('worker/wrangler.toml'));
  expect(spawn).not.toHaveBeenCalled();
});

it.each([
  ['missing', undefined],
  ['primary', 'name = "aura-space-worker"\n'],
  ['another client', 'name = "aura-cafe-other-cafe"\n'],
])('rejects a %s Worker config before build or deployment', async (_scenario, config) => {
  worker = config;
  await expect(deployAction('client-cafe', { dryRun: true })).rejects.toThrow('exit 1');
  expect(execSync).not.toHaveBeenCalled();
  expect(spawn).not.toHaveBeenCalled();
});

it.each([
  ['misresolved entrypoint', 'main = "../../../worker/src/index.ts"', 'main = "src/index.ts"', 'Worker main'],
  ['stale Pages output field', 'compatibility_date', 'pages_build_output_dir = "./dist"\ncompatibility_date', 'Remove pages_build_output_dir'],
  ['wrong cron', '*/5 * * * *', '0 * * * *', 'five-minute Worker cron'],
  ['wrong migration type', 'new_sqlite_classes', 'new_classes', 'SQLite migration'],
  ['wrong DO binding', 'class_name = "OrderBroadcaster"', 'class_name = "Other"', 'local OrderBroadcaster'],
  ['unprovisioned D1', '00000000-0000-4000-8000-000000000001', '', 'Provision the client D1'],
  ['unprovisioned KV', '1'.repeat(32), '', 'Provision the client KV'],
])('blocks Pages publishing for %s', async (_scenario, from, to, message) => {
  worker = provisionedConfig.replace(from, to);
  await expect(deployAction('client-cafe')).rejects.toThrow('exit 1');
  expect(vi.mocked(console.error).mock.calls.flat().join('\n')).toContain(message);
  expect(execFileSync).not.toHaveBeenCalled();
  expect(spawn).not.toHaveBeenCalled();
});

it('rejects a Pages hostname that disagrees with --project', async () => {
  await expect(deployAction('client-cafe', { project: 'other-project' })).rejects.toThrow('exit 1');
  expect(vi.mocked(console.error).mock.calls.flat().join('\n')).toContain('expected other-project.pages.dev');
  expect(spawn).not.toHaveBeenCalled();
});

it.each(['', 'Other Project'])('rejects invalid --project %j even with a custom domain', async (project) => {
  domain = 'cafe.example.com';
  await expect(deployAction('client-cafe', { project })).rejects.toThrow('exit 1');
  expect(vi.mocked(console.error).mock.calls.flat().join('\n')).toContain('Invalid Cloudflare Pages projectName');
  expect(spawn).not.toHaveBeenCalled();
});

it.each(['other-project.pages.dev', 'cafe.example.com'])('allows --project when using %s', async (hostname) => {
  domain = hostname;
  await deployAction('client-cafe', { project: 'other-project', dryRun: true });
  expect(vi.mocked(console.log).mock.calls.flat().join('\n')).toContain('--project-name=other-project');
  expect(spawn).not.toHaveBeenCalled();
});

it('generates aligned Pages URLs and a config-relative Worker with runtime declarations', async () => {
  const paths = await generateConfig({
    cafeName: 'Client Cafe', domainSlug: 'client-cafe', primaryColor: '#123456',
    tagline: '', adminEmail: 'admin@example.com', adminPassword: 'fixture-only',
  }, output);
  const writes = new Map(vi.mocked(writeFileSync).mock.calls.map(([path, data]) => [path, String(data)]));
  expect(JSON.parse(writes.get(paths.brandJson) ?? '').brand.domain).toBe('aura-cafe-client-cafe.pages.dev');
  const generated = writes.get(paths.wranglerToml) ?? '';
  expect(generated).toContain('CORS_ORIGIN = "https://aura-cafe-client-cafe.pages.dev"');
  expect(generated).toContain('FRONTEND_URL = "https://aura-cafe-client-cafe.pages.dev"');
  expect(generated).not.toContain('pages_build_output_dir');
  worker = generated.replace('database_id = ""', 'database_id = "00000000-0000-4000-8000-000000000001"')
    .replace('\nid = ""', `\nid = "${'1'.repeat(32)}"`);
  await deployAction(undefined, { dryRun: true });
});

it('passes the selected brand to the build without changing the tracked brand', async () => {
  const trackedBrand = resolve('config/brand.json');
  const original = readFileSync(trackedBrand, 'utf8');
  let configPath = '';
  vi.mocked(execFileSync).mockImplementation((command, args) => {
    expect(command).toBe('npm');
    expect(args).toEqual(['run', 'build', '--', '--config', expect.any(String)]);
    configPath = (args as string[])[4];
    const config = vi.mocked(writeFileSync).mock.calls.find(([path]) => path === configPath);
    expect(config?.[1]).toContain('Client Cafe');
    expect(config?.[1]).toContain('theme');
    expect(config?.[1]).toContain('import.meta.env.VITE_API_BASE');
    expect(config?.[1]).toContain(apiOrigin);
    expect(readFileSync(trackedBrand, 'utf8')).toBe(original);
    return Buffer.from('');
  });
  vi.mocked(spawn).mockImplementation(() => {
    const child = new EventEmitter();
    queueMicrotask(() => child.emit('close', 0));
    return child as ReturnType<typeof spawn>;
  });

  await deployAction('client-cafe', { brand: 'client config/brand.json' });

  const writes = new Map(vi.mocked(writeFileSync).mock.calls.map(([path, data]) => [path, String(data)]));
  const redirects = writes.get(resolve('dist/_redirects')) ?? '';
  expect(redirects).toContain(`${apiOrigin}/api/:splat`);
  expect(redirects).not.toContain('aura-space-worker');
  expect(redirects).toContain('/index.html');
  const headers = writes.get(resolve('dist/_headers')) ?? '';
  expect(headers).toContain(apiOrigin);
  expect(headers).not.toContain('aura-space-worker');
  expect(headers).not.toContain('api.auraspace.cafe');
  expect(execFileSync).toHaveBeenCalledOnce();
  expect(existsSync(resolve(configPath, '..'))).toBe(false);
  expect(vi.mocked(writeFileSync).mock.calls.some(([path]) => path === trackedBrand)).toBe(false);
  expect(spawn).toHaveBeenNthCalledWith(2, 'npx', [
    '--no-install', 'wrangler', 'deploy', '--config', workerPath,
    '--name', 'aura-cafe-client-cafe', '--var', `GIT_COMMIT_SHA:${'a'.repeat(40)}`,
  ], expect.objectContaining({ cwd: resolve('worker') }));
});

it.each([undefined, 'http://client.example.com', 'https://client.example.com/api', 'https://aura-space-worker.example.workers.dev', 'https://api.auraspace.cafe', 'https://user:password@client.example.com', 'https://client.example.com?token=private', 'https://client.example.com#fragment'])('blocks missing or unsafe client API origin %s before publishing', async (origin) => {
  await expect(deployAction('client-cafe', { apiOrigin: origin })).rejects.toThrow('exit 1');
  expect(execFileSync).not.toHaveBeenCalled();
  expect(spawn).not.toHaveBeenCalled();
});

it('uses a custom client API hostname without changing shared templates', async () => {
  const origin = 'https://api.client.example.com';
  await deployAction('client-cafe', { apiOrigin: origin, dryRun: true });
  expect(vi.mocked(console.log).mock.calls.flat().join('\n')).toContain(`Client API: ${origin}`);
  expect(writeFileSync).not.toHaveBeenCalled();
  expect(spawn).not.toHaveBeenCalled();
});
