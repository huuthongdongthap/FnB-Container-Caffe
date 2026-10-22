import { writeFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createLocalRuntime, ROOT } from './local-runtime.mjs';
import { runApiFlow } from './local-flow-api.mjs';
import { runSecurityChecks } from './local-flow-security.mjs';
import { runBrowserFlow } from './local-flow-browser.mjs';

const report = { startedAt: new Date().toISOString(), scope: 'local Worker/workerd+D1+KV; provider response fixture; no cloud calls', checks: [] };
const apiOnly = process.argv.includes('--api-only');
const sourceHash = () => {
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'src', 'worker', 'packages'], { cwd: ROOT })
    .toString().split('\0').filter(Boolean).sort();
  const hash = createHash('sha256');
  for (const file of files) {
    const target = path.join(ROOT, file);
    hash.update(`${file}\0`).update(existsSync(target) ? readFileSync(target) : '<deleted>');
  }
  return hash.digest('hex');
};
report.baseline = {
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim(),
  originMain: execFileSync('git', ['rev-parse', 'origin/main'], { cwd: ROOT }).toString().trim(),
  sourceDiffSha256: sourceHash(),
  miniflare: '4.20260515.0', workerd: '1.20260515.1', compatibilityDate: '2025-01-01',
  schema: 'fresh worker/schema.sql including additive operational contracts; no remote migration or production snapshot',
};
const check = (id, pass, expected, actual) => {
  report.checks.push({ id, pass: Boolean(pass), expected, actual });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id}: ${JSON.stringify(actual)}`);
};
let runtime;
try {
  runtime = await createLocalRuntime();
  console.log('LOCAL_RUNTIME_READY', runtime.url);
  const context = await runApiFlow(runtime, check);
  await runSecurityChecks(runtime, context, check);
  if (!apiOnly) report.browser = await runBrowserFlow(runtime, context, check);
} catch (error) {
  report.fatal = { message: String(error), stack: error.stack, cause: String(error.cause), causeCode: error.cause?.code };
  console.error('LOCAL_FLOW_FATAL', String(error));
} finally {
  if (runtime) {
    report.providerRequests = runtime.providerRequests;
    report.blockedWorkerNetwork = runtime.deniedNetwork;
    await runtime.close();
  }
  report.finishedAt = new Date().toISOString();
  report.sourceDiffUnchanged = sourceHash() === report.baseline.sourceDiffSha256;
  report.summary = { passed: report.checks.filter(check => check.pass).length, failed: report.checks.filter(check => !check.pass).length, fatal: Boolean(report.fatal) };
  await writeFile(path.join(ROOT, `plans/261020-1225-payment-kds-remediation/verification/${apiOnly ? 'api-flow-results' : 'local-flow-results'}.json`), JSON.stringify(report, null, 2));
  console.log('RESULT', JSON.stringify(report.summary));
  process.exitCode = report.summary.failed || report.summary.fatal ? 1 : 0;
}
