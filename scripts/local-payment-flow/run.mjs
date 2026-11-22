import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createLocalRuntime, ROOT, verificationDir, runtimeVersions } from './local-runtime.mjs';
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
// Shallow PR checkouts have no origin/main ref; this value is report metadata only.
const revParse = (rev) => {
  try {
    return execFileSync('git', ['rev-parse', rev], { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unavailable';
  }
};
report.baseline = {
  head: revParse('HEAD'),
  originMain: revParse('origin/main'),
  sourceDiffSha256: sourceHash(),
  ...runtimeVersions, compatibilityDate: '2025-01-01',
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
  await mkdir(verificationDir(), { recursive: true });
  await writeFile(path.join(verificationDir(), `${apiOnly ? 'api-flow-results' : 'local-flow-results'}.json`), JSON.stringify(report, null, 2));
  console.log('RESULT', JSON.stringify(report.summary));
  process.exitCode = report.summary.failed || report.summary.fatal ? 1 : 0;
}
