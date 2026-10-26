// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inspectRollbackCapabilities } from '../scripts/verify-staging-gates.mjs';

const deploymentId = '12345678-1234-4321-abcd-123456789abc';
const bookmark = '00000085-0000024c-00004c6d-8e61117bf38d7adb71b934ebbf891683';
const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'aura-rollback-'));
  directories.push(directory);
  const scripts = join(directory, 'scripts');
  const binaries = join(directory, 'bin');
  mkdirSync(scripts); mkdirSync(binaries); mkdirSync(join(directory, 'worker'));
  writeFileSync(join(directory, 'worker/wrangler.toml'), 'name="test-worker"\n');
  const script = join(scripts, 'deploy-rollback.sh');
  copyFileSync(resolve('scripts/deploy-rollback.sh'), script);
  const log = join(directory, 'calls.log');
  writeFileSync(log, '');
  const mock = (name: string, body: string) => {
    const path = join(binaries, name);
    writeFileSync(path, body); chmodSync(path, 0o755);
  };
  mock('npx', '#!/bin/sh\nprintf "%s\\n" "$*" >> "$MOCK_LOG"\nexit "${MOCK_WRANGLER_STATUS:-0}"\n');
  mock('curl', `#!/bin/sh
printf "%s\\n" "$*" >> "$MOCK_LOG"
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--output" ]; then shift; output="$1"; fi
  shift
done
printf '%s' "$MOCK_RESPONSE" > "$output"
exit "\${MOCK_CURL_STATUS:-0}"
`);
  const run = (args: string[], overrides: Record<string, string> = {}) => spawnSync('bash', [script, ...args], {
    cwd: tmpdir(), encoding: 'utf8', env: {
      ...process.env, PATH: `${binaries}:${process.env.PATH}`, MOCK_LOG: log,
      CLOUDFLARE_ACCOUNT_ID: '11111111111111111111111111111111', CLOUDFLARE_API_TOKEN: 'fake-test-token',
      CF_ACCOUNT_ID: '', CF_API_TOKEN: '', CLOUDFLARE_PAGES_PROJECT: 'fnb-caffe-container',
      MOCK_RESPONSE: JSON.stringify({ success: true, result: { id: deploymentId } }),
      MOCK_CURL_STATUS: '0', MOCK_WRANGLER_STATUS: '0', ...overrides,
    },
  });
  return { directory, run, calls: () => readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) };
}

describe('rollback orchestration with zero network calls', () => {
  it('lists Pages deployments without mutating when no identifier is supplied', () => {
    const test = fixture();
    expect(test.run([]).status).toBe(0);
    expect(test.calls()).toEqual(['wrangler pages deployment list --project-name fnb-caffe-container']);
  });

  it('uses the supported Pages REST endpoint and validates its confirmation', () => {
    const test = fixture();
    const result = test.run([deploymentId]);
    expect(result.status).toBe(0);
    expect(test.calls()).toHaveLength(1);
    expect(test.calls()[0]).toContain('--request POST');
    expect(test.calls()[0]).toContain(`/accounts/11111111111111111111111111111111/pages/projects/fnb-caffe-container/deployments/${deploymentId}/rollback`);
    expect(result.stdout + result.stderr).not.toContain('fake-test-token');
  });

  it.each([
    { success: false, result: { id: deploymentId } },
    { success: true, result: { id: 'wrong-deployment' } },
  ])('rejects unconfirmed Pages responses: %j', (response) => {
    const test = fixture();
    const result = test.run([deploymentId], { MOCK_RESPONSE: JSON.stringify(response) });
    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain('Rollback command completed');
  });

  it('propagates transport failures', () => {
    const test = fixture();
    expect(test.run([deploymentId], { MOCK_CURL_STATUS: '22' }).status).toBe(22);
  });

  it('requires Pages credentials before making a request', () => {
    const test = fixture();
    expect(test.run([deploymentId], { CLOUDFLARE_API_TOKEN: '' }).status).not.toBe(0);
    expect(test.calls()).toEqual([]);
  });

  it('accepts the legacy credential variable names used by the runbook', () => {
    const test = fixture();
    expect(test.run([deploymentId], {
      CLOUDFLARE_ACCOUNT_ID: '', CLOUDFLARE_API_TOKEN: '',
      CF_ACCOUNT_ID: '11111111111111111111111111111111', CF_API_TOKEN: 'fake-legacy-token',
    }).status).toBe(0);
  });

  it('anchors Worker configuration independently of the caller working directory', () => {
    const test = fixture();
    expect(test.run(['--target', 'worker', deploymentId]).status).toBe(0);
    expect(test.calls()).toEqual([`wrangler rollback ${deploymentId} --config ${test.directory}/worker/wrangler.toml`]);
  });

  it.each([
    ['2026-10-23T09:00:00Z', '--timestamp'],
    ['1792746000', '--timestamp'],
    [bookmark, '--bookmark'],
  ])('preserves the selected D1 database and restore selector: %s', (identifier, selector) => {
    const test = fixture();
    expect(test.run(['--target', 'd1', identifier, 'staging-db']).status).toBe(0);
    expect(test.calls()).toEqual([`wrangler d1 time-travel restore staging-db ${selector} ${identifier} --config ${test.directory}/worker/wrangler.toml`]);
  });

  it('retains the documented default D1 database when none is provided', () => {
    const test = fixture();
    expect(test.run(['--target', 'd1', '1792746000']).status).toBe(0);
    expect(test.calls()[0]).toContain('restore fnb-caffe-db --timestamp 1792746000');
  });

  it('does not announce completion after a Worker rollback command fails', () => {
    const test = fixture();
    const result = test.run(['--target', 'worker', deploymentId], { MOCK_WRANGLER_STATUS: '9' });
    expect(result.status).toBe(9);
    expect(result.stdout).not.toContain('Rollback command completed');
  });

  it.each([
    ['--target', 'typo', deploymentId], ['--target', 'worker'],
    ['--target', 'd1', 'invalid-time'], ['--target', 'worker', '--yes'],
    ['--target', 'd1', '1792746000', '--remote'],
    [deploymentId, 'unexpected'],
  ])('rejects invalid arguments before invoking external tools: %j', (...args) => {
    const test = fixture();
    expect(test.run(args).status).not.toBe(0);
    expect(test.calls()).toEqual([]);
  });
});

describe('static rollback evidence', () => {
  it('does not accept unsupported Pages CLI commands or GET probes as rollback capability', () => {
    const test = fixture();
    const path = join(test.directory, 'unsupported.sh');
    writeFileSync(path, `npx wrangler pages rollback ${deploymentId}\nnpx wrangler deployments rollback ${deploymentId}\ncurl --request GET https://api.cloudflare.com/client/v4/accounts/account/pages/projects/project/deployments/id/rollback\n`);
    expect(inspectRollbackCapabilities(path)).toMatchObject({ pages: 'unreferenced', worker: 'unreferenced' });
  });

  it('detects the supported script without claiming a real rollback was verified', () => {
    const result = inspectRollbackCapabilities(resolve('scripts/deploy-rollback.sh'));
    expect(result).toMatchObject({ pages: 'static_command_detected', worker: 'static_command_detected', d1: 'static_command_detected', runtimeVerified: false });
  });
});
