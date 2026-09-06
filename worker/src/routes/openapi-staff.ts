import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { requireAuth } from "../middleware/auth";
import type { Env } from "../types/env";
import {
  StaffRoutes,
  StaffCreateSchema,
  StaffUpdateSchema,
  StaffListQuerySchema,
  StaffShiftCreateSchema,
  StaffShiftUpdateSchema,
  StaffShiftListQuerySchema,
  StaffAttendanceCreateSchema,
  StaffAttendanceListQuerySchema,
  IdParamsSchema,
} from "../schemas/staff";
import {
  SuccessResponseSchema,
  ErrorResponseSchema,
} from "../schemas/common";

export const openApiStaffRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to all routes
openApiStaffRouter.use("*", requireAuth(["owner", "manager"]));

// ===== STAFF CRUD =====

// GET /api/staff - List staff
openApiStaffRouter.openapi(StaffRoutes.list, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const query = c.req.valid("query");
  const { page = 1, limit = 20, sort = "name", order = "asc", role, isActive, search } = query;

  let whereClause = "WHERE role != 'customer'";
  const params: (string | number)[] = [];

  if (role) {
    whereClause += ` AND role = ?`;
    params.push(role);
  }
  if (isActive !== undefined) {
    whereClause += ` AND is_active = ?`;
    params.push(isActive ? 1 : 0);
  }
  if (search) {
    whereClause += ` AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM users ${whereClause}`
  ).bind(...params).first();
  const total = countResult?.total || 0;

  const offset = (page - 1) * limit;
  const orderClause = `${sort} ${order.toUpperCase()}`;
  const rows = await db.prepare(
    `SELECT id, name, email, phone, role, locale, is_active, avatar_url, hire_date, created_at, updated_at
     FROM users ${whereClause}
     ORDER BY ${orderClause}
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  const staff = rows.results.map(s => ({
    ...s,
    role: s.role,
    locale: s.locale,
    isActive: s.is_active === 1,
    hireDate: s.hire_date,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  }));

  return c.json({
    success: true,
    data: { staff, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
  });
});

// GET /api/staff/:id - Get staff by ID
openApiStaffRouter.openapi(StaffRoutes.get, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid("param");

  const staff = await db.prepare(
    `SELECT id, name, email, phone, role, locale, is_active, avatar_url, hire_date, created_at, updated_at
     FROM users WHERE id = ? AND role != 'customer'`
  ).bind(id).first();

  if (!staff) {
    return c.json({ success: false, error: "Staff not found" }, 404);
  }

  // Get shifts for this staff
  const shifts = await db.prepare(
    `SELECT * FROM staff_shifts WHERE staff_id = ? ORDER BY date DESC, start_time DESC LIMIT 10`
  ).bind(id).all();

  // Get attendance for this staff
  const attendance = await db.prepare(
    `SELECT * FROM staff_attendance WHERE staff_id = ? ORDER BY date DESC LIMIT 10`
  ).bind(id).all();

  return c.json({
    success: true,
    data: {
      ...staff,
      role: staff.role,
      locale: staff.locale,
      isActive: staff.is_active === 1,
      hireDate: staff.hire_date,
      createdAt: staff.created_at,
      updatedAt: staff.updated_at,
      recentShifts: shifts.results,
      recentAttendance: attendance.results,
    },
  });
});

// POST /api/staff - Create staff
openApiStaffRouter.openapi(StaffRoutes.create, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = c.req.valid("json");
  const user = c.get("user");
  const now = new Date().toISOString();

  // Check if email exists
  const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(body.email).first();
  if (existing) {
    return c.json({ success: false, error: "Email already exists" }, 409);
  }

  const passwordHash = await hashPassword(body.password);
  const id = crypto.randomUUID();

  await db.prepare(
    `INSERT INTO users (id, name, email, phone, password_hash, role, locale, is_active, avatar_url, hire_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.name,
    body.email,
    body.phone || null,
    passwordHash,
    body.role,
    body.locale || "vi",
    body.isActive !== false ? 1 : 0,
    null,
    body.hireDate || now.slice(0, 10),
    now,
    now
  ).run();

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, "staff_create", "user", id, JSON.stringify(body), now).run();

  const created = await db.prepare(
    `SELECT id, name, email, phone, role, locale, is_active, avatar_url, hire_date, created_at, updated_at
     FROM users WHERE id = ?`
  ).bind(id).first();

  return c.json({
    success: true,
    data: {
      ...created!,
      role: created!.role,
      locale: created!.locale,
      isActive: created!.is_active === 1,
      hireDate: created!.hire_date,
      createdAt: created!.created_at,
      updatedAt: created!.updated_at,
    },
  }, 201);
});

// PATCH /api/staff/:id - Update staff
openApiStaffRouter.openapi(StaffRoutes.update, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const user = c.get("user");
  const now = new Date().toISOString();

  const existing = await db.prepare("SELECT * FROM users WHERE id = ? AND role != 'customer'").bind(id).first();
  if (!existing) {
    return c.json({ success: false, error: "Staff not found" }, 404);
  }

  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  if (body.name !== undefined) { updates.push("name = ?"); params.push(body.name); }
  if (body.email !== undefined) {
    const emailExists = await db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").bind(body.email, id).first();
    if (emailExists) {
      return c.json({ success: false, error: "Email already exists" }, 409);
    }
    updates.push("email = ?"); params.push(body.email);
  }
  if (body.phone !== undefined) { updates.push("phone = ?"); params.push(body.phone); }
  if (body.role !== undefined) { updates.push("role = ?"); params.push(body.role); }
  if (body.locale !== undefined) { updates.push("locale = ?"); params.push(body.locale); }
  if (body.isActive !== undefined) { updates.push("is_active = ?"); params.push(body.isActive ? 1 : 0); }
  if (body.avatarUrl !== undefined) { updates.push("avatar_url = ?"); params.push(body.avatarUrl); }
  if (body.hireDate !== undefined) { updates.push("hire_date = ?"); params.push(body.hireDate); }

  updates.push("updated_at = ?");
  params.push(now);
  params.push(id);

  if (updates.length > 1) {
    await db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();
  }

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, "staff_update", "user", id, JSON.stringify(body), now).run();

  const updated = await db.prepare(
    `SELECT id, name, email, phone, role, locale, is_active, avatar_url, hire_date, created_at, updated_at
     FROM users WHERE id = ?`
  ).bind(id).first();

  return c.json({
    success: true,
    data: {
      ...updated!,
      role: updated!.role,
      locale: updated!.locale,
      isActive: updated!.is_active === 1,
      hireDate: updated!.hire_date,
      createdAt: updated!.created_at,
      updatedAt: updated!.updated_at,
    },
  });
});

// DELETE /api/staff/:id - Delete staff (soft delete)
openApiStaffRouter.openapi(StaffRoutes.delete, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid("param");
  const user = c.get("user");
  const now = new Date().toISOString();

  const existing = await db.prepare("SELECT * FROM users WHERE id = ? AND role != 'customer'").bind(id).first();
  if (!existing) {
    return c.json({ success: false, error: "Staff not found" }, 404);
  }

  // Check for related records
  const shifts = await db.prepare("SELECT COUNT(*) as count FROM staff_shifts WHERE staff_id = ?").bind(id).first();
  const attendance = await db.prepare("SELECT COUNT(*) as count FROM staff_attendance WHERE staff_id = ?").bind(id).first();
  const orders = await db.prepare("SELECT COUNT(*) as count FROM orders WHERE created_by = ?").bind(id).first();

  if ((shifts?.count || 0) > 0 || (attendance?.count || 0) > 0 || (orders?.count || 0) > 0) {
    // Soft delete
    await db.prepare("UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?").bind(now, id).run();
  } else {
    // Hard delete
    await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
  }

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, "staff_delete", "user", id, JSON.stringify({ name: existing.name }), now).run();

  return c.json({ success: true, data: { success: true } });
});

// ===== SHIFTS =====

// GET /api/staff/shifts - List shifts
openApiStaffRouter.openapi(StaffRoutes.shifts.list, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const query = c.req.valid("query");
  const { page = 1, limit = 20, sort = "date", order = "desc", staffId, zoneId, dateFrom, dateTo, status } = query;

  let whereClause = "WHERE 1=1";
  const params: (string | number)[] = [];

  if (staffId) {
    whereClause += ` AND ss.staff_id = ?`;
    params.push(staffId);
  }
  if (zoneId) {
    whereClause += ` AND ss.zone_id = ?`;
    params.push(zoneId);
  }
  if (dateFrom) {
    whereClause += ` AND ss.date >= ?`;
    params.push(dateFrom);
  }
  if (dateTo) {
    whereClause += ` AND ss.date <= ?`;
    params.push(dateTo);
  }
  if (status) {
    whereClause += ` AND ss.status = ?`;
    params.push(status);
  }

  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM staff_shifts ss ${whereClause}`
  ).bind(...params).first();
  const total = countResult?.total || 0;

  const offset = (page - 1) * limit;
  const orderClause = `${sort} ${order.toUpperCase()}`;
  const rows = await db.prepare(
    `SELECT ss.*, u.name as staff_name, z.name as zone_name
     FROM staff_shifts ss
     LEFT JOIN users u ON ss.staff_id = u.id
     LEFT JOIN zones z ON ss.zone_id = z.id
     ${whereClause}
     ORDER BY ${orderClause}
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return c.json({
    success: true,
    data: { shifts: rows.results, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
  });
});

// POST /api/staff/shifts - Create shift
openApiStaffRouter.openapi(StaffRoutes.shifts.create, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = c.req.valid("json");
  const user = c.get("user");
  const now = new Date().toISOString();

  const id = crypto.randomUUID();

  // Check staff exists
  const staff = await db.prepare("SELECT id FROM users WHERE id = ? AND role != 'customer'").bind(body.staffId).first();
  if (!staff) {
    return c.json({ success: false, error: "Staff not found" }, 404);
  }

  // Check zone if provided
  if (body.zoneId) {
    const zone = await db.prepare("SELECT id FROM zones WHERE id = ?").bind(body.zoneId).first();
    if (!zone) {
      return c.json({ success: false, error: "Zone not found" }, 404);
    }
  }

  await db.prepare(
    `INSERT INTO staff_shifts (id, staff_id, zone_id, date, start_time, end_time, status, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.staffId,
    body.zoneId || null,
    body.date,
    body.startTime,
    body.endTime,
    body.status || "scheduled",
    body.notes || null,
    now,
    now
  ).run();

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, "shift_create", "staff_shift", id, JSON.stringify(body), now).run();

  const created = await db.prepare("SELECT * FROM staff_shifts WHERE id = ?").bind(id).first();

  return c.json({ success: true, data: created }, 201);
});

// PATCH /api/staff/shifts/:id - Update shift
openApiStaffRouter.openapi(StaffRoutes.shifts.update, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const user = c.get("user");
  const now = new Date().toISOString();

  const existing = await db.prepare("SELECT * FROM staff_shifts WHERE id = ?").bind(id).first();
  if (!existing) {
    return c.json({ success: false, error: "Shift not found" }, 404);
  }

  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  if (body.staffId !== undefined) {
    const staff = await db.prepare("SELECT id FROM users WHERE id = ? AND role != 'customer'").bind(body.staffId).first();
    if (!staff) return c.json({ success: false, error: "Staff not found" }, 404);
    updates.push("staff_id = ?"); params.push(body.staffId);
  }
  if (body.zoneId !== undefined) {
    if (body.zoneId) {
      const zone = await db.prepare("SELECT id FROM zones WHERE id = ?").bind(body.zoneId).first();
      if (!zone) return c.json({ success: false, error: "Zone not found" }, 404);
    }
    updates.push("zone_id = ?"); params.push(body.zoneId);
  }
  if (body.date !== undefined) { updates.push("date = ?"); params.push(body.date); }
  if (body.startTime !== undefined) { updates.push("start_time = ?"); params.push(body.startTime); }
  if (body.endTime !== undefined) { updates.push("end_time = ?"); params.push(body.endTime); }
  if (body.status !== undefined) { updates.push("status = ?"); params.push(body.status); }
  if (body.notes !== undefined) { updates.push("notes = ?"); params.push(body.notes); }

  updates.push("updated_at = ?");
  params.push(now);
  params.push(id);

  if (updates.length > 1) {
    await db.prepare(`UPDATE staff_shifts SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();
  }

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, "shift_update", "staff_shift", id, JSON.stringify(body), now).run();

  const updated = await db.prepare("SELECT * FROM staff_shifts WHERE id = ?").bind(id).first();

  return c.json({ success: true, data: updated });
});

// DELETE /api/staff/shifts/:id - Delete shift
openApiStaffRouter.openapi(StaffRoutes.shifts.delete, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid("param");
  const user = c.get("user");
  const now = new Date().toISOString();

  const existing = await db.prepare("SELECT * FROM staff_shifts WHERE id = ?").bind(id).first();
  if (!existing) {
    return c.json({ success: false, error: "Shift not found" }, 404);
  }

  await db.prepare("DELETE FROM staff_shifts WHERE id = ?").bind(id).run();

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, "shift_delete", "staff_shift", id, JSON.stringify({}), now).run();

  return c.json({ success: true, data: { success: true } });
});

// ===== ATTENDANCE =====

// POST /api/staff/attendance/check-in - Check in
openApiStaffRouter.openapi(StaffRoutes.attendance.checkIn, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = c.req.valid("json");
  const user = c.get("user");
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const currentTime = now.slice(11, 19);

  // Check if staff exists
  const staff = await db.prepare("SELECT id FROM users WHERE id = ? AND role != 'customer'").bind(body.staffId).first();
  if (!staff) {
    return c.json({ success: false, error: "Staff not found" }, 404);
  }

  // Check for existing check-in today
  const existing = await db.prepare(
    `SELECT * FROM staff_attendance WHERE staff_id = ? AND date = ? AND check_in IS NOT NULL AND check_out IS NULL`
  ).bind(body.staffId, today).first();

  if (existing) {
    return c.json({ success: false, error: "Already checked in" }, 409);
  }

  // Find scheduled shift
  const shift = await db.prepare(
    `SELECT * FROM staff_shifts WHERE staff_id = ? AND date = ? AND status = 'scheduled'
     ORDER BY start_time ASC LIMIT 1`
  ).bind(body.staffId, today).first();

  const isLate = shift && currentTime > shift.start_time;

  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO staff_attendance (id, staff_id, shift_id, date, check_in, check_out, status, device_fingerprint, location, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.staffId,
    shift?.id || null,
    today,
    currentTime,
    null,
    isLate ? "late" : "present",
    body.deviceFingerprint || null,
    body.location || null,
    body.notes || null,
    now,
    now
  ).run();

  // Update shift status if linked
  if (shift) {
    await db.prepare("UPDATE staff_shifts SET status = 'in_progress', updated_at = ? WHERE id = ?").bind(now, shift.id).run();
  }

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, "attendance_check_in", "staff_attendance", id, JSON.stringify({ shiftId: shift?.id }), now).run();

  const attendance = await db.prepare("SELECT * FROM staff_attendance WHERE id = ?").bind(id).first();

  return c.json({ success: true, data: attendance }, 201);
});

// POST /api/staff/attendance/check-out - Check out
openApiStaffRouter.openapi(StaffRoutes.attendance.checkOut, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = c.req.valid("json");
  const user = c.get("user");
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const currentTime = now.slice(11, 19);

  const attendance = await db.prepare(
    `SELECT * FROM staff_attendance WHERE staff_id = ? AND date = ? AND check_in IS NOT NULL AND check_out IS NULL`
  ).bind(body.staffId, today).first();

  if (!attendance) {
    return c.json({ success: false, error: "No active check-in found" }, 404);
  }

  // Calculate hours worked
  const checkInTime = new Date(`${attendance.date}T${attendance.check_in}`);
  const checkOutTime = new Date(`${today}T${currentTime}`);
  const hoursWorked = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60) * 100) / 100;

  await db.prepare(
    `UPDATE staff_attendance SET check_out = ?, hours_worked = ?, status = 'completed', device_fingerprint = ?, location = ?, notes = ?, updated_at = ? WHERE id = ?`
  ).bind(currentTime, hoursWorked, body.deviceFingerprint || null, body.location || null, body.notes || null, now, attendance.id).run();

  // Update shift status
  if (attendance.shift_id) {
    await db.prepare("UPDATE staff_shifts SET status = 'completed', updated_at = ? WHERE id = ?").bind(now, attendance.shift_id).run();
  }

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, "attendance_check_out", "staff_attendance", attendance.id, JSON.stringify({ hoursWorked }), now).run();

  const updated = await db.prepare("SELECT * FROM staff_attendance WHERE id = ?").bind(attendance.id).first();

  return c.json({ success: true, data: updated });
});

// GET /api/staff/attendance - List attendance
openApiStaffRouter.openapi(StaffRoutes.attendance.list, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const query = c.req.valid("query");
  const { page = 1, limit = 20, sort = "date", order = "desc", staffId, dateFrom, dateTo, status } = query;

  let whereClause = "WHERE 1=1";
  const params: (string | number)[] = [];

  if (staffId) {
    whereClause += ` AND sa.staff_id = ?`;
    params.push(staffId);
  }
  if (dateFrom) {
    whereClause += ` AND sa.date >= ?`;
    params.push(dateFrom);
  }
  if (dateTo) {
    whereClause += ` AND sa.date <= ?`;
    params.push(dateTo);
  }
  if (status) {
    whereClause += ` AND sa.status = ?`;
    params.push(status);
  }

  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM staff_attendance sa ${whereClause}`
  ).bind(...params).first();
  const total = countResult?.total || 0;

  const offset = (page - 1) * limit;
  const orderClause = `${sort} ${order.toUpperCase()}`;
  const rows = await db.prepare(
    `SELECT sa.*, u.name as staff_name
     FROM staff_attendance sa
     LEFT JOIN users u ON sa.staff_id = u.id
     ${whereClause}
     ORDER BY ${orderClause}
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return c.json({
    success: true,
    data: { attendance: rows.results, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
  });
});

// Helper function
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "aura_salt_" + crypto.randomUUID());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export default openApiStaffRouter;