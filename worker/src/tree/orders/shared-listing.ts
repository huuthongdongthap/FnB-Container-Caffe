/**
 * Orders — shared WHERE/ORDER/LIMIT builder for listing endpoints.
 *
 * Both /api/admin/orders and /api/kds/orders/kds build their queries here so
 * any future scoping (e.g. tenant filtering) lands in exactly one place.
 * Callers keep full control of SELECT list and row mapping — only the
 * filter/sort/pagination clause is centralized.
 */

export type OrderSortColumn = 'created_at' | 'total' | 'status';

export interface OrderListOptions {
  /** Alias-qualified equality filters, e.g. [['o.status', status]] */
  filters?: Array<[string, string]>;
  /** Whitelisted sort column (default created_at) */
  sort?: OrderSortColumn;
  /** Sort direction (default ASC) */
  order?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

const SORTABLE_COLUMNS: ReadonlySet<string> = new Set(['created_at', 'total', 'status']);

/**
 * Sort column comes from a user query param — invalid values fall back to
 * created_at rather than erroring, matching long-standing endpoint behavior.
 */
function safeSortColumn(raw: string): string {
  const bare = raw.includes('.') ? raw.split('.').pop()! : raw;
  return SORTABLE_COLUMNS.has(bare) ? raw : 'created_at';
}

export function buildOrderFilterClause(opts: Pick<OrderListOptions, 'filters'>): { clause: string; params: unknown[] } {
  const params: unknown[] = [];
  let clause = '';
  // Filter columns are caller-side constants (never user input), so values go
  // through bind params and column names need no runtime validation here.
  for (const [column, value] of opts.filters ?? []) {
    clause += ` AND ${column} = ?`;
    params.push(value);
  }
  return { clause, params };
}

export function buildOrderTail(opts: Pick<OrderListOptions, 'sort' | 'order' | 'limit' | 'offset'>): string {
  const sortBy = opts.sort ?? 'created_at';
  const direction = opts.order === 'DESC' ? 'DESC' : 'ASC';
  const limit = Math.max(1, Math.floor(opts.limit ?? 50));
  const offset = Math.max(0, Math.floor(opts.offset ?? 0));
  return ` ORDER BY ${safeSortColumn(sortBy)} ${direction} LIMIT ${limit} OFFSET ${offset}`;
}
