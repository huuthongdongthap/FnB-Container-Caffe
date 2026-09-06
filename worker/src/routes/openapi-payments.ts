import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { requireAuth } from "../middleware/auth";
import type { Env } from "../types/env";
import {
  PaymentRoutes,
  PaymentCreateSchema,
  PaymentListQuerySchema,
  PaymentResponseSchema,
  PaymentRefundSchema,
  PayOSWebhookSchema,
  IdParamsSchema,
} from "../schemas/payments";
import {
  SuccessResponseSchema,
  ErrorResponseSchema,
} from "../schemas/common";

export const openApiPaymentsRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to all routes except webhook
openApiPaymentsRouter.use("*", async (c, next) => {
  const path = c.req.path;
  if (path.endsWith("/webhook/payos")) {
    return next();
  }
  return requireAuth(["owner", "manager", "staff"])(c, next);
});

// POST /api/payments - Create payment
openApiPaymentsRouter.openapi(PaymentRoutes.create, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = c.req.valid("json");
  const user = c.get("user");
  const now = new Date().toISOString();

  const id = crypto.randomUUID();
  const paymentNumber = `PAY-${now.slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  // Verify order exists
  const order = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(body.orderId).first();
  if (!order) {
    return c.json({ success: false, error: "Order not found" }, 404);
  }

  // Create payment record
  await db.prepare(
    `INSERT INTO order_payments (id, order_id, payment_number, method, amount, status, provider, provider_reference, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.orderId,
    paymentNumber,
    body.method,
    body.amount,
    "pending",
    body.provider || null,
    body.providerReference || null,
    JSON.stringify(body.metadata || {}),
    now,
    now
  ).run();

  // If PayOS, create payment link
  let paymentUrl: string | null = null;
  if (body.method === "payos" && c.env.PAYOS_CLIENT_ID) {
    // TODO: Integrate with PayOS API to create payment link
    paymentUrl = `https://pay.payos.vn/web/${id}`;
  }

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, "payment_create", "payment", id, JSON.stringify(body), now).run();

  const payment = await db.prepare("SELECT * FROM order_payments WHERE id = ?").bind(id).first();

  return c.json({
    success: true,
    data: {
      ...payment!,
      metadata: payment!.metadata ? JSON.parse(payment!.metadata) : {},
      createdAt: payment!.created_at,
      updatedAt: payment!.updated_at,
    },
  }, 201);
});

// GET /api/payments - List payments
openApiPaymentsRouter.openapi(PaymentRoutes.list, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const query = c.req.valid("query");
  const { page = 1, limit = 20, sort = "created_at", order = "desc", orderId, method, status, dateFrom, dateTo } = query;

  let whereClause = "WHERE 1=1";
  const params: (string | number)[] = [];

  if (orderId) {
    whereClause += ` AND order_id = ?`;
    params.push(orderId);
  }
  if (method) {
    whereClause += ` AND method = ?`;
    params.push(method);
  }
  if (status) {
    whereClause += ` AND status = ?`;
    params.push(status);
  }
  if (dateFrom) {
    whereClause += ` AND date(created_at) >= ?`;
    params.push(dateFrom);
  }
  if (dateTo) {
    whereClause += ` AND date(created_at) <= ?`;
    params.push(dateTo);
  }

  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM order_payments ${whereClause}`
  ).bind(...params).first();
  const total = countResult?.total || 0;

  const offset = (page - 1) * limit;
  const orderClause = `${sort} ${order.toUpperCase()}`;
  const rows = await db.prepare(
    `SELECT op.*, o.order_number FROM order_payments op
     LEFT JOIN orders o ON op.order_id = o.id
     ${whereClause}
     ORDER BY ${orderClause}
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  const payments = rows.results.map(p => ({
    ...p,
    metadata: p.metadata ? JSON.parse(p.metadata) : {},
    order: { id: p.order_id, orderNumber: p.order_number },
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));

  return c.json({
    success: true,
    data: { payments, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
  });
});

// GET /api/payments/:id - Get payment by ID
openApiPaymentsRouter.openapi(PaymentRoutes.get, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid("param");

  const payment = await db.prepare(
    `SELECT op.*, o.order_number FROM order_payments op
     LEFT JOIN orders o ON op.order_id = o.id
     WHERE op.id = ?`
  ).bind(id).first();

  if (!payment) {
    return c.json({ success: false, error: "Payment not found" }, 404);
  }

  return c.json({
    success: true,
    data: {
      ...payment,
      metadata: payment.metadata ? JSON.parse(payment.metadata) : {},
      order: { id: payment.order_id, orderNumber: payment.order_number },
      createdAt: payment.created_at,
      updatedAt: payment.updated_at,
    },
  });
});

// POST /api/payments/:id/refund - Refund payment
openApiPaymentsRouter.openapi(PaymentRoutes.refund, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const user = c.get("user");
  const now = new Date().toISOString();

  const payment = await db.prepare("SELECT * FROM order_payments WHERE id = ?").bind(id).first();
  if (!payment) {
    return c.json({ success: false, error: "Payment not found" }, 404);
  }

  if (payment.status !== "completed") {
    return c.json({ success: false, error: "Can only refund completed payments" }, 409);
  }

  const refundAmount = body.amount || payment.amount;

  // Create refund record (negative amount)
  const refundId = crypto.randomUUID();
  const refundNumber = `REF-${now.slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  await db.prepare(
    `INSERT INTO order_payments (id, order_id, payment_number, method, amount, status, provider, provider_reference, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    refundId,
    payment.order_id,
    refundNumber,
    payment.method,
    -refundAmount,
    "completed",
    payment.provider,
    body.providerReference || null,
    JSON.stringify({ ...JSON.parse(payment.metadata || "{}"), refundReason: body.reason, originalPaymentId: id }),
    now,
    now
  ).run();

  // Update original payment status
  await db.prepare("UPDATE order_payments SET status = 'refunded', updated_at = ? WHERE id = ?").bind(now, id).run();

  // Update order payment status
  const remainingPaid = await db.prepare(
    `SELECT SUM(amount) as total FROM order_payments WHERE order_id = ? AND status = 'completed' AND amount > 0`
  ).bind(payment.order_id).first();

  const order = await db.prepare("SELECT total_amount FROM orders WHERE id = ?").bind(payment.order_id).first();
  let newPaymentStatus = "unpaid";
  if (remainingPaid && remainingPaid.total >= (order?.total_amount || 0)) {
    newPaymentStatus = "paid";
  } else if (remainingPaid && remainingPaid.total > 0) {
    newPaymentStatus = "partial";
  }

  await db.prepare("UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?").bind(newPaymentStatus, now, payment.order_id).run();

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, "payment_refund", "payment", refundId, JSON.stringify({ originalPaymentId: id, reason: body.reason }), now).run();

  const refund = await db.prepare("SELECT * FROM order_payments WHERE id = ?").bind(refundId).first();

  return c.json({
    success: true,
    data: {
      ...refund!,
      metadata: refund!.metadata ? JSON.parse(refund!.metadata) : {},
      createdAt: refund!.created_at,
      updatedAt: refund!.updated_at,
    },
  });
});

// POST /api/payments/webhook/payos - PayOS webhook
openApiPaymentsRouter.openapi(PaymentRoutes.webhook.payos, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = c.req.valid("json");
  const now = new Date().toISOString();

  // Verify webhook signature (simplified - should use PayOS SDK)
  const signature = c.req.header("X-PayOS-Signature");
  if (!signature) {
    return c.json({ success: false, error: "Missing signature" }, 401);
  }

  // Check idempotency
  const existing = await db.prepare(
    `SELECT id FROM order_payments WHERE provider_reference = ?`
  ).bind(body.data.orderCode).first();
  if (existing) {
    return c.json({ success: true, data: { received: true } });
  }

  // Find payment by order code
  const payment = await db.prepare(
    `SELECT * FROM order_payments WHERE provider_reference = ?`
  ).bind(body.data.orderCode).first();

  if (!payment) {
    return c.json({ success: false, error: "Payment not found" }, 404);
  }

  // Update payment status based on webhook
  const statusMap: Record<string, string> = {
    "PAID": "completed",
    "CANCELLED": "cancelled",
    "EXPIRED": "expired",
    "FAILED": "failed",
  };
  const newStatus = statusMap[body.data.status] || "pending";

  await db.prepare("UPDATE order_payments SET status = ?, metadata = ?, updated_at = ? WHERE id = ?")
    .bind(newStatus, JSON.stringify({ ...JSON.parse(payment.metadata || "{}"), webhookData: body }), now, payment.id).run();

  // Update order payment status
  if (newStatus === "completed") {
    const totalPaid = await db.prepare(
      `SELECT SUM(amount) as total FROM order_payments WHERE order_id = ? AND status = 'completed' AND amount > 0`
    ).bind(payment.order_id).first();

    const order = await db.prepare("SELECT total_amount FROM orders WHERE id = ?").bind(payment.order_id).first();
    let orderPaymentStatus = "unpaid";
    if (totalPaid && totalPaid.total >= (order?.total_amount || 0)) {
      orderPaymentStatus = "paid";
    } else if (totalPaid && totalPaid.total > 0) {
      orderPaymentStatus = "partial";
    }

    await db.prepare("UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?").bind(orderPaymentStatus, now, payment.order_id).run();
  }

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, "system", "payment_webhook", "payment", payment.id, JSON.stringify({ status: newStatus }), now).run();

  return c.json({ success: true, data: { received: true } });
});

export default openApiPaymentsRouter;