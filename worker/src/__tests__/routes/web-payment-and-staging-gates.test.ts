/**
 * Supported Payment Method Schemas, Staging Gate Accuracy & Migration Topology Tests
 *
 * Verifies:
 * 1. New order and payment-intent schemas accept only PayOS and COD, and the
 *    removed Apple Pay / Google Pay payment-request route is unavailable.
 * 2. Staging Gates (scripts/verify-staging-gates.mjs):
 *    - GATE_2_BUNDLE_BUILD fails when dist/ artifacts are stale (older than src/).
 *    - GATE_3_ROLLBACK_READINESS fails when .down.sql count < forward .sql count.
 *    - All local gates pass only when dist/ is fresh AND 1:1 .down.sql coverage exists.
 * 3. Migration Source of Truth (scripts/lint-d1-migrations.mjs & deploy scripts):
 *    - lintAllMigrationDirectories validates worker/db/migrations, db/migrations,
 *      scripts/migrations, and worker/migrations.
 *    - deploy-cloudflare.sh, worker/scripts/apply-migrations.sh, and scripts/deploy-branded.sh
 *      skip *.down.sql files during forward migration execution.
 */

import { describe, it, expect } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  utimesSync,
  rmSync,
  readFileSync,
  chmodSync,
  copyFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from '../../index';
import { generateJWT } from '../../lib/jwt';
import { createMockEnv } from '../test-utils';
import { PaymentIntentSchema } from '../../schemas/payments';
import { OrderCreateSchema } from '../../schemas/orders';
import {
  evaluateGoLiveGates,
  inspectRollbackCapabilities,
} from '../../../../scripts/verify-staging-gates.mjs';
import {
  lintAllMigrationDirectories,
  lintMigrationsDirectory,
  inspectMigrationReversibility,
} from '../../../../scripts/lint-d1-migrations.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const TEST_SECRET = 'test-jwt-secret-at-least-16-chars';

describe('Supported payment methods', () => {
  const unsupportedMethods = ['cash', 'card', 'momo', 'zalopay', 'apple_pay', 'google_pay'];

  it('accepts only PayOS and COD for new payment intents', () => {
    for (const method of ['payos', 'cod']) {
      expect(PaymentIntentSchema.safeParse({
        orderId: 'ORD_1', amount: 1000, method, idempotencyKey: 'test-key',
      }).success).toBe(true);
    }
    for (const method of unsupportedMethods) {
      expect(PaymentIntentSchema.safeParse({
        orderId: 'ORD_1', amount: 1000, method, idempotencyKey: 'test-key',
      }).success).toBe(false);
    }
  });

  it('accepts only PayOS and COD for new orders', () => {
    const baseOrder = { locationId: 'loc_main', items: [{ menuItemId: 'prod_coffee', quantity: 1 }] };
    for (const paymentMethod of ['payos', 'cod']) {
      expect(OrderCreateSchema.safeParse({ ...baseOrder, paymentMethod }).success).toBe(true);
    }
    for (const paymentMethod of unsupportedMethods) {
      expect(OrderCreateSchema.safeParse({ ...baseOrder, paymentMethod }).success).toBe(false);
    }
  });

  it('removes the Apple Pay and Google Pay payment-request route', async () => {
    const token = await generateJWT(
      { id: 'cust-a', sub: 'cust-a', role: 'customer', email: 'a@test.aura', name: 'Customer A' },
      TEST_SECRET
    );
    const response = await app.fetch(
      new Request('https://test.aura/api/payments/payment-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_id: 'ORD_1', amount: 1000, currency: 'VND' }),
      }),
      createMockEnv({ JWT_SECRET: TEST_SECRET }) as any
    );
    expect(response.status).toBe(404);
  });

  it('does not mount MoMo create or webhook endpoints', async () => {
    const env = createMockEnv({ JWT_SECRET: TEST_SECRET }) as any;
    const createResponse = await app.fetch(
      new Request('https://test.aura/api/payment/momo/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: 'ORD_1', amount: 1000 }),
      }),
      env,
    );
    const webhookResponse = await app.fetch(
      new Request('https://test.aura/api/webhook/momo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: 'ORD_1' }),
      }),
      env,
    );

    expect(createResponse.status).toBe(404);
    expect(webhookResponse.status).toBe(404);
  });
});

describe('Priority 2: Staging Gate Accuracy (Stale Build, Public Asset Freshness, Target Selection & Rollback Capabilities)', () => {
  // Pages rollback goes through the Cloudflare REST API: there is no
  // `wrangler pages rollback` subcommand, and the runbook records that a CLI
  // rollback probe must never be mistaken for real rollback capability.
  const PAGES_ROLLBACK_CALL = `curl --fail --silent --request POST \\
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects/$PROJECT_NAME/deployments/$1/rollback"`;

  const FULL_ROLLBACK_SCRIPT = `#!/bin/bash
${PAGES_ROLLBACK_CALL}
npx wrangler rollback "$1"
npx wrangler d1 execute fnb-caffe-db --file="worker/db/migrations/20261001_01_table_01.down.sql" --remote
`;

  const PAGES_ONLY_ROLLBACK_SCRIPT = `#!/bin/bash
${PAGES_ROLLBACK_CALL}
`;

  function setupTempRepoFixture(options: {
    forwardCount: number;
    downCount: number;
    staleBuild: boolean;
    stalePublicAsset?: boolean;
    rollbackScriptMode?: 'full' | 'pages-only' | 'missing';
    migrationStyle?: 'safe-index' | 'destructive-drop-table' | 'incomplete-add-column';
    brandedMigrations?: { forwardCount: number; downCount: number };
    operatorMigrations?: { forwardCount: number; downCount: number };
  }) {
    const tempRoot = mkdtempSync(join(tmpdir(), 'aura-gates-test-'));
    const migDir = join(tempRoot, 'worker/db/migrations');
    const srcDir = join(tempRoot, 'src');
    const publicDir = join(tempRoot, 'public');
    const distAssetsDir = join(tempRoot, 'dist/assets');
    const scriptsDir = join(tempRoot, 'scripts');

    mkdirSync(migDir, { recursive: true });
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(publicDir, { recursive: true });
    mkdirSync(distAssetsDir, { recursive: true });
    mkdirSync(scriptsDir, { recursive: true });

    const rollbackMode = options.rollbackScriptMode ?? 'full';
    if (rollbackMode === 'full') {
      writeFileSync(join(scriptsDir, 'deploy-rollback.sh'), FULL_ROLLBACK_SCRIPT);
    } else if (rollbackMode === 'pages-only') {
      writeFileSync(join(scriptsDir, 'deploy-rollback.sh'), PAGES_ONLY_ROLLBACK_SCRIPT);
    }

    const migrationStyle = options.migrationStyle ?? 'safe-index';
    for (let i = 1; i <= options.forwardCount; i++) {
      const seq = String(i).padStart(2, '0');
      const forwardSql =
        migrationStyle === 'destructive-drop-table'
          ? `CREATE TABLE IF NOT EXISTS test_${seq} (id TEXT PRIMARY KEY);\n`
          : migrationStyle === 'incomplete-add-column'
            ? `CREATE INDEX IF NOT EXISTS idx_orders_${seq} ON orders(id);\nALTER TABLE orders ADD COLUMN extra_${seq} TEXT;\n`
            : `CREATE INDEX IF NOT EXISTS idx_orders_${seq} ON orders(id);\n`;
      const downSql =
        migrationStyle === 'destructive-drop-table'
          ? `DROP TABLE IF EXISTS test_${seq};\n`
          : `DROP INDEX IF EXISTS idx_orders_${seq};\n`;

      writeFileSync(join(migDir, `20261001_${seq}_table_${seq}.sql`), forwardSql);
      if (i <= options.downCount) {
        writeFileSync(join(migDir, `20261001_${seq}_table_${seq}.down.sql`), downSql);
      }
    }

    if (options.brandedMigrations) {
      const brandedMigDir = join(tempRoot, 'scripts/migrations');
      mkdirSync(brandedMigDir, { recursive: true });
      for (let i = 1; i <= options.brandedMigrations.forwardCount; i++) {
        const seq = String(i).padStart(3, '0');
        writeFileSync(
          join(brandedMigDir, `${seq}-branded-table-${seq}.sql`),
          `CREATE INDEX IF NOT EXISTS idx_branded_${seq} ON orders(id);\n`
        );
        if (i <= options.brandedMigrations.downCount) {
          writeFileSync(
            join(brandedMigDir, `${seq}-branded-table-${seq}.down.sql`),
            `DROP INDEX IF EXISTS idx_branded_${seq};\n`
          );
        }
      }
    }

    if (options.operatorMigrations) {
      const operatorMigDir = join(tempRoot, 'db/migrations');
      mkdirSync(operatorMigDir, { recursive: true });
      for (let i = 1; i <= options.operatorMigrations.forwardCount; i++) {
        const seq = String(i).padStart(2, '0');
        writeFileSync(
          join(operatorMigDir, `20261001_${seq}_operator_${seq}.sql`),
          `CREATE INDEX IF NOT EXISTS idx_operator_${seq} ON orders(id);\n`
        );
        if (i <= options.operatorMigrations.downCount) {
          writeFileSync(
            join(operatorMigDir, `20261001_${seq}_operator_${seq}.down.sql`),
            `DROP INDEX IF EXISTS idx_operator_${seq};\n`
          );
        }
      }
    }

    const srcFile = join(srcDir, 'main.tsx');
    const publicFile = join(publicDir, 'manifest.json');
    const distIndex = join(tempRoot, 'dist/index.html');
    const distJs = join(distAssetsDir, 'index-abc123.js');

    writeFileSync(srcFile, 'console.log("app");\n');
    writeFileSync(publicFile, '{"name":"AURA"}\n');
    writeFileSync(distIndex, '<!doctype html><html></html>\n');
    writeFileSync(distJs, 'console.log("bundle");\n');

    const baseTimeSec = Math.floor(Date.now() / 1000) - 3600;
    if (options.staleBuild) {
      utimesSync(publicFile, baseTimeSec, baseTimeSec);
      utimesSync(distIndex, baseTimeSec, baseTimeSec);
      utimesSync(distJs, baseTimeSec, baseTimeSec);
      utimesSync(srcFile, baseTimeSec + 3000, baseTimeSec + 3000);
    } else if (options.stalePublicAsset) {
      utimesSync(srcFile, baseTimeSec, baseTimeSec);
      utimesSync(distIndex, baseTimeSec + 1500, baseTimeSec + 1500);
      utimesSync(distJs, baseTimeSec + 1500, baseTimeSec + 1500);
      utimesSync(publicFile, baseTimeSec + 3000, baseTimeSec + 3000);
    } else {
      utimesSync(srcFile, baseTimeSec, baseTimeSec);
      utimesSync(publicFile, baseTimeSec, baseTimeSec);
      utimesSync(distIndex, baseTimeSec + 3000, baseTimeSec + 3000);
      utimesSync(distJs, baseTimeSec + 3000, baseTimeSec + 3000);
    }

    return tempRoot;
  }

  it('fails GATE_2_BUNDLE_BUILD when dist/ artifacts are older than src/ files', () => {
    const tempRoot = setupTempRepoFixture({
      forwardCount: 2,
      downCount: 2,
      staleBuild: true,
    });
    try {
      const report = evaluateGoLiveGates({}, tempRoot);
      const gate2 = report.gates.find((g: any) => g.id === 'GATE_2_BUNDLE_BUILD')!;
      expect(gate2.passed).toBe(false);
      expect(gate2.detail).toContain('Stale dist/ build artifacts');
      expect(gate2.detail).toContain('src');
      expect(report.localGatesPassed).toBe(false);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('fails GATE_2_BUNDLE_BUILD when a public/ asset is modified after dist/ was built', () => {
    const tempRoot = setupTempRepoFixture({
      forwardCount: 2,
      downCount: 2,
      staleBuild: false,
      stalePublicAsset: true,
    });
    try {
      const report = evaluateGoLiveGates({}, tempRoot);
      const gate2 = report.gates.find((g: any) => g.id === 'GATE_2_BUNDLE_BUILD')!;
      expect(gate2.passed).toBe(false);
      expect(gate2.detail).toContain('Stale dist/ build artifacts');
      expect(gate2.detail).toContain('public');
      expect(report.localGatesPassed).toBe(false);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('fails GATE_3_ROLLBACK_READINESS when rollback script is missing (missing state)', () => {
    const tempRoot = setupTempRepoFixture({
      forwardCount: 2,
      downCount: 2,
      staleBuild: false,
      rollbackScriptMode: 'missing',
    });
    try {
      const report = evaluateGoLiveGates({}, tempRoot);
      const gate3 = report.gates.find((g: any) => g.id === 'GATE_3_ROLLBACK_READINESS')!;
      expect(report.rollbackCapabilities).toEqual({
        scriptExists: false,
        evidenceLevel: 'static_script_inspection',
        runtimeVerified: false,
        pages: 'script_missing',
        worker: 'script_missing',
        d1: 'script_missing',
        allStaticCommandsPresent: false,
      });
      expect(report.migrationRollbackCoverage.passed).toBe(true);
      expect(gate3.passed).toBe(false);
      expect(gate3.detail).toContain('Missing rollback script (scripts/deploy-rollback.sh)');
      expect(gate3.detail).toContain('pages=script_missing, worker=script_missing, d1=script_missing');
      expect(report.localGatesPassed).toBe(false);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('fails GATE_3_ROLLBACK_READINESS when deploy-rollback.sh only references Pages rollback even if safe .down.sql coverage is 100% (unreferenced Worker/D1 state)', () => {
    const tempRoot = setupTempRepoFixture({
      forwardCount: 2,
      downCount: 2,
      staleBuild: false,
      rollbackScriptMode: 'pages-only',
    });
    try {
      const report = evaluateGoLiveGates({}, tempRoot);
      const gate3 = report.gates.find((g: any) => g.id === 'GATE_3_ROLLBACK_READINESS')!;
      expect(report.rollbackCapabilities).toEqual({
        scriptExists: true,
        evidenceLevel: 'static_script_inspection',
        runtimeVerified: false,
        pages: 'static_command_detected',
        worker: 'unreferenced',
        d1: 'unreferenced',
        allStaticCommandsPresent: false,
      });
      // Safe migration file coverage is 100%, but static rollback commands for Worker & D1 are unreferenced
      expect(report.migrationRollbackCoverage.fileCoveragePassed).toBe(true);
      expect(report.migrationRollbackCoverage.safeReversibilityPassed).toBe(true);
      expect(report.migrationRollbackCoverage.passed).toBe(true);
      expect(gate3.passed).toBe(false);
      expect(gate3.detail).toContain(
        'Incomplete static rollback script coverage (worker, d1 rollback command unreferenced in scripts/deploy-rollback.sh; evidence=static_script_inspection, runtimeVerified=false; pages=static_command_detected, worker=unreferenced, d1=unreferenced)'
      );
      expect(gate3.detail).toContain(
        'Safe reversible migration files ready on selected target(s): 2/2 safely reversible'
      );
      expect(report.localGatesPassed).toBe(false);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('fails GATE_3_ROLLBACK_READINESS when selected target lacks 1:1 .down.sql companions even if static rollback script references all layers', () => {
    const tempRoot = setupTempRepoFixture({
      forwardCount: 3,
      downCount: 1,
      staleBuild: false,
      rollbackScriptMode: 'full',
    });
    try {
      const report = evaluateGoLiveGates({}, tempRoot);
      const gate3 = report.gates.find((g: any) => g.id === 'GATE_3_ROLLBACK_READINESS')!;
      expect(report.rollbackCapabilities.allStaticCommandsPresent).toBe(true);
      expect(report.rollbackCapabilities.runtimeVerified).toBe(false);
      expect(report.migrationRollbackCoverage.fileCoveragePassed).toBe(false);
      expect(report.migrationRollbackCoverage.passed).toBe(false);
      expect(gate3.passed).toBe(false);
      expect(gate3.detail).toContain(
        'Incomplete migration rollback readiness on selected target(s): 1/3 .down.sql files present (2 missing), 1/3 safely reversible without data-loss/schema-drift hazards'
      );
      expect(gate3.detail).toContain(
        'worker/db/migrations [primary-worker-d1, blocking/active]: 1/3 .down.sql files (1/3 safely reversible, 0 with hazards, 2 missing)'
      );
      expect(report.localGatesPassed).toBe(false);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('distinguishes .down.sql file presence from safe migration content reversibility (blocks destructive DROP TABLE and incomplete column reversal)', () => {
    // 1. 100% .down.sql file presence, but .down.sql drops tables (data-loss hazard)
    const destructiveRoot = setupTempRepoFixture({
      forwardCount: 2,
      downCount: 2,
      staleBuild: false,
      rollbackScriptMode: 'full',
      migrationStyle: 'destructive-drop-table',
    });
    try {
      const report = evaluateGoLiveGates({}, destructiveRoot);
      const gate3 = report.gates.find((g: any) => g.id === 'GATE_3_ROLLBACK_READINESS')!;
      expect(report.migrationRollbackCoverage.fileCoveragePassed).toBe(true);
      expect(report.migrationRollbackCoverage.safeReversibilityPassed).toBe(false);
      expect(report.migrationRollbackCoverage.passed).toBe(false);
      expect(report.migrationRollbackCoverage.blockingDownCount).toBe(2);
      expect(report.migrationRollbackCoverage.blockingSafeReversibleCount).toBe(0);
      expect(report.migrationRollbackCoverage.blockingUnsafeDownCount).toBe(2);
      expect(gate3.passed).toBe(false);
      expect(gate3.detail).toContain('2/2 .down.sql files present (0 missing)');
      expect(gate3.detail).toContain('0/2 safely reversible without data-loss/schema-drift hazards');
      expect(gate3.detail).toContain('down_drops_table_data_loss_risk');
    } finally {
      rmSync(destructiveRoot, { recursive: true, force: true });
    }

    // 2. 100% .down.sql file presence, but forward migration adds a column that .down.sql does not reverse
    const incompleteRoot = setupTempRepoFixture({
      forwardCount: 1,
      downCount: 1,
      staleBuild: false,
      rollbackScriptMode: 'full',
      migrationStyle: 'incomplete-add-column',
    });
    try {
      const report = evaluateGoLiveGates({}, incompleteRoot);
      const gate3 = report.gates.find((g: any) => g.id === 'GATE_3_ROLLBACK_READINESS')!;
      expect(report.migrationRollbackCoverage.fileCoveragePassed).toBe(true);
      expect(report.migrationRollbackCoverage.safeReversibilityPassed).toBe(false);
      expect(report.migrationRollbackCoverage.passed).toBe(false);
      expect(gate3.passed).toBe(false);
      expect(gate3.detail).toContain('incomplete_down_missing_column_reversal');
    } finally {
      rmSync(incompleteRoot, { recursive: true, force: true });
    }
  });

  it('rejects false positives (echo, printf, inline comments, heredocs, dead branches, uncalled functions, post-exit code) and resolves false negatives (shell variables, wrapper functions, global flags) in inspectRollbackCapabilities', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'aura-rollback-parser-'));
    try {
      // 1. False-positive trap script: contains all 3 command strings, but ONLY in non-executing contexts
      const falsePositiveScript = join(tempDir, 'false-positive-rollback.sh');
      writeFileSync(
        falsePositiveScript,
        `#!/bin/bash
# wrangler pages rollback "$1"
echo "To rollback worker: npx wrangler rollback $1"
printf "To rollback d1: npx wrangler d1 time-travel restore fnb-caffe-db --timestamp=now\\n"
true # npx wrangler rollback "$1"

cat <<'EOF'
npx wrangler pages rollback "$1" --project-name aura-cafe
npx wrangler rollback "$1"
npx wrangler d1 execute fnb-caffe-db --file="worker/db/migrations/20261001_01_init.down.sql"
EOF

if false; then
  npx wrangler pages rollback "$1" --project-name aura-cafe
  npx wrangler rollback "$1"
  npx wrangler d1 time-travel restore fnb-caffe-db --timestamp="2026-10-01T00:00:00Z"
fi

if [ 0 -eq 1 ]; then
  npx wrangler rollback "$1"
fi

if true; then
  echo "active branch without rollback"
else
  npx wrangler d1 time-travel restore fnb-caffe-db --timestamp="2026-10-01T00:00:00Z"
fi

while false; do
  npx wrangler pages rollback "$1"
done

never_called_helper() {
  npx wrangler pages rollback "$1" --project-name aura-cafe
  npx wrangler rollback "$1"
  npx wrangler d1 time-travel restore fnb-caffe-db --timestamp="2026-10-01T00:00:00Z"
}

exit 0
npx wrangler pages rollback "$1" --project-name aura-cafe
npx wrangler rollback "$1"
npx wrangler d1 time-travel restore fnb-caffe-db --timestamp="2026-10-01T00:00:00Z"
`
      );

      expect(inspectRollbackCapabilities(falsePositiveScript)).toEqual({
        scriptExists: true,
        evidenceLevel: 'static_script_inspection',
        runtimeVerified: false,
        pages: 'unreferenced',
        worker: 'unreferenced',
        d1: 'unreferenced',
        allStaticCommandsPresent: false,
      });

      // 2. False-negative script: uses shell variables, parameter fallback, wrapper function, and --config flags
      const variableAndWrapperScript = join(tempDir, 'var-wrapper-rollback.sh');
      writeFileSync(
        variableAndWrapperScript,
        `#!/bin/bash
WRANGLER_CMD="\${WRANGLER_BIN:-npx wrangler}"
ACCOUNT_ID="\${ACCOUNT_ID:-account}"
PROJECT_NAME="\${PROJECT_NAME:-project}"

run_wrangler() {
  $WRANGLER_CMD --config worker/wrangler.toml "$@"
}

rollback_pages() {
  curl --fail --silent --request POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects/$PROJECT_NAME/deployments/$1/rollback"
}

if [ -z "$1" ]; then
  echo "Missing deployment id"
  exit 0
fi

rollback_pages "$1"
run_wrangler rollback "$1"
run_wrangler d1 time-travel restore fnb-caffe-db --bookmark "$1" --config worker/wrangler.toml
`
      );

      expect(inspectRollbackCapabilities(variableAndWrapperScript)).toEqual({
        scriptExists: true,
        evidenceLevel: 'static_script_inspection',
        runtimeVerified: false,
        pages: 'static_command_detected',
        worker: 'static_command_detected',
        d1: 'static_command_detected',
        allStaticCommandsPresent: true,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('executes a copy of scripts/deploy-rollback.sh in an isolated temp workspace with mocked external binaries and zero network calls', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'aura-rollback-sim-'));
    try {
      const mockBinDir = join(tempDir, 'mock-bin');
      const scriptsDir = join(tempDir, 'scripts');
      const logFile = join(tempDir, 'rollback-invocations.log');
      mkdirSync(mockBinDir, { recursive: true });
      mkdirSync(scriptsDir, { recursive: true });

      const rollbackCopy = join(scriptsDir, 'deploy-rollback.sh');
      copyFileSync(resolve(REPO_ROOT, 'scripts/deploy-rollback.sh'), rollbackCopy);
      chmodSync(rollbackCopy, 0o755);

      const writeMock = (name: string, body: string) => {
        const p = join(mockBinDir, name);
        writeFileSync(p, body);
        chmodSync(p, 0o755);
      };

      writeMock(
        'wrangler',
        `#!/bin/sh
echo "wrangler $*" >> "$MOCK_ROLLBACK_LOG"
exit 0
`
      );
      writeMock(
        'npx',
        `#!/bin/sh
if [ "$1" = "wrangler" ]; then
  shift
  exec "${mockBinDir}/wrangler" "$@"
fi
echo "npx $*" >> "$MOCK_ROLLBACK_LOG"
exit 0
`
      );
      writeMock(
        'curl',
        `#!/bin/sh
echo "curl $*" >> "$MOCK_ROLLBACK_LOG"
out=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "--output" ]; then out="$arg"; fi
  prev="$arg"
done
if [ -n "$out" ]; then
  printf '{"success":true,"result":{"id":"%s"}}' "$MOCK_ROLLBACK_ID" > "$out"
fi
exit 0
`
      );

      const accountId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const deploymentId = '12345678-1234-4321-abcd-123456789abc';
      const env = {
        ...process.env,
        PATH: `${mockBinDir}:${process.env.PATH}`,
        MOCK_ROLLBACK_LOG: logFile,
        MOCK_ROLLBACK_ID: deploymentId,
        CLOUDFLARE_ACCOUNT_ID: accountId,
        CLOUDFLARE_API_TOKEN: 'mock-token-for-gate-test',
      };

      // 1. Without argument: lists Pages deployments and exits 0 without rolling back
      writeFileSync(logFile, '');
      execFileSync('bash', [rollbackCopy], { cwd: tempDir, env, stdio: 'pipe' });
      const noArgCalls = readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
      expect(noArgCalls).toEqual(['wrangler pages deployment list --project-name fnb-caffe-container']);

      // 2. With a deployment UUID: Pages rollback goes through the REST API and the
      //    confirmed response is parsed, so a single curl call must carry the bearer
      //    credentials and nothing else is invoked for the pages target.
      writeFileSync(logFile, '');
      execFileSync('bash', [rollbackCopy, deploymentId], {
        cwd: tempDir,
        env,
        stdio: 'pipe',
      });
      const argCalls = readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
      expect(argCalls).toHaveLength(1);
      expect(argCalls[0]).toContain('--request POST');
      expect(argCalls[0]).toContain(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/fnb-caffe-container/deployments/${deploymentId}/rollback`
      );
      expect(argCalls[0]).toContain('Authorization: Bearer mock-token-for-gate-test');
      expect(argCalls.some((line) => /^wrangler (?:rollback|d1)\b/.test(line))).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('keeps optional migration directories non-blocking by default, blocks when explicitly selected, and blocks when selected target has Unknown activation status', () => {
    const tempRoot = setupTempRepoFixture({
      forwardCount: 2,
      downCount: 2,
      staleBuild: false,
      rollbackScriptMode: 'full',
      brandedMigrations: { forwardCount: 2, downCount: 0 },
      operatorMigrations: { forwardCount: 1, downCount: 1 },
    });
    try {
      // 1. Default deployment target (primary-worker-d1): optional directories are inventoried but do NOT block
      const defaultReport = evaluateGoLiveGates({}, tempRoot);
      const defaultGate3 = defaultReport.gates.find((g: any) => g.id === 'GATE_3_ROLLBACK_READINESS')!;
      expect(defaultGate3.passed).toBe(true);
      expect(defaultReport.localGatesPassed).toBe(true);
      expect(defaultGate3.detail).toContain(
        'non-blocking inventory: scripts/migrations [branded-instance-d1, optional/conditional]: 0/2 .down.sql files (0/2 safely reversible, 2 missing)'
      );

      // 2. Explicitly selecting branded-instance-d1 makes scripts/migrations blocking and fails on 0/2 .down.sql
      const brandedReport = evaluateGoLiveGates({}, tempRoot, {
        targetIds: ['branded-instance-d1'],
      });
      const brandedGate3 = brandedReport.gates.find((g: any) => g.id === 'GATE_3_ROLLBACK_READINESS')!;
      expect(brandedGate3.passed).toBe(false);
      expect(brandedGate3.detail).toContain(
        'scripts/migrations [branded-instance-d1, blocking/conditional]: 0/2 .down.sql files (0/2 safely reversible, 0 with hazards, 2 missing)'
      );

      // 3. Explicitly selecting operator-runbook-d1 (activationStatus: 'unknown') blocks even with 1/1 .down.sql
      const unknownReport = evaluateGoLiveGates({}, tempRoot, {
        targetIds: ['operator-runbook-d1'],
      });
      const unknownGate3 = unknownReport.gates.find((g: any) => g.id === 'GATE_3_ROLLBACK_READINESS')!;
      expect(unknownGate3.passed).toBe(false);
      expect(unknownGate3.detail).toContain(
        'Selected target activation status is Unknown (db/migrations)'
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('reports current static rollback detection and incomplete primary migration coverage', () => {
    const capabilities = inspectRollbackCapabilities(
      resolve(REPO_ROOT, 'scripts/deploy-rollback.sh')
    );
    expect(capabilities).toEqual({
      scriptExists: true,
      evidenceLevel: 'static_script_inspection',
      runtimeVerified: false,
      pages: 'static_command_detected',
      worker: 'static_command_detected',
      d1: 'static_command_detected',
      allStaticCommandsPresent: true,
    });

    const report = evaluateGoLiveGates({}, REPO_ROOT);
    const gate3 = report.gates.find((g: any) => g.id === 'GATE_3_ROLLBACK_READINESS')!;
    expect(gate3.passed).toBe(false);
    expect(report.rollbackCoverageByTarget.map((t: any) => ({
      directory: t.directory,
      required: t.required,
      blocking: t.blocking,
      activationStatus: t.activationStatus,
      forwardCount: t.forwardCount,
      downCount: t.downCount,
      missingDownCount: t.missingDownCount,
      safeReversibleCount: t.safeReversibleCount,
      unsafeDownCount: t.unsafeDownCount,
      fileCoverageComplete: t.fileCoverageComplete,
      safeReversibilityComplete: t.safeReversibilityComplete,
      complete: t.complete,
    }))).toEqual([
      {
        directory: 'worker/db/migrations',
        required: true,
        blocking: true,
        activationStatus: 'active',
        forwardCount: 58,
        downCount: 16,
        missingDownCount: 42,
        safeReversibleCount: 0,
        unsafeDownCount: 16,
        fileCoverageComplete: false,
        safeReversibilityComplete: false,
        complete: false,
      },
      {
        directory: 'scripts/migrations',
        required: false,
        blocking: false,
        activationStatus: 'conditional',
        forwardCount: 7,
        downCount: 0,
        missingDownCount: 7,
        safeReversibleCount: 0,
        unsafeDownCount: 0,
        fileCoverageComplete: false,
        safeReversibilityComplete: false,
        complete: false,
      },
      {
        directory: 'db/migrations',
        required: false,
        blocking: false,
        activationStatus: 'unknown',
        forwardCount: 9,
        downCount: 0,
        missingDownCount: 9,
        safeReversibleCount: 0,
        unsafeDownCount: 0,
        fileCoverageComplete: false,
        safeReversibilityComplete: false,
        complete: false,
      },
      {
        directory: 'worker/migrations',
        required: false,
        blocking: false,
        activationStatus: 'unknown',
        forwardCount: 11,
        downCount: 0,
        missingDownCount: 11,
        safeReversibleCount: 0,
        unsafeDownCount: 0,
        fileCoverageComplete: false,
        safeReversibilityComplete: false,
        complete: false,
      },
    ]);
    expect(gate3.detail).toContain(
      'Static rollback commands detected (pages=static_command_detected, worker=static_command_detected, d1=static_command_detected; evidence=static_script_inspection, runtimeVerified=false)'
    );
    expect(gate3.detail).toContain(
      'Incomplete migration rollback readiness on selected target(s): 16/58 .down.sql files present (42 missing), 0/58 safely reversible without data-loss/schema-drift hazards (16 existing .down.sql flagged'
    );
  });
});

describe('Priority 3: Migration Source of Truth, Multi-Directory Linting & Simulated Wrangler Deploy Execution', () => {
  it('validates all 4 migration directories in the repository via lintAllMigrationDirectories', () => {
    const result = lintAllMigrationDirectories(REPO_ROOT);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.directories.map((d: any) => d.name)).toEqual([
      'worker/db/migrations',
      'db/migrations',
      'scripts/migrations',
      'worker/migrations',
    ]);

    const canonicalDir = lintMigrationsDirectory(resolve(REPO_ROOT, 'worker/db/migrations'));
    expect(canonicalDir.forwardCount).toBe(58);
    expect(canonicalDir.downCount).toBe(16);
    expect(canonicalDir.missingDownCount).toBe(42);
  });

  it('enforces fail-closed migration execution in deploy-cloudflare.sh, worker/scripts/apply-migrations.sh, and scripts/deploy-branded.sh (default deploy runs zero D1 commands; migration runner requires explicit forward migration selection)', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'aura-deploy-sim-'));
    try {
      const mockBinDir = join(tempRoot, 'mock-bin');
      const workerScriptsDir = join(tempRoot, 'worker/scripts');
      const workerMigrationsDir = join(tempRoot, 'worker/db/migrations');
      const scriptsDir = join(tempRoot, 'scripts');
      const brandedMigrationsDir = join(tempRoot, 'scripts/migrations');
      const distDir = join(tempRoot, 'dist');

      mkdirSync(mockBinDir, { recursive: true });
      mkdirSync(workerScriptsDir, { recursive: true });
      mkdirSync(workerMigrationsDir, { recursive: true });
      mkdirSync(scriptsDir, { recursive: true });
      mkdirSync(brandedMigrationsDir, { recursive: true });
      mkdirSync(distDir, { recursive: true });

      // Copy actual repository deploy scripts into the isolated temp workspace
      copyFileSync(
        resolve(REPO_ROOT, 'deploy-cloudflare.sh'),
        join(tempRoot, 'deploy-cloudflare.sh')
      );
      copyFileSync(
        resolve(REPO_ROOT, 'worker/scripts/apply-migrations.sh'),
        join(workerScriptsDir, 'apply-migrations.sh')
      );
      copyFileSync(
        resolve(REPO_ROOT, 'scripts/deploy-branded.sh'),
        join(scriptsDir, 'deploy-branded.sh')
      );

      // Minimal config files required by deploy-branded.sh so it runs non-interactively
      writeFileSync(join(tempRoot, '.env'), 'NODE_ENV=test\n');
      writeFileSync(
        join(tempRoot, 'worker/wrangler.toml'),
        'name = "aura-worker"\nCORS_ORIGIN = "https://auraspace.cafe"\n'
      );

      // Populate worker/db/migrations with forward, rollback (.down.sql), and superseded migrations
      const workerMigrationFiles = [
        '20260706_11_notifications_push_loyalty.sql',
        '20260824_02_users_table.sql',
        '20261001_01_init.sql',
        '20261001_01_init.down.sql',
        '20261002_01_orders.sql',
        '20261002_01_orders.down.sql',
      ];
      for (const file of workerMigrationFiles) {
        writeFileSync(join(workerMigrationsDir, file), '-- test sql\n');
      }

      // Populate scripts/migrations with forward and rollback (.down.sql) migrations
      const brandedMigrationFiles = [
        '001-init.sql',
        '001-init.down.sql',
        '002-orders.sql',
        '002-orders.down.sql',
      ];
      for (const file of brandedMigrationFiles) {
        writeFileSync(join(brandedMigrationsDir, file), '-- branded test sql\n');
      }

      // Create offline mock binaries (wrangler, npx, npm, git) that log d1 execute invocations without network calls
      const mockWranglerScript = `#!/usr/bin/env bash
if [[ "$1" == "whoami" || "$1" == "--version" ]]; then
  echo "mock-wrangler 3.99.0"
  exit 0
fi
if [[ "$1" == "d1" && "$2" == "execute" ]]; then
  echo "$*" >> "$MOCK_WRANGLER_LOG"
  exit 0
fi
echo "mock-wrangler ok: $*"
exit 0
`;
      writeFileSync(join(mockBinDir, 'wrangler'), mockWranglerScript);
      chmodSync(join(mockBinDir, 'wrangler'), 0o755);

      const mockNpxScript = `#!/usr/bin/env bash
if [[ "$1" == "--no-install" ]]; then
  shift
fi
if [[ "$1" == "wrangler" ]]; then
  shift
  exec "${join(mockBinDir, 'wrangler')}" "$@"
fi
if [[ "$1" == "vite" ]]; then
  mkdir -p dist
  exit 0
fi
exit 0
`;
      writeFileSync(join(mockBinDir, 'npx'), mockNpxScript);
      chmodSync(join(mockBinDir, 'npx'), 0o755);

      writeFileSync(join(mockBinDir, 'npm'), '#!/usr/bin/env bash\nexit 0\n');
      chmodSync(join(mockBinDir, 'npm'), 0o755);

      writeFileSync(
        join(mockBinDir, 'git'),
        '#!/usr/bin/env bash\necho "a8190d5af9b374e40d7e7df833616be1f123b49f"\nexit 0\n'
      );
      chmodSync(join(mockBinDir, 'git'), 0o755);

      const baseEnv = {
        ...process.env,
        PATH: `${mockBinDir}:${process.env.PATH}`,
      };

      const readInvocations = (logPath: string) =>
        readFileSync(logPath, 'utf8')
          .trim()
          .split('\n')
          .filter(Boolean);

      // 1. Default deploy-cloudflare.sh MUST NOT invoke any wrangler d1 execute commands
      const cloudflareDefaultLog = join(tempRoot, 'deploy-cloudflare-default.log');
      writeFileSync(cloudflareDefaultLog, '');
      execFileSync(
        'bash',
        [join(tempRoot, 'deploy-cloudflare.sh'), '--worker-only', '--skip-tests', '--skip-verify'],
        {
          cwd: tempRoot,
          env: { ...baseEnv, MOCK_WRANGLER_LOG: cloudflareDefaultLog },
        }
      );
      expect(readInvocations(cloudflareDefaultLog)).toEqual([]);

      // 2. Default scripts/deploy-branded.sh MUST NOT invoke any wrangler d1 execute commands
      const brandedDefaultLog = join(tempRoot, 'deploy-branded-default.log');
      writeFileSync(brandedDefaultLog, '');
      execFileSync(
        'bash',
        [
          join(scriptsDir, 'deploy-branded.sh'),
          'test-client',
          'test.example.com',
          '--skip-tests',
          '--skip-verify',
        ],
        {
          cwd: tempRoot,
          env: { ...baseEnv, MOCK_WRANGLER_LOG: brandedDefaultLog },
        }
      );
      expect(readInvocations(brandedDefaultLog)).toEqual([]);

      // 3. Fail-closed checks: unscoped/bulk calls, *.down.sql, superseded files, wildcards, and path traversal MUST fail with 0 D1 calls
      const failClosedLog = join(tempRoot, 'fail-closed.log');
      writeFileSync(failClosedLog, '');
      const failClosedCases: Array<[string, string[]]> = [
        [join(workerScriptsDir, 'apply-migrations.sh'), []],
        [join(workerScriptsDir, 'apply-migrations.sh'), ['--remote']],
        [join(workerScriptsDir, 'apply-migrations.sh'), ['--all']],
        [join(workerScriptsDir, 'apply-migrations.sh'), ['--file', '20261001_01_init.down.sql']],
        [
          join(workerScriptsDir, 'apply-migrations.sh'),
          ['--file', '20260706_11_notifications_push_loyalty.sql'],
        ],
        [join(workerScriptsDir, 'apply-migrations.sh'), ['--file', '20260824_02_users_table.sql']],
        [join(workerScriptsDir, 'apply-migrations.sh'), ['--file', '*.sql']],
        [
          join(workerScriptsDir, 'apply-migrations.sh'),
          ['--file', '../scripts/migrations/001-init.sql'],
        ],
        [
          join(workerScriptsDir, 'apply-migrations.sh'),
          ['--file', 'worker/db/migrations/db/migrations/20261001_01_init.sql'],
        ],
        [join(workerScriptsDir, 'apply-migrations.sh'), ['--file', 'schema.sql']],
        [
          join(workerScriptsDir, 'apply-migrations.sh'),
          ['--file', '20261001_01_init.sql', '--file', '20261001_01_init.sql'],
        ],
        [
          join(tempRoot, 'deploy-cloudflare.sh'),
          [
            '--worker-only',
            '--skip-tests',
            '--skip-verify',
            '--migration-file=20261001_01_init.sql',
            '--migration-file=20261001_01_init.sql',
          ],
        ],
        [
          join(tempRoot, 'deploy-cloudflare.sh'),
          ['--worker-only', '--skip-tests', '--skip-verify', '--apply-migrations'],
        ],
        [
          join(tempRoot, 'deploy-cloudflare.sh'),
          [
            '--worker-only',
            '--skip-tests',
            '--skip-verify',
            '--migration-file=20261001_01_init.down.sql',
          ],
        ],
        [
          join(tempRoot, 'deploy-cloudflare.sh'),
          [
            '--worker-only',
            '--skip-tests',
            '--skip-verify',
            '--migration-file=20260706_11_notifications_push_loyalty.sql',
          ],
        ],
        [
          join(scriptsDir, 'deploy-branded.sh'),
          ['test-client', 'test.example.com', '--skip-tests', '--skip-verify', '--apply-migrations'],
        ],
        [
          join(scriptsDir, 'deploy-branded.sh'),
          [
            'test-client',
            'test.example.com',
            '--skip-tests',
            '--skip-verify',
            '--migration-file=20260824_02_users_table.sql',
          ],
        ],
      ];

      for (const [scriptPath, args] of failClosedCases) {
        expect(() =>
          execFileSync('bash', [scriptPath, ...args], {
            cwd: tempRoot,
            env: { ...baseEnv, MOCK_WRANGLER_LOG: failClosedLog },
            stdio: 'pipe',
          })
        ).toThrow();
      }
      expect(readInvocations(failClosedLog)).toEqual([]);

      // 4. Explicit selection on worker/scripts/apply-migrations.sh runs ONLY the specified forward migrations
      const applyLog = join(tempRoot, 'apply-migrations.log');
      writeFileSync(applyLog, '');
      execFileSync(
        'bash',
        [
          join(workerScriptsDir, 'apply-migrations.sh'),
          '--file',
          '20261001_01_init.sql',
          '--file=20261002_01_orders.sql',
        ],
        {
          cwd: tempRoot,
          env: { ...baseEnv, MOCK_WRANGLER_LOG: applyLog },
        }
      );
      const applyExecuted = readInvocations(applyLog);
      expect(applyExecuted).toHaveLength(2);
      expect(applyExecuted[0]).toContain('20261001_01_init.sql');
      expect(applyExecuted[1]).toContain('20261002_01_orders.sql');
      expect(applyExecuted.some((line) => line.includes('.down.sql'))).toBe(false);
      expect(applyExecuted.some((line) => line.includes('20260706_11'))).toBe(false);
      expect(applyExecuted.some((line) => line.includes('20260824_02'))).toBe(false);

      // 5. Explicit --migration-file on deploy-cloudflare.sh runs ONLY that single migration
      const cloudflareExplicitLog = join(tempRoot, 'deploy-cloudflare-explicit.log');
      writeFileSync(cloudflareExplicitLog, '');
      execFileSync(
        'bash',
        [
          join(tempRoot, 'deploy-cloudflare.sh'),
          '--worker-only',
          '--skip-tests',
          '--skip-verify',
          '--migration-file=20261002_01_orders.sql',
        ],
        {
          cwd: tempRoot,
          env: { ...baseEnv, MOCK_WRANGLER_LOG: cloudflareExplicitLog },
        }
      );
      const cloudflareExecuted = readInvocations(cloudflareExplicitLog);
      expect(cloudflareExecuted).toHaveLength(1);
      expect(cloudflareExecuted[0]).toContain('20261002_01_orders.sql');

      // 6. Explicit --migration-file on scripts/deploy-branded.sh runs ONLY that single canonical migration
      const brandedExplicitLog = join(tempRoot, 'deploy-branded-explicit.log');
      writeFileSync(brandedExplicitLog, '');
      execFileSync(
        'bash',
        [
          join(scriptsDir, 'deploy-branded.sh'),
          'test-client',
          'test.example.com',
          '--skip-tests',
          '--skip-verify',
          '--migration-file=20261001_01_init.sql',
        ],
        {
          cwd: tempRoot,
          env: { ...baseEnv, MOCK_WRANGLER_LOG: brandedExplicitLog },
        }
      );
      const brandedExecuted = readInvocations(brandedExplicitLog);
      expect(brandedExecuted).toHaveLength(1);
      expect(brandedExecuted[0]).toContain('worker/db/migrations/20261001_01_init.sql');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 30000);
});
