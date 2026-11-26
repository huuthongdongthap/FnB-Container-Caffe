import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { createLogger } from '../../middleware/logger';

const log = createLogger({ route: 'inventory-movements' });

/**
 * Atomic stock write for a single movement.
 *
 * Correctness argument (every statement runs inside one transactional D1 batch):
 *  1. The first statement is a compare-and-swap UPDATE on the stock row. Every
 *     caller precondition (expected stock, expected updated_at, the previous
 *     value a target stocktake derived its delta from, a non-negative result
 *     for outbound deltas) is part of its WHERE clause, so the earlier read
 *     that validated them cannot be stale by the time the write lands.
 *  2. The primary ledger INSERT immediately follows and is gated on
 *     `changes() > 0`. changes() reports the rows touched by the most recent
 *     INSERT/UPDATE/DELETE on the connection, which is exactly the CAS
 *     statement at that point in the batch (these tables carry no triggers).
 *  3. Every later statement (secondary ledger, inventory_items mirror) is
 *     gated on the existence of the primary ledger row, whose id is unique to
 *     this request, so no further statement depends on changes().
 *  4. Any statement error aborts and rolls back the whole batch, so stock can
 *     never move without its ledger rows, nor the mirror diverge from it.
 */

export interface StockWriteParams {
  /** true when the ingredient only exists as an inventory_items row */
  usingCanonical: boolean;
  ingredientId: string;
  movementId: string;
  now: string;
  /** tenant the write is scoped to (never '*') */
  tenant: string;
  /** ingredients rows carry a tenant_id column */
  ingredientHasTenantCol: boolean;
  /** signed quantity that was validated against previousStock */
  signedQty: number;
  /** stock value observed by the read that validated this request */
  previousStock: number;
  /** set the stock to this absolute value instead of applying signedQty */
  targetStock?: number;
  expectedStock?: number;
  /** only provided when the row actually has an updated_at to compare against */
  expectedUpdatedAt?: string;
  ledger: {
    type: string;
    canonicalType: string;
    canonicalRefType: string | null;
    referenceId: string | null;
    referenceType: string | null;
    notes: string | null;
    createdBy: string;
  };
}

export type StockWriteResult =
  | { ok: true }
  | { ok: false; reason: 'conflict' | 'insufficient' | 'not_found' | 'tenant_write_failed' };

/** Which optional schema features the statements may rely on. */
interface WriteShape {
  /** the stock UPDATE filters on tenant_id */
  primaryTenantFilter: boolean;
  /** the inventory_items mirror UPDATE filters on tenant_id */
  mirrorTenantFilter: boolean;
  /** stock_movements has a tenant_id column */
  movementsTenantCol: boolean;
  /** inventory_transactions has a tenant_id column */
  txTenantCol: boolean;
  /** inventory_items / inventory_transactions exist alongside ingredients */
  withCanonical: boolean;
}

const TENANT_MATCH = "COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";

function errorMessage(err: unknown): string {
  return String((err as Error)?.message || err || '');
}

function ledgerInsert(
  db: D1Database,
  table: 'stock_movements' | 'inventory_transactions',
  columns: string[],
  values: Array<string | number | null>,
  gate: string,
  gateBinds: Array<string | number>
): D1PreparedStatement {
  const marks = columns.map(() => '?').join(', ');
  return db
    .prepare(`INSERT INTO ${table} (${columns.join(', ')}) SELECT ${marks} WHERE ${gate}`)
    .bind(...values, ...gateBinds);
}

function buildStatements(db: D1Database, p: StockWriteParams, shape: WriteShape): D1PreparedStatement[] {
  const isTarget = p.targetStock !== undefined;
  const primaryTable = p.usingCanonical ? 'inventory_items' : 'ingredients';
  const l = p.ledger;

  const guards: string[] = [];
  const guardBinds: Array<string | number> = [];
  if (!isTarget && p.signedQty < 0) {
    guards.push('COALESCE(current_stock, 0) + ? >= 0');
    guardBinds.push(p.signedQty);
  }
  if (isTarget) {
    // The target delta was computed from previousStock, so the ledger is only
    // truthful if that exact value is still in place when the write lands.
    guards.push('COALESCE(current_stock, 0) = ?');
    guardBinds.push(p.previousStock);
  } else if (p.expectedStock !== undefined) {
    guards.push('COALESCE(current_stock, 0) = ?');
    guardBinds.push(p.expectedStock);
  }
  if (p.expectedUpdatedAt !== undefined) {
    guards.push('updated_at = ?');
    guardBinds.push(p.expectedUpdatedAt);
  }

  const primaryFiltered = shape.primaryTenantFilter;
  const setExpr = isTarget ? '?' : 'COALESCE(current_stock, 0) + ?';
  const cas = db
    .prepare(
      `UPDATE ${primaryTable} SET current_stock = ${setExpr}, updated_at = ? WHERE id = ?${
        primaryFiltered ? ` AND ${TENANT_MATCH}` : ''
      }${guards.map((g) => ` AND ${g}`).join('')}`
    )
    .bind(
      isTarget ? Number(p.targetStock) : p.signedQty,
      p.now,
      p.ingredientId,
      ...(primaryFiltered ? [p.tenant] : []),
      ...guardBinds
    );

  const stmts: D1PreparedStatement[] = [cas];
  const casApplied = 'changes() > 0';
  const primaryLedgerExists = 'EXISTS (SELECT 1 FROM stock_movements WHERE id = ?)';

  const txColumns = ['id', 'item_id', 'type', 'quantity', 'reference_type', 'reference_id', 'notes'];
  const txValues: Array<string | number | null> = [
    p.movementId,
    p.ingredientId,
    l.canonicalType,
    p.signedQty,
    l.canonicalRefType,
    l.referenceId,
    l.notes || l.type || null,
  ];
  if (shape.txTenantCol) {
    txColumns.push('tenant_id');
    txValues.push(p.tenant);
  }
  txColumns.push('created_at');
  txValues.push(p.now);

  if (p.usingCanonical) {
    stmts.push(ledgerInsert(db, 'inventory_transactions', txColumns, txValues, casApplied, []));
    return stmts;
  }

  const movColumns = ['id', 'ingredient_id', 'type', 'quantity', 'reference_id', 'reference_type', 'notes', 'created_by'];
  const movValues: Array<string | number | null> = [
    p.movementId,
    p.ingredientId,
    l.type,
    p.signedQty,
    l.referenceId,
    l.referenceType,
    l.notes,
    l.createdBy,
  ];
  if (shape.movementsTenantCol) {
    movColumns.push('tenant_id');
    movValues.push(p.tenant);
  }
  movColumns.push('created_at');
  movValues.push(p.now);
  stmts.push(ledgerInsert(db, 'stock_movements', movColumns, movValues, casApplied, []));

  if (shape.withCanonical) {
    stmts.push(
      ledgerInsert(
        db,
        'inventory_transactions',
        txColumns,
        txValues,
        `EXISTS (SELECT 1 FROM inventory_items WHERE id = ?) AND ${primaryLedgerExists}`,
        [p.ingredientId, p.movementId]
      )
    );
    // Mirror the authoritative ingredient value rather than re-applying the
    // delta, so the two stock columns converge instead of drifting apart.
    stmts.push(
      db
        .prepare(
          `UPDATE inventory_items
           SET current_stock = COALESCE((SELECT current_stock FROM ingredients WHERE id = ?), 0), updated_at = ?
           WHERE id = ?${shape.mirrorTenantFilter ? ` AND ${TENANT_MATCH}` : ''} AND ${primaryLedgerExists}`
        )
        .bind(
          p.ingredientId,
          p.now,
          p.ingredientId,
          ...(shape.mirrorTenantFilter ? [p.tenant] : []),
          p.movementId
        )
    );
  }
  return stmts;
}

/** A later statement failed after the stock row may already have changed. */
class PartialWriteError extends Error {
  constructor(readonly original: unknown) {
    super(errorMessage(original));
  }
}

async function runAtomically(db: D1Database, stmts: D1PreparedStatement[]): Promise<unknown[]> {
  if (typeof (db as { batch?: unknown }).batch === 'function') {
    return db.batch(stmts);
  }
  // Minimal test doubles expose no batch(); production D1 always does. Each
  // statement is individually gated, so sequential execution keeps the same
  // guard semantics and only loses crash atomicity. Once the stock statement
  // may have applied, a failure must surface instead of being retried, or the
  // retry would apply the delta twice.
  const results: unknown[] = [];
  for (const [i, stmt] of stmts.entries()) {
    try {
      results.push(await stmt.run());
    } catch (err) {
      throw i > 0 ? new PartialWriteError(err) : err;
    }
  }
  return results;
}

async function diagnoseNoChange(db: D1Database, p: StockWriteParams): Promise<StockWriteResult> {
  const table = p.usingCanonical ? 'inventory_items' : 'ingredients';
  const row = (await db
    .prepare(`SELECT current_stock, updated_at FROM ${table} WHERE id = ?`)
    .bind(p.ingredientId)
    .first()) as { current_stock?: number | null; updated_at?: string | null } | null;
  if (!row) return { ok: false, reason: 'not_found' };

  const live = Number(row.current_stock ?? 0);
  const stale =
    (p.targetStock !== undefined && live !== p.previousStock) ||
    (p.expectedStock !== undefined && live !== p.expectedStock) ||
    (p.expectedUpdatedAt !== undefined && String(row.updated_at) !== p.expectedUpdatedAt);
  if (stale) return { ok: false, reason: 'conflict' };
  if (p.targetStock === undefined && p.signedQty < 0 && live + p.signedQty < 0) {
    return { ok: false, reason: 'insufficient' };
  }
  return { ok: false, reason: 'conflict' };
}

/**
 * Relaxes the write shape for one specific, recognised legacy-schema failure.
 * Returns false when the error is not a known schema gap (caller rethrows).
 * The failed batch was rolled back, so retrying with the relaxed shape is safe.
 */
function relaxShapeFor(err: unknown, shape: WriteShape, p: StockWriteParams): 'relaxed' | 'tenant_denied' | 'unknown' {
  const msg = errorMessage(err);
  const missingCanonical = /no such table:?\s*(main\.)?inventory_(items|transactions)/i.test(msg);
  if (missingCanonical && !p.usingCanonical && shape.withCanonical) {
    shape.withCanonical = false;
    log.warn('inventory_mirror_unavailable', {
      ingredient_id: p.ingredientId,
      delta: p.targetStock !== undefined ? p.targetStock - p.previousStock : p.signedQty,
      error: msg,
    });
    return 'relaxed';
  }

  // Ledger tables without tenant_id: the ingredient's tenant was already
  // verified and the row is addressed by primary key, so the ledger row can be
  // written without the column.
  if (/stock_movements has no column named tenant_id/i.test(msg) && shape.movementsTenantCol) {
    shape.movementsTenantCol = false;
    return 'relaxed';
  }
  if (/inventory_transactions has no column named tenant_id/i.test(msg) && shape.txTenantCol) {
    shape.txTenantCol = false;
    return 'relaxed';
  }

  if (/no such column:?\s*(\w+\.)?tenant_id/i.test(msg)) {
    // The message does not say which UPDATE failed. Drop the mirror filter
    // first; if the error persists the stock row itself lacks tenant_id, which
    // only the single-tenant legacy deployment may tolerate.
    if (shape.mirrorTenantFilter && !p.usingCanonical && shape.withCanonical) {
      shape.mirrorTenantFilter = false;
      return 'relaxed';
    }
    if (shape.primaryTenantFilter) {
      if (p.tenant !== 'default') return 'tenant_denied';
      shape.primaryTenantFilter = false;
      return 'relaxed';
    }
  }
  return 'unknown';
}

export async function applyStockMovement(db: D1Database, p: StockWriteParams): Promise<StockWriteResult> {
  const shape: WriteShape = {
    primaryTenantFilter: p.usingCanonical || p.ingredientHasTenantCol,
    mirrorTenantFilter: true,
    movementsTenantCol: true,
    txTenantCol: true,
    withCanonical: true,
  };

  let results: unknown[];
  for (;;) {
    try {
      results = await runAtomically(db, buildStatements(db, p, shape));
      break;
    } catch (err) {
      if (err instanceof PartialWriteError) throw err.original;
      const outcome = relaxShapeFor(err, shape, p);
      if (outcome === 'relaxed') continue;
      if (outcome === 'tenant_denied') return { ok: false, reason: 'tenant_write_failed' };
      throw err;
    }
  }

  const changes = (results[0] as { meta?: { changes?: unknown } } | undefined)?.meta?.changes;
  if (typeof changes === 'number' && changes === 0) {
    return diagnoseNoChange(db, p);
  }
  return { ok: true };
}
