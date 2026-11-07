/**
 * Canonical Table & Reservation Lifecycle Policy
 * Flow: TABLE → RESERVATION → SEATING → ORDER → CHECKOUT → TABLE RELEASE
 * Invariants: Server-authoritative table state; overlap prevention; order-table integrity;
 * idempotent seating/release; boundary isolation.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type {
  CanonicalTable,
  CanonicalReservation,
  CreateReservationPolicyInput,
  SeatTableInput,
  ReleaseTableInput,
  ReservationLifecycleStatus,
} from '../model/table-reservation-types';
import { validateOrderTable, matchesOperatingUnit, isTableUnavailableForService } from './table-availability-policy';

const ACTIVE_RESERVATION_STATUSES = new Set(['confirmed', 'pending', 'approved', 'seated']);

export async function createCanonicalReservation(
  db: D1Database,
  input: CreateReservationPolicyInput
): Promise<{ ok: boolean; reservation?: CanonicalReservation; error?: string }> {
  if (!input.date || typeof input.date !== 'string' || !input.date.trim() || !input.time || typeof input.time !== 'string' || !input.time.trim()) {
    return { ok: false, error: 'invalid_reservation_datetime' };
  }
  if (input.guestCount !== undefined && (typeof input.guestCount !== 'number' || !Number.isFinite(input.guestCount) || input.guestCount <= 0)) {
    return { ok: false, error: 'invalid_guest_count' };
  }

  const tableCheck = await validateOrderTable(db, input.tableId, input.operatingUnitId);
  if (!tableCheck.ok || !tableCheck.table) {
    return { ok: false, error: tableCheck.error || 'table_not_found' };
  }
  const table = tableCheck.table;
  if (isTableUnavailableForService(table.status)) {
    return { ok: false, error: 'table_unavailable' };
  }

  if (input.guestCount !== undefined && typeof table.capacity === 'number' && table.capacity > 0 && input.guestCount > table.capacity) {
    return { ok: false, error: 'capacity_exceeded' };
  }

  if (input.zone && table.zone && input.zone !== table.zone) {
    return { ok: false, error: 'cross_operating_unit_mismatch' };
  }

  const effectiveUnit =
    (table.operating_unit_id && String(table.operating_unit_id).trim()) ||
    (table.tenant_id && String(table.tenant_id).trim()) ||
    (input.operatingUnitId &&
    input.operatingUnitId.trim() &&
    input.operatingUnitId.trim() !== '*' &&
    input.operatingUnitId.trim().toLowerCase() !== 'hq'
      ? input.operatingUnitId.trim()
      : undefined);
  const targetUnit = effectiveUnit || 'default';

  let existingRsvs: Record<string, unknown>[] = [];
  try {
    const stmt = db.prepare(
      `SELECT * FROM reservations
       WHERE (table_id = ? OR table_id = ?)
         AND date = ? AND time = ?
         AND status IN ('confirmed', 'pending', 'seated')`
    ).bind(table.id, String(table.table_number), input.date, input.time);
    if (typeof stmt.all === 'function') {
      const res = await stmt.all<Record<string, unknown>>();
      if (Array.isArray(res?.results) && res.results.length > 0) {
        existingRsvs = res.results;
      }
    }
    if (existingRsvs.length === 0 && typeof stmt.first === 'function') {
      const single = await stmt.first<Record<string, unknown>>();
      if (single) existingRsvs = [single];
    }
  } catch {
    const stmt = db.prepare(
      `SELECT * FROM reservations
       WHERE (table_id = ? OR table_id = ?)
         AND reservation_date = ? AND reservation_time = ?
         AND status IN ('confirmed', 'pending', 'seated')`
    ).bind(table.id, String(table.table_number), input.date, input.time);
    if (typeof stmt.all === 'function') {
      try {
        const res = await stmt.all<Record<string, unknown>>();
        if (Array.isArray(res?.results) && res.results.length > 0) {
          existingRsvs = res.results;
        }
      } catch {
        existingRsvs = [];
      }
    }
    if (existingRsvs.length === 0 && typeof stmt.first === 'function') {
      const single = await stmt.first<Record<string, unknown>>().catch(() => null);
      if (single) existingRsvs = [single];
    }
  }

  if (existingRsvs.some((r) => matchesOperatingUnit(r, targetUnit))) {
    return { ok: false, error: 'overlapping_reservation' };
  }

  const now = new Date().toISOString();
  const rsvId = `rsv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const reservationTenantId = effectiveUnit && effectiveUnit !== '*' ? effectiveUnit : 'default';
  const reservation: CanonicalReservation = {
    id: rsvId,
    table_id: table.id,
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    guest_count: input.guestCount || 2,
    date: input.date,
    time: input.time,
    zone: table.zone || input.zone || 'Indoor',
    status: 'confirmed',
    notes: input.notes || null,
    ...(effectiveUnit ? { operating_unit_id: effectiveUnit, tenant_id: effectiveUnit } : {}),
    created_at: now,
    updated_at: now,
  };

  try {
    await db.prepare(
      `INSERT INTO reservations (
        id, table_id, customer_name, customer_phone, guest_count,
        date, time, zone, status, notes, tenant_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      reservation.id, reservation.table_id, reservation.customer_name,
      reservation.customer_phone, reservation.guest_count, reservation.date,
      reservation.time, reservation.zone, reservation.status, reservation.notes,
      reservationTenantId, now, now
    ).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO reservations (
          id, table_id, customer_name, customer_phone, guest_count,
          date, time, zone, status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        reservation.id, reservation.table_id, reservation.customer_name,
        reservation.customer_phone, reservation.guest_count, reservation.date,
        reservation.time, reservation.zone, reservation.status, reservation.notes,
        now, now
      ).run();
    } catch {
      await db.prepare(
        `INSERT INTO reservations (
          id, table_id, customer_name, phone, pax,
          reservation_date, reservation_time, status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        reservation.id, reservation.table_id, reservation.customer_name,
        reservation.customer_phone, reservation.guest_count, reservation.date,
        reservation.time, reservation.status, reservation.notes,
        now, now
      ).run();
    }
    if (effectiveUnit) {
      await db
        .prepare('UPDATE reservations SET tenant_id = ? WHERE id = ?')
        .bind(effectiveUnit, reservation.id)
        .run()
        .catch(() => {});
    }
  }

  return { ok: true, reservation };
}

export async function updateReservationStatus(
  db: D1Database,
  reservationId: string,
  targetStatus: ReservationLifecycleStatus,
  notes?: string,
  operatingUnitId?: string
): Promise<{ ok: boolean; reservation?: CanonicalReservation; error?: string }> {
  const rsv = await db.prepare(
    'SELECT * FROM reservations WHERE id = ?'
  ).bind(reservationId).first<CanonicalReservation>();

  if (!rsv) return { ok: false, error: 'reservation_not_found' };
  if (!matchesOperatingUnit(rsv as unknown as Record<string, unknown>, operatingUnitId)) {
    return { ok: false, error: 'cross_operating_unit_mismatch' };
  }
  if (
    operatingUnitId &&
    operatingUnitId.trim() &&
    operatingUnitId.trim() !== '*' &&
    operatingUnitId.trim().toLowerCase() !== 'hq' &&
    !('operating_unit_id' in rsv || 'tenant_id' in rsv) &&
    rsv.table_id
  ) {
    const tblCheck = await validateOrderTable(db, rsv.table_id, operatingUnitId);
    if (!tblCheck.ok && tblCheck.error === 'cross_operating_unit_mismatch') {
      return { ok: false, error: 'cross_operating_unit_mismatch' };
    }
  }

  const rawOperatingUnit = operatingUnitId && operatingUnitId.trim() ? operatingUnitId.trim() : '';
  const normOperatingUnit = rawOperatingUnit.toLowerCase() === 'hq' ? '*' : rawOperatingUnit;
  const effectiveUnit =
    (rsv.operating_unit_id && String(rsv.operating_unit_id).trim()) ||
    (rsv.tenant_id && String(rsv.tenant_id).trim()) ||
    (normOperatingUnit || undefined);
  const now = new Date().toISOString();
  if (effectiveUnit && effectiveUnit !== '*') {
    try {
      await db.prepare(
        `UPDATE reservations
         SET status = ?, notes = COALESCE(?, notes), updated_at = ?
         WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
      ).bind(targetStatus, notes || null, now, reservationId, effectiveUnit).run();
    } catch (err) {
      if (effectiveUnit === 'default') {
        await db.prepare(
          `UPDATE reservations
           SET status = ?, notes = COALESCE(?, notes), updated_at = ?
           WHERE id = ?`
        ).bind(targetStatus, notes || null, now, reservationId).run();
      } else {
        throw err;
      }
    }
  } else {
    await db.prepare(
      `UPDATE reservations
       SET status = ?, notes = COALESCE(?, notes), updated_at = ?
       WHERE id = ?`
    ).bind(targetStatus, notes || null, now, reservationId).run();
  }

  if ((targetStatus === 'cancelled' || targetStatus === 'no_show') && rsv.table_id) {
    let canResetTable = true;
    const tableRow = await db
      .prepare('SELECT * FROM cafe_tables WHERE id = ? LIMIT 1')
      .bind(rsv.table_id)
      .first<CanonicalTable>()
      .catch(() => null);
    if (tableRow) {
      const tblStatus = String(tableRow.status ?? '').trim().toLowerCase();
      if (tblStatus === 'occupied' || tblStatus === 'overdue' || isTableUnavailableForService(tableRow.status) || (tblStatus && tblStatus !== 'reserved')) {
        canResetTable = false;
      }
    }
    const rsvDate = String(rsv.date ?? (rsv as unknown as Record<string, unknown>).reservation_date ?? '').trim();
    if (canResetTable && rsvDate) {
      let sameDayRows: Record<string, unknown>[] = [];
      try {
        const stmt = db.prepare(
          `SELECT * FROM reservations
           WHERE (table_id = ? OR table_id = ?)
             AND date = ?
             AND status IN ('confirmed', 'pending', 'approved', 'seated')`
        ).bind(rsv.table_id, String(tableRow?.table_number ?? rsv.table_id), rsvDate);
        if (typeof stmt.all === 'function') {
          const res = await stmt.all<Record<string, unknown>>();
          sameDayRows = res?.results || [];
        } else if (typeof stmt.first === 'function') {
          const single = await stmt.first<Record<string, unknown>>();
          if (single) sameDayRows = [single];
        }
      } catch {
        try {
          const stmt = db.prepare(
            `SELECT * FROM reservations
             WHERE (table_id = ? OR table_id = ?)
               AND reservation_date = ?
               AND status IN ('confirmed', 'pending', 'approved', 'seated')`
          ).bind(rsv.table_id, String(tableRow?.table_number ?? rsv.table_id), rsvDate);
          if (typeof stmt.all === 'function') {
            const res = await stmt.all<Record<string, unknown>>();
            sameDayRows = res?.results || [];
          }
        } catch {
          sameDayRows = [];
        }
      }
      const targetUnit = effectiveUnit && effectiveUnit !== '*' ? effectiveUnit : 'default';
      const hasOtherActive = sameDayRows.some((row) => {
        if (String(row.id ?? '') === String(reservationId)) return false;
        const rowStatus = String(row.status ?? '').trim().toLowerCase();
        if (!ACTIVE_RESERVATION_STATUSES.has(rowStatus)) return false;
        const rowTableId = String(row.table_id ?? '');
        if (rowTableId && rowTableId !== String(rsv.table_id) && (!tableRow || rowTableId !== String(tableRow.table_number ?? ''))) {
          return false;
        }
        const rowDate = String(row.date ?? row.reservation_date ?? '').trim();
        if (rsvDate && rowDate && rowDate !== rsvDate) return false;
        return matchesOperatingUnit(row, targetUnit);
      });
      if (hasOtherActive) {
        canResetTable = false;
      }
    }

    if (canResetTable) {
      if (effectiveUnit && effectiveUnit !== '*') {
        try {
          await db.prepare(
            "UPDATE cafe_tables SET status = 'Available', updated_at = ? WHERE id = ? AND status = 'Reserved' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(now, rsv.table_id, effectiveUnit).run();
        } catch {
          try {
            await db.prepare(
              "UPDATE cafe_tables SET status = 'Available' WHERE id = ? AND status = 'Reserved' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            ).bind(rsv.table_id, effectiveUnit).run();
          } catch (err) {
            if (effectiveUnit === 'default') {
              try {
                await db.prepare(
                  "UPDATE cafe_tables SET status = 'Available', updated_at = ? WHERE id = ? AND status = 'Reserved'"
                ).bind(now, rsv.table_id).run();
              } catch {
                await db.prepare(
                  "UPDATE cafe_tables SET status = 'Available' WHERE id = ? AND status = 'Reserved'"
                ).bind(rsv.table_id).run();
              }
            } else {
              throw err;
            }
          }
        }
      } else {
        try {
          await db.prepare(
            "UPDATE cafe_tables SET status = 'Available', updated_at = ? WHERE id = ? AND status = 'Reserved'"
          ).bind(now, rsv.table_id).run();
        } catch {
          await db.prepare(
            "UPDATE cafe_tables SET status = 'Available' WHERE id = ? AND status = 'Reserved'"
          ).bind(rsv.table_id).run();
        }
      }
    }
  }

  return { ok: true, reservation: { ...rsv, status: targetStatus, updated_at: now } };
}

export async function seatTable(
  db: D1Database,
  input: SeatTableInput
): Promise<{ ok: boolean; table?: CanonicalTable; reservation?: CanonicalReservation; error?: string }> {
  const tableCheck = await validateOrderTable(db, input.tableId, input.operatingUnitId);
  if (!tableCheck.ok || !tableCheck.table) {
    return { ok: false, error: tableCheck.error || 'table_not_found' };
  }
  const table = tableCheck.table;
  if (isTableUnavailableForService(table.status)) {
    return { ok: false, error: 'table_unavailable' };
  }
  if (String(table.status ?? '').trim().toLowerCase() === 'occupied') {
    return { ok: false, error: 'table_already_occupied' };
  }
  const tableExplicitUnit =
    (table.operating_unit_id && String(table.operating_unit_id).trim()) ||
    (table.tenant_id && String(table.tenant_id).trim()) ||
    '';
  const rawInputUnit = input.operatingUnitId && input.operatingUnitId.trim() ? input.operatingUnitId.trim() : '';
  const normInputUnit = rawInputUnit.toLowerCase() === 'hq' ? '*' : rawInputUnit;
  const effectiveUnit =
    tableExplicitUnit ||
    (normInputUnit || 'default');
  const now = new Date().toISOString();

  let rsv: CanonicalReservation | undefined;
  if (input.reservationId) {
    const foundRsv = await db.prepare(
      'SELECT * FROM reservations WHERE id = ?'
    ).bind(input.reservationId).first<CanonicalReservation>();

    if (!foundRsv) {
      return { ok: false, error: 'reservation_not_found' };
    }
    if (
      !matchesOperatingUnit(foundRsv as unknown as Record<string, unknown>, input.operatingUnitId) ||
      (tableExplicitUnit &&
        tableExplicitUnit !== '*' &&
        !matchesOperatingUnit(foundRsv as unknown as Record<string, unknown>, tableExplicitUnit))
    ) {
      return { ok: false, error: 'cross_operating_unit_mismatch' };
    }
    if (foundRsv.status === 'cancelled' || foundRsv.status === 'completed' || foundRsv.status === 'no_show') {
      return { ok: false, error: 'invalid_reservation_status' };
    }
    if (foundRsv.table_id !== table.id && foundRsv.table_id !== String(table.table_number)) {
      return { ok: false, error: 'table_reservation_mismatch' };
    }
    rsv = foundRsv;
    if (effectiveUnit !== '*') {
      try {
        await db.prepare(
          "UPDATE reservations SET status = 'seated', updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(now, input.reservationId, effectiveUnit).run();
      } catch (err) {
        if (effectiveUnit === 'default') {
          await db.prepare(
            "UPDATE reservations SET status = 'seated', updated_at = ? WHERE id = ?"
          ).bind(now, input.reservationId).run();
        } else {
          throw err;
        }
      }
    } else {
      await db.prepare(
        "UPDATE reservations SET status = 'seated', updated_at = ? WHERE id = ?"
      ).bind(now, input.reservationId).run();
    }
  }

  if (effectiveUnit !== '*') {
    try {
      await db.prepare(
        "UPDATE cafe_tables SET status = 'Occupied', updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(now, table.id, effectiveUnit).run();
    } catch {
      try {
        await db.prepare(
          "UPDATE cafe_tables SET status = 'Occupied' WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(table.id, effectiveUnit).run();
      } catch (err) {
        if (effectiveUnit === 'default') {
          try {
            await db.prepare(
              "UPDATE cafe_tables SET status = 'Occupied', updated_at = ? WHERE id = ?"
            ).bind(now, table.id).run();
          } catch {
            await db.prepare(
              "UPDATE cafe_tables SET status = 'Occupied' WHERE id = ?"
            ).bind(table.id).run();
          }
        } else {
          throw err;
        }
      }
    }
  } else {
    try {
      await db.prepare(
        "UPDATE cafe_tables SET status = 'Occupied', updated_at = ? WHERE id = ?"
      ).bind(now, table.id).run();
    } catch {
      await db.prepare(
        "UPDATE cafe_tables SET status = 'Occupied' WHERE id = ?"
      ).bind(table.id).run();
    }
  }

  return {
    ok: true,
    table: { ...table, status: 'Occupied', updated_at: now },
    reservation: rsv ? { ...rsv, status: 'seated', updated_at: now } : undefined,
  };
}

export async function releaseTable(
  db: D1Database,
  inputOrTableId: ReleaseTableInput | string,
  operatingUnitIdArg?: string
): Promise<{ ok: boolean; table?: CanonicalTable; alreadyReleased?: boolean; error?: string }> {
  const input: ReleaseTableInput =
    typeof inputOrTableId === 'string'
      ? { tableId: inputOrTableId, operatingUnitId: operatingUnitIdArg }
      : inputOrTableId;
  const tableCheck = await validateOrderTable(db, input.tableId, input.operatingUnitId);
  if (!tableCheck.ok || !tableCheck.table) {
    return { ok: false, error: tableCheck.error || 'table_not_found' };
  }
  const table = tableCheck.table;
  const rawReleaseUnit = input.operatingUnitId && input.operatingUnitId.trim() ? input.operatingUnitId.trim() : '';
  const normReleaseUnit = rawReleaseUnit.toLowerCase() === 'hq' ? '*' : rawReleaseUnit;
  const effectiveUnit =
    (table.operating_unit_id && String(table.operating_unit_id).trim()) ||
    (table.tenant_id && String(table.tenant_id).trim()) ||
    (normReleaseUnit || 'default');
  const now = new Date().toISOString();
  const alreadyReleased = String(table.status).toLowerCase() === 'available';

  if (alreadyReleased && typeof inputOrTableId !== 'string') {
    return { ok: true, table: { ...table, status: 'Available' }, alreadyReleased: true };
  }

  if (effectiveUnit !== '*') {
    try {
      await db.prepare(
        "UPDATE cafe_tables SET status = 'Available', updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(now, table.id, effectiveUnit).run();
    } catch {
      try {
        await db.prepare(
          "UPDATE cafe_tables SET status = 'Available' WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(table.id, effectiveUnit).run();
      } catch (err) {
        if (effectiveUnit === 'default') {
          try {
            await db.prepare(
              "UPDATE cafe_tables SET status = 'Available', updated_at = ? WHERE id = ?"
            ).bind(now, table.id).run();
          } catch {
            await db.prepare(
              "UPDATE cafe_tables SET status = 'Available' WHERE id = ?"
            ).bind(table.id).run();
          }
        } else {
          throw err;
        }
      }
    }
  } else {
    try {
      await db.prepare(
        "UPDATE cafe_tables SET status = 'Available', updated_at = ? WHERE id = ?"
      ).bind(now, table.id).run();
    } catch {
      await db.prepare(
        "UPDATE cafe_tables SET status = 'Available' WHERE id = ?"
      ).bind(table.id).run();
    }
  }

  if (effectiveUnit !== '*') {
    try {
      await db.prepare(
        "UPDATE reservations SET status = 'completed', updated_at = ? WHERE (table_id = ? OR table_id = ?) AND status = 'seated' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(now, table.id, String(table.table_number ?? table.id), effectiveUnit).run();
    } catch (err) {
      if (effectiveUnit === 'default') {
        await db.prepare(
          "UPDATE reservations SET status = 'completed', updated_at = ? WHERE (table_id = ? OR table_id = ?) AND status = 'seated'"
        ).bind(now, table.id, String(table.table_number ?? table.id)).run();
      } else {
        throw err;
      }
    }
  } else {
    await db.prepare(
      "UPDATE reservations SET status = 'completed', updated_at = ? WHERE (table_id = ? OR table_id = ?) AND status = 'seated'"
    ).bind(now, table.id, String(table.table_number ?? table.id)).run();
  }

  return { ok: true, table: { ...table, status: 'Available', updated_at: now } };
}
