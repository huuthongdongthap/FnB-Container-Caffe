import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';

interface RedemptionInput {
  accountId: string; customerId: string; rewardId: string; tenantId: string;
  usingCustomersFallback: boolean; fromRewardsTable: boolean; pointsCost: number; customerRoute?: boolean;
  transactionId: string; voucherCode: string; expiresAt: string; now: string;
  rewardName: string; orderId: string | null; idempotencyKey: string | null;
}

/** Debit, accounting mirrors and usable vouchers must become visible together to refund CAS. */
export async function redeemRewardAtomically(db: D1Database, input: RedemptionInput): Promise<number> {
  const p = input;
  const tenant = p.tenantId;
  const names = ['customers', 'loyalty_accounts', 'loyalty_rewards', 'rewards',
    'loyalty_transactions', 'loyalty_point_logs', 'loyalty_redemptions', 'user_rewards'] as const;
  const columns = new Map<string, Set<string>>();
  for (const name of names) {
    const result = await db.prepare(`PRAGMA table_info(${name})`).all<{ name: string }>();
    columns.set(name, new Set(result.results.map(row => row.name)));
  }
  const has = (table: string, column: string) => columns.get(table)!.has(column);
  const exists = (table: string) => columns.get(table)!.size > 0;
  const scope = (table: string) => {
    if (has(table, 'tenant_id')) return " AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
    if (tenant !== 'default') throw new Error(`Tenant scope unavailable for ${table}`);
    return '';
  };
  const scopeArgs = (table: string) => has(table, 'tenant_id') ? [tenant] : [];
  const statements: D1PreparedStatement[] = [];
  const add = (sql: string, ...args: unknown[]) => statements.push(db.prepare(sql).bind(...args));
  const guard = () => {
    // SQLite integer overflow aborts the entire D1 batch on a zero-row mutation,
    // including RAISE(IGNORE) triggers; inspecting meta.changes after commit is too late.
    add('SELECT CASE WHEN changes() = 1 THEN 1 ELSE abs(-9223372036854775808) END AS redemption_guard');
  };
  const insert = (table: string, values: Record<string, unknown>) => {
    if (!exists(table)) throw new Error(`Redemption storage unavailable: ${table}`);
    scope(table);
    if (has(table, 'tenant_id')) values.tenant_id = tenant;
    const fields = Object.keys(values);
    add(`INSERT INTO ${table} (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`, ...Object.values(values));
    guard();
  };

  // Choose schema compatibility before writing; never retry a failed financial batch
  // as a different account branch or swallow a failed voucher/ledger insertion.
  const source = p.usingCustomersFallback ? 'customers' : 'loyalty_accounts';
  const balanceColumn = p.usingCustomersFallback ? 'loyalty_points' : 'current_points';
  const ownerWhere = source === 'customers' ? 'id = ?' : 'id = ? AND customer_id = ?';
  const ownerArgs = source === 'customers' ? [p.customerId] : [p.accountId, p.customerId];
  const balanceSql = `SELECT ${balanceColumn} AS balance FROM ${source} WHERE ${ownerWhere}${scope(source)}`;
  const customer = exists('customers') ? await db.prepare(
    `SELECT id FROM customers WHERE id = ?${scope('customers')}`,
  ).bind(p.customerId, ...scopeArgs('customers')).first() : null;
  if (!customer) throw new Error('Redemption conflict: customer mirror missing');
  if (!exists('loyalty_redemptions')) throw new Error('Redemption storage unavailable: loyalty_redemptions');

  if (p.fromRewardsTable) {
    if (has('rewards', 'stock')) {
      add(`UPDATE rewards SET stock = CASE WHEN stock > 0 THEN stock - 1 ELSE stock END
        WHERE id = ? AND COALESCE(is_active, 1) = 1 AND (stock IS NULL OR stock <> 0)${scope('rewards')}`,
      p.rewardId, ...scopeArgs('rewards'));
      guard();
    }
  }
  if (!p.fromRewardsTable || (p.customerRoute && exists('loyalty_rewards'))) {
    const counter = has('loyalty_rewards', 'current_redemptions') ? 'current_redemptions' : 'redeemed_count';
    // Stock is remaining inventory shared by both endpoints; only max_redemptions
    // is a lifetime cap. Comparing the counter to remaining stock consumes quota twice.
    const cap = has('loyalty_rewards', 'max_redemptions') ? 'max_redemptions' : 'NULL';
    const consumeStock = has('loyalty_rewards', 'stock');
    const stockSet = consumeStock ? ', stock = CASE WHEN stock > 0 THEN stock - 1 ELSE stock END' : '';
    const stockFloor = consumeStock ? ' AND (stock IS NULL OR stock = -1 OR stock >= 1)' : '';
    const mirror = p.fromRewardsTable;
    add(`UPDATE loyalty_rewards SET ${counter} = COALESCE(${counter}, 0) + 1${stockSet}
      WHERE id = ? AND COALESCE(is_active, 1) = 1${scope('loyalty_rewards')}
      AND (${cap} IS NULL OR ${cap} <= 0 OR COALESCE(${counter}, 0) < ${cap})${stockFloor}`,
    p.rewardId, ...scopeArgs('loyalty_rewards'));
    if (!mirror) guard();
    else {
      // A legacy lookup must still enforce any same-tenant canonical row at commit;
      // skipping the reservation is valid only when no such canonical row exists.
      add(`SELECT CASE WHEN changes() = 1 OR NOT EXISTS (
        SELECT 1 FROM loyalty_rewards WHERE id = ?${scope('loyalty_rewards')}
      ) THEN 1 ELSE abs(-9223372036854775808) END AS redemption_guard`, p.rewardId, ...scopeArgs('loyalty_rewards'));
    }
    if (!p.customerRoute && exists('rewards') && has('rewards', 'stock')) {
      add(`UPDATE rewards SET stock = stock - 1 WHERE id = ? AND stock >= 1${scope('rewards')}`,
        p.rewardId, ...scopeArgs('rewards'));
    }
  }

  let duplicateClause = '';
  const duplicateArgs: unknown[] = [];
  if (p.idempotencyKey) {
    duplicateClause = ` AND NOT EXISTS (SELECT 1 FROM loyalty_transactions WHERE idempotency_key = ?
      AND (account_id = ? OR customer_id = ?)${scope('loyalty_transactions')})`;
    duplicateArgs.push(p.idempotencyKey, p.accountId, p.customerId, ...scopeArgs('loyalty_transactions'));
  }
  const timestamps = [has(source, 'updated_at') ? 'updated_at = ?' : '',
    source === 'loyalty_accounts' && has(source, 'last_activity_at') ? 'last_activity_at = ?' : ''].filter(Boolean);
  add(`UPDATE ${source} SET ${balanceColumn} = ${balanceColumn} - ?${timestamps.map(s => `, ${s}`).join('')}
    WHERE ${ownerWhere}${scope(source)} AND COALESCE(${balanceColumn}, 0) >= ?${duplicateClause}`,
  p.pointsCost, ...timestamps.map(() => p.now), ...ownerArgs, ...scopeArgs(source), p.pointsCost, ...duplicateArgs);
  guard();
  if (source === 'loyalty_accounts' && customer) {
    // A successful debit must also change the refund-authoritative customer balance;
    // clamping an underfunded mirror to zero would evade refund's snapshot CAS.
    add(`UPDATE customers SET loyalty_points = loyalty_points - ?
      ${has('customers', 'updated_at') ? ', updated_at = ?' : ''} WHERE id = ?${scope('customers')}
      AND COALESCE(loyalty_points, 0) >= ?`,
    p.pointsCost, ...(has('customers', 'updated_at') ? [p.now] : []), p.customerId, ...scopeArgs('customers'), p.pointsCost);
    guard();
  }

  if (p.customerRoute && exists('loyalty_accounts') && has('loyalty_accounts', 'current_points')) {
    const activity = has('loyalty_accounts', 'last_activity_at') ? ', last_activity_at = ?' : '';
    const updated = has('loyalty_accounts', 'updated_at') ? ', updated_at = ?' : '';
    add(`UPDATE loyalty_accounts SET current_points = MAX(0, COALESCE(current_points, 0) - ?)${activity}${updated}
      WHERE customer_id = ?${scope('loyalty_accounts')}`, p.pointsCost,
    ...(activity ? [p.now] : []), ...(updated ? [p.now] : []), p.customerId, ...scopeArgs('loyalty_accounts'));
  }

  // Read the committed debit balance inside the transaction, not from a stale preflight snapshot.
  // INSERT..SELECT uses the same scoped source for both accounting ledgers.
  const ledger = (table: string, values: Record<string, unknown>) => {
    scope(table);
    if (has(table, 'tenant_id')) values.tenant_id = tenant;
    const fields = [...Object.keys(values), 'balance_after'];
    add(`INSERT INTO ${table} (${fields.join(', ')}) SELECT ${Object.keys(values).map(() => '?').join(', ')}, balance
      FROM (${balanceSql})`, ...Object.values(values), ...ownerArgs, ...scopeArgs(source));
    guard();
  };
  const description = `Redeemed: ${p.rewardName}`;
  const reason = p.customerRoute ? 'redeem' : description;
  ledger('loyalty_transactions', { id: p.transactionId, account_id: p.accountId, customer_id: p.customerId,
    type: 'redeem', points: -p.pointsCost, order_id: p.orderId, reward_id: p.rewardId,
    description, reason, idempotency_key: p.idempotencyKey, created_by: null, created_at: p.now });
  if (customer && exists('loyalty_point_logs')) {
    ledger('loyalty_point_logs', { id: p.transactionId, customer_id: p.customerId, order_id: p.orderId,
      points_change: -p.pointsCost, reason, description, created_at: p.now });
  }
  insert('loyalty_redemptions', { id: `lrd_${p.transactionId}`, customer_id: p.customerId,
    reward_id: p.rewardId, code: p.voucherCode, points_spent: p.pointsCost, order_id: p.orderId,
    status: 'active', expires_at: p.expiresAt, redeemed_at: p.now, created_at: p.now });
  if (customer && exists('user_rewards') && exists('rewards')) {
    const mirror = await db.prepare(`SELECT id FROM rewards WHERE id = ?${scope('rewards')}`)
      .bind(p.rewardId, ...scopeArgs('rewards')).first();
    if (mirror) insert('user_rewards', { id: `uwr_${p.transactionId}`, customer_id: p.customerId,
      reward_id: p.rewardId, code: p.voucherCode, status: 'active', expires_at: p.expiresAt, created_at: p.now });
  }
  await db.batch(statements);
  const transaction = await db.prepare(`SELECT balance_after FROM loyalty_transactions WHERE id = ?${scope('loyalty_transactions')}`)
    .bind(p.transactionId, ...scopeArgs('loyalty_transactions')).first<{ balance_after: number }>();
  if (!transaction) throw new Error('Committed redemption ledger missing');
  return Number(transaction.balance_after);
}
