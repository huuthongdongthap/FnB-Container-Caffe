// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const tenant = '20261115_01_tenant_unique_constraints_and_indexes.sql';
const loyalty = '20261118_01_orders_loyalty_points_redeemed.sql';
const legacy = '20261001_01_init.sql';
const runner = 'worker/scripts/apply-migrations.sh';
const migration = (file: string) => readFileSync(resolve('worker/db/migrations', file), 'utf8');
const tenantSql = migration(tenant);
const loyaltySql = migration(loyalty);
// Only the argv/transport layer is substituted. Both schema discovery and file imports use SQLite.
const wrangler = `#!/usr/bin/env node
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const args = process.argv.slice(2);
fs.appendFileSync('calls', JSON.stringify(args) + '\\n');
if (args[0] === 'whoami') process.exit(0);
if (args.slice(0, 5).join(' ') === 'd1 execute fnb-caffe-db --remote --json' && args[5] === '--command') {
  const db = new DatabaseSync('fixture.sqlite', { readOnly: true });
  const results = db.prepare(args[6]).all();
  switch (process.env.FAILURE) {
    case 'query': process.exit(2);
    case 'json': console.log('{'); process.exit(0);
    case 'failed-result': console.log(JSON.stringify([{ success: false, results }])); process.exit(0);
    case 'missing-row': results.pop(); break;
    case 'missing-field': delete results[0].sql; break;
  }
  console.log(JSON.stringify([{ success: true, results }]));
} else if (args.slice(0, 5).join(' ') === 'd1 execute fnb-caffe-db --remote --file' && args[6] === '--yes') {
  const sql = fs.readFileSync(args[5]);
  fs.appendFileSync('imported.sql', sql);
  if (process.env.FAILURE === 'write') process.exit(3);
  const db = new DatabaseSync('fixture.sqlite');
  db.exec('BEGIN; ' + sql + '\\nCOMMIT;');
} else process.exit(4);
`;

function bootstrap(sqlite: DatabaseSync, orders = 'id TEXT, tenant_id TEXT, created_at TEXT, table_id TEXT') {
  const tables = {
    orders,
    staff_devices: 'staff_id, is_active',
    payments: 'tenant_id, order_id, status, transaction_id',
    loyalty_transactions: 'idempotency_key, customer_id, created_at',
    loyalty_point_logs: 'customer_id, created_at',
    inventory_transactions: 'reference_type, reference_id, item_id, type',
    stock_movements: 'ingredient_id, created_at',
    waste_log: 'created_at',
    erpnext_mappings: 'aura_order_id, sync_status',
    consents: 'customer_id, purpose',
    customers: 'id',
    sessions: 'id',
    table_sessions: 'table_id, status',
    promotion_usages: 'tenant_id, idempotency_key',
    reservations: 'tenant_id, table_id, date, time, status, reservation_date, reservation_time',
    cafe_tables: 'status, zone',
    promotions: 'tenant_id, is_active',
    staff_shifts: 'clock_out, staff_email',
    users: 'phone',
  };
  for (const [table, columns] of Object.entries(tables)) {
    sqlite.exec(`CREATE TABLE ${table} (${columns})`);
  }
}

describe('explicit D1 migration resume', () => {
  let root: string;
  let worker: string;
  let db: DatabaseSync;
  let migrations: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'apply-resume-test-'));
    worker = join(root, 'worker');
    migrations = join(worker, 'db/migrations');
    mkdirSync(migrations, { recursive: true });
    mkdirSync(join(worker, 'scripts'));
    mkdirSync(join(root, 'bin'));
    for (const file of [runner, 'worker/scripts/prepare-migration-resume.mjs', ...[tenant, loyalty].map(f => `worker/db/migrations/${f}`)]) {
      copyFileSync(resolve(file), join(root, file));
    }
    for (const file of [legacy, '20260824_02_users_table.sql', tenant.replace('.sql', '.down.sql')]) writeFileSync(join(migrations, file), '');
    writeFileSync(join(root, 'bin/wrangler'), wrangler, { mode: 0o700 });
    writeFileSync(join(worker, 'calls'), '');
    db = new DatabaseSync(join(worker, 'fixture.sqlite'));
  });

  afterEach(() => {
    db.close();
    expect(readdirSync(root).filter(p => p.startsWith('aura-migration-resume.'))).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  function run(args: string[], failure = '') {
    return spawnSync('bash', [join(root, runner), '--resume-existing', ...args], {
      cwd: worker, encoding: 'utf8',
      env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}`, TMPDIR: root, FAILURE: failure },
    });
  }
  const files = (...names: string[]) => names.flatMap(name => ['--file', name]);
  const calls = () => readFileSync(join(worker, 'calls'), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as string[]);
  const writes = () => calls().filter(args => args.includes('--file'));
  const imported = () => readFileSync(join(worker, 'imported.sql'), 'utf8');

  it('imports a fresh migration exactly once and preserves canonical bytes', () => {
    bootstrap(db);
    const result = run(files(tenant));
    expect(result.stderr, result.stdout).not.toContain('ERROR');
    expect(result.status).toBe(0);
    expect(writes()).toHaveLength(1);
    expect(imported()).toBe(tenantSql);
    expect(readFileSync(join(migrations, tenant), 'utf8')).toBe(tenantSql);
  });

  it('skips only matching statements, preserving all other original bytes', () => {
    bootstrap(db);
    const existing = [
      'ALTER TABLE staff_devices ADD COLUMN tenant_id TEXT NOT NULL DEFAULT \'default\';',
      'CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);',
    ];
    db.exec(existing.join('\n'));
    const result = run(files(tenant));
    expect(result.status, result.stderr).toBe(0);
    expect(writes()).toHaveLength(1);
    expect(imported()).toBe(existing.reduce((sql, done) => sql.replace(done, ''), tenantSql));
  });

  it('imports the loyalty column exactly once when absent', () => {
    bootstrap(db);
    const result = run(files(loyalty));
    expect(result.status, result.stderr).toBe(0);
    expect(writes()).toHaveLength(1);
    expect(imported()).toBe(loyaltySql);
  });

  it('rejects a nullable tenant column despite its matching type and default', () => {
    bootstrap(db);
    db.exec("ALTER TABLE customers ADD COLUMN auth_version INTEGER DEFAULT 1");
    const result = run(files(tenant));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Schema drift: column customers.auth_version');
    expect(writes()).toHaveLength(0);
  });

  it('reports verified no-ops without writing when both migrations already match', () => {
    bootstrap(db);
    db.exec(tenantSql + loyaltySql);
    const result = run(files(tenant, loyalty));
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.match(/verified no-op/g)).toHaveLength(2);
    expect(writes()).toHaveLength(0);
  });

  it.each([
    'loyalty_points_redeemed TEXT DEFAULT 0',
    'loyalty_points_redeemed INTEGER NOT NULL DEFAULT 0',
    'loyalty_points_redeemed INTEGER DEFAULT 1',
    'loyalty_points_redeemed INTEGER DEFAULT 0 CHECK(loyalty_points_redeemed >= 0)',
    'loyalty_points_redeemed INTEGER DEFAULT 0, CHECK(loyalty_points_redeemed >= 0)',
  ])('refuses an incompatible column: %s', declaration => {
    bootstrap(db, `id TEXT, ${declaration}`);
    const result = run(files(loyalty));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Schema drift: column orders.loyalty_points_redeemed');
    expect(writes()).toHaveLength(0);
  });

  it.each([
    ['index idx_payments_provider_ref_uniq', 'CREATE UNIQUE INDEX idx_payments_provider_ref_uniq ON payments(tenant_id, provider_reference) WHERE provider_reference IS NOT NULL'],
    ['index idx_payments_provider_ref_uniq', `CREATE INDEX idx_payments_provider_ref_uniq ON payments(tenant_id, provider_reference) WHERE provider_reference IS NOT NULL AND provider_reference != ''`],
    ['index idx_payments_provider_ref_uniq', `CREATE UNIQUE INDEX idx_payments_provider_ref_uniq ON payments(provider_reference, tenant_id) WHERE provider_reference IS NOT NULL AND provider_reference != ''`],
    ['table schema_migrations', 'CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime(\'now\')), CHECK(length(checksum) = 64))'],
    ['table otp_challenges', 'CREATE TABLE otp_challenges (challenge_key TEXT PRIMARY KEY)'],
  ])('refuses a mismatched %s', (label, ddl) => {
    bootstrap(db);
    db.exec('ALTER TABLE payments ADD COLUMN provider_reference TEXT; ' + ddl);
    const result = run(files(tenant));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`Schema drift: ${label}`);
    expect(writes()).toHaveLength(0);
  });

  it('refuses a missing base table', () => {
    const result = run(files(loyalty));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Missing or incompatible base table: orders');
    expect(writes()).toHaveLength(0);
  });

  it('validates all selections offline before launching Wrangler', () => {
    expect(run(['--dry-run', ...files(tenant, loyalty)]).status).toBe(0);
    for (const args of [[], files('*'), files(tenant.replace('.sql', '.down.sql')), files('20260824_02_users_table.sql'), files(tenant, legacy)]) {
      expect(run(args).status).not.toBe(0);
    }
    writeFileSync(join(migrations, loyalty), loyaltySql + 'SELECT 1;');
    const altered = run(['--dry-run', ...files(loyalty)]);
    expect(altered.status).not.toBe(0);
    expect(altered.stderr).toContain('Unapproved SQL checksum');
    expect(calls()).toEqual([]);
  });

  it.each(['query', 'json', 'failed-result', 'missing-row', 'missing-field'])('fails closed on %s', failure => {
    bootstrap(db);
    expect(run(files(loyalty), failure).status).not.toBe(0);
    expect(writes()).toHaveLength(0);
  });

  it('stops after the first failed file write', () => {
    bootstrap(db);
    const result = run(files(loyalty, tenant), 'write');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Stopping remaining migrations');
    expect(calls().filter(args => args.includes('--command'))).toHaveLength(1);
    expect(writes()).toHaveLength(1);
    expect(imported()).toBe(loyaltySql);
  });
});
