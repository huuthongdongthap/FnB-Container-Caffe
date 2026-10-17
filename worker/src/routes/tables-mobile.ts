import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import type { Env } from '../types/env';
import type { Context } from 'hono';

const log = createLogger({ route: 'tables-mobile' });

const VIEW_ROLES: string[] = ['owner', 'manager', 'staff', 'waiter', 'kitchen', 'barista', 'chef', 'admin'];
const UPDATE_ROLES: string[] = ['owner', 'manager', 'waiter', 'admin'];

const D1_TO_MOBILE_STATUS: Record<string, 'free' | 'occupied' | 'reserved'> = {
  available: 'free',
  free: 'free',
  occupied: 'occupied',
  overdue: 'occupied',
  reserved: 'reserved',
};

const MOBILE_TO_D1_STATUS: Record<'free' | 'occupied' | 'reserved', string> = {
  free: 'Available',
  occupied: 'Occupied',
  reserved: 'Reserved',
};

function normalizeMobileTableRow(row: Record<string, unknown>) {
  const rawStatus = String(row.status ?? 'free').toLowerCase();
  const status = D1_TO_MOBILE_STATUS[rawStatus] ?? 'free';
  const rawTableNum = row.table_number ?? row.number;
  const parsedNum =
    typeof rawTableNum === 'number'
      ? rawTableNum
      : typeof rawTableNum === 'string'
        ? Number(rawTableNum.replace(/\D+/g, '')) || rawTableNum
        : typeof row.name === 'string'
          ? Number(row.name.replace(/\D+/g, '')) || 1
          : 1;
  const capacity = Number(row.capacity ?? row.seats ?? 4);
  const name =
    typeof row.name === 'string' && row.name
      ? row.name
      : `Bàn ${rawTableNum ?? row.id ?? ''}`.trim();

  return {
    ...row,
    id: String(row.id ?? ''),
    name,
    number: parsedNum,
    table_number: parsedNum,
    capacity,
    seats: capacity,
    zone: String(row.zone ?? 'Main'),
    status,
  };
}

// GET /mobile/tables — list all tables
export async function getTablesMobile(
  context: Context<{ Bindings: Env }>
) {
  try {
    const role = (context.get('user')?.role as string) || '';
    if (!VIEW_ROLES.includes(role)) {
      return errorResponse('Không có quyền', 403);
    }

    let rows: Array<Record<string, unknown>> = [];
    try {
      const cafeRes = await context.env.AURA_DB
        .prepare('SELECT * FROM cafe_tables ORDER BY table_number ASC')
        .all();
      rows = (cafeRes.results as Array<Record<string, unknown>>) || [];
    } catch (err) {
      if (!String((err as Error)?.message || '').includes('no such table')) {
        throw err;
      }
    }

    if (rows.length === 0) {
      try {
        const legacyRes = await context.env.AURA_DB
          .prepare('SELECT * FROM tables ORDER BY table_number ASC')
          .all();
        rows = (legacyRes.results as Array<Record<string, unknown>>) || [];
      } catch (err) {
        if (!String((err as Error)?.message || '').includes('no such table')) {
          throw err;
        }
      }
    }

    return jsonResponse({
      success: true,
      tables: rows.map(normalizeMobileTableRow),
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('getTablesMobile error:', { message: errMsg });
    return errorResponse('Không thể tải danh sách bàn', 500);
  }
}

// PATCH /mobile/tables/:id — change status (owner/manager/waiter)
export async function updateTableStatus(
  context: Context<{ Bindings: Env }>
) {
  try {
    const role = (context.get('user')?.role as string) || '';
    if (!UPDATE_ROLES.includes(role)) {
      return errorResponse('Không có quyền cập nhật', 403);
    }

    const tableId = context.req.param('id');
    if (!tableId) {
      return errorResponse('Thiếu table id', 400);
    }

    const body = await context.req.json<{ status: string }>();
    const allowed = ['free', 'occupied', 'reserved'] as const;
    const requestedStatus = String(body.status) as (typeof allowed)[number];
    if (!allowed.includes(requestedStatus)) {
      return errorResponse('Trạng thái không hợp lệ', 400);
    }

    let existing: Record<string, unknown> | null = null;
    let useLegacyTable = false;
    try {
      existing = await context.env.AURA_DB
        .prepare('SELECT * FROM cafe_tables WHERE id = ?')
        .bind(tableId)
        .first<Record<string, unknown>>();
    } catch (err) {
      if (String((err as Error)?.message || '').includes('no such table')) {
        useLegacyTable = true;
      } else {
        throw err;
      }
    }

    if (!existing && useLegacyTable) {
      existing = await context.env.AURA_DB
        .prepare('SELECT id, name, status, capacity FROM tables WHERE id = ?')
        .bind(tableId)
        .first<Record<string, unknown>>();
    }

    if (!existing) {
      return errorResponse('Bàn không tồn tại', 404);
    }

    const now = new Date().toISOString();
    if (!useLegacyTable) {
      try {
        await context.env.AURA_DB
          .prepare('UPDATE cafe_tables SET status = ? WHERE id = ?')
          .bind(MOBILE_TO_D1_STATUS[requestedStatus], tableId)
          .run();
      } catch (err) {
        if (String((err as Error)?.message || '').includes('no such table')) {
          await context.env.AURA_DB
            .prepare('UPDATE tables SET status = ? WHERE id = ?')
            .bind(requestedStatus, tableId)
            .run();
        } else {
          throw err;
        }
      }
    } else {
      await context.env.AURA_DB
        .prepare('UPDATE tables SET status = ? WHERE id = ?')
        .bind(requestedStatus, tableId)
        .run();
    }

    return jsonResponse({
      success: true,
      table: normalizeMobileTableRow({ ...existing, status: requestedStatus, updated_at: now }),
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('updateTableStatus error:', { message: errMsg });
    return errorResponse('Không thể cập nhật trạng thái bàn', 500);
  }
}
