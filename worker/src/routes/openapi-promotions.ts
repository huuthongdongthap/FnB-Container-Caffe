import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { requireAuth } from "../middleware/auth";
import type { Env } from "../types/env";
import {
  PromotionRoutes,
  PromotionSchema,
  PromotionCreateSchema,
  PromotionUpdateSchema,
  PromotionValidateSchema,
  PromotionUsageSchema,
  PromotionListQuerySchema,
} from "../schemas/promotions";
import {
  SuccessResponseSchema,
  ErrorResponseSchema,
} from "../schemas/common";

export const openApiPromotionsRouter = new OpenAPIHono<{ Bindings: Env }>();

// Apply auth middleware to all routes
openApiPromotionsRouter.use("*", requireAuth(["owner", "manager", "staff"]));

// GET /api/promotions - List promotions
openApiPromotionsRouter.openapi(PromotionRoutes.list, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const query = c.req.valid("query");
  const { page = 1, limit = 20, sort = "created_at", order = "desc", type, status, isActive, locationId, dateFrom, dateTo } = query;

  let whereClause = "WHERE 1=1";
  const params: (string | number)[] = [];

  if (type) {
    whereClause += ` AND type = ?`;
    params.push(type);
  }
  if (status) {
    whereClause += ` AND status = ?`;
    params.push(status);
  }
  if (isActive !== undefined) {
    whereClause += ` AND is_active = ?`;
    params.push(isActive ? 1 : 0);
  }
  if (locationId) {
    whereClause += ` AND location_id = ?`;
    params.push(locationId);
  }
  if (dateFrom) {
    whereClause += ` AND date(valid_from) >= ?`;
    params.push(dateFrom);
  }
  if (dateTo) {
    whereClause += ` AND date(valid_to) <= ?`;
    params.push(dateTo);
  }

  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM promotions ${whereClause}`
  ).bind(...params).first();
  const total = countResult?.total || 0;

  const offset = (page - 1) * limit;
  const orderClause = `${sort} ${order.toUpperCase()}`;
  const rows = await db.prepare(
    `SELECT * FROM promotions ${whereClause} ORDER BY ${orderClause} LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  const promotions = rows.results.map(p => ({
    ...p,
    discountValue: p.discount_value,
    maxDiscount: p.max_discount,
    minOrderAmount: p.min_order_amount,
    maxUses: p.max_uses,
    currentUses: p.current_uses,
    maxUsesPerCustomer: p.max_uses_per_customer,
    validFrom: p.valid_from,
    validTo: p.valid_to,
    isActive: p.is_active,
    applicableCategories: p.applicable_categories ? JSON.parse(p.applicable_categories) : [],
    applicableProducts: p.applicable_products ? JSON.parse(p.applicable_products) : [],
    excludedProducts: p.excluded_products ? JSON.parse(p.excluded_products) : [],
    applicableLocations: p.applicable_locations ? JSON.parse(p.applicable_locations) : [],
    customerTiers: p.customer_tiers ? JSON.parse(p.customer_tiers) : [],
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));

  return c.json({
    success: true,
    data: { promotions, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
  });
});

// GET /api/promotions/:id - Get promotion by ID
openApiPromotionsRouter.openapi(PromotionRoutes.get, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid("param");

  const promotion = await db.prepare("SELECT * FROM promotions WHERE id = ?").bind(id).first();

  if (!promotion) {
    return c.json({ success: false, error: "Promotion not found" }, 404);
  }

  return c.json({
    success: true,
    data: {
      ...promotion,
      discountValue: promotion.discount_value,
      maxDiscount: promotion.max_discount,
      minOrderAmount: promotion.min_order_amount,
      maxUses: promotion.max_uses,
      currentUses: promotion.current_uses,
      maxUsesPerCustomer: promotion.max_uses_per_customer,
      validFrom: promotion.valid_from,
      validTo: promotion.valid_to,
      isActive: promotion.is_active,
      applicableCategories: promotion.applicable_categories ? JSON.parse(promotion.applicable_categories) : [],
      applicableProducts: promotion.applicable_products ? JSON.parse(promotion.applicable_products) : [],
      excludedProducts: promotion.excluded_products ? JSON.parse(promotion.excluded_products) : [],
      applicableLocations: promotion.applicable_locations ? JSON.parse(promotion.applicable_locations) : [],
      customerTiers: promotion.customer_tiers ? JSON.parse(promotion.customer_tiers) : [],
      createdAt: promotion.created_at,
      updatedAt: promotion.updated_at,
    },
  });
});

// POST /api/promotions - Create promotion
openApiPromotionsRouter.openapi(PromotionRoutes.create, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = c.req.valid("json");
  const user = c.get("user");
  const now = new Date().toISOString();

  const id = crypto.randomUUID();
  const code = body.code || `PROMO-${now.slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  // Validate discount value based on type
  if (body.type === "percentage" && (body.discountValue > 100 || body.discountValue <= 0)) {
    return c.json({ success: false, error: "Percentage discount must be between 1 and 100" }, 400);
  }
  if (body.type === "fixed" && body.discountValue <= 0) {
    return c.json({ success: false, error: "Fixed discount must be positive" }, 400);
  }

  // Check unique code
  const existingCode = await db.prepare("SELECT id FROM promotions WHERE code = ?").bind(code).first();
  if (existingCode) {
    return c.json({ success: false, error: "Promotion code already exists" }, 409);
  }

  await db.prepare(
    `INSERT INTO promotions (
      id, code, name_vi, name_en, description_vi, description_en, type, discount_value,
      max_discount, min_order_amount, max_uses, max_uses_per_customer,
      valid_from, valid_to, is_active, status,
      applicable_categories, applicable_products, excluded_products,
      applicable_locations, customer_tiers, location_id, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    code,
    body.nameVi,
    body.nameEn || null,
    body.descriptionVi || null,
    body.descriptionEn || null,
    body.type,
    body.discountValue,
    body.maxDiscount || null,
    body.minOrderAmount || 0,
    body.maxUses || null,
    body.maxUsesPerCustomer || 1,
    body.validFrom,
    body.validTo,
    body.isActive !== false ? 1 : 0,
    "active",
    body.applicableCategories ? JSON.stringify(body.applicableCategories) : null,
    body.applicableProducts ? JSON.stringify(body.applicableProducts) : null,
    body.excludedProducts ? JSON.stringify(body.excludedProducts) : null,
    body.applicableLocations ? JSON.stringify(body.applicableLocations) : null,
    body.customerTiers ? JSON.stringify(body.customerTiers) : null,
    body.locationId || null,
    user.id,
    now,
    now
  ).run();

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, "promotion_create", "promotion", id, JSON.stringify(body), now).run();

  const promotion = await db.prepare("SELECT * FROM promotions WHERE id = ?").bind(id).first();

  return c.json({
    success: true,
    data: {
      ...promotion!,
      discountValue: promotion!.discount_value,
      maxDiscount: promotion!.max_discount,
      minOrderAmount: promotion!.min_order_amount,
      maxUses: promotion!.max_uses,
      currentUses: promotion!.current_uses,
      maxUsesPerCustomer: promotion!.max_uses_per_customer,
      validFrom: promotion!.valid_from,
      validTo: promotion!.valid_to,
      isActive: promotion!.is_active,
      applicableCategories: promotion!.applicable_categories ? JSON.parse(promotion!.applicable_categories) : [],
      applicableProducts: promotion!.applicable_products ? JSON.parse(promotion!.applicable_products) : [],
      excludedProducts: promotion!.excluded_products ? JSON.parse(promotion!.excluded_products) : [],
      applicableLocations: promotion!.applicable_locations ? JSON.parse(promotion!.applicable_locations) : [],
      customerTiers: promotion!.customer_tiers ? JSON.parse(promotion!.customer_tiers) : [],
      createdAt: promotion!.created_at,
      updatedAt: promotion!.updated_at,
    },
  }, 201);
});

// PUT /api/promotions/:id - Update promotion
openApiPromotionsRouter.openapi(PromotionRoutes.update, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const user = c.get("user");
  const now = new Date().toISOString();

  const existing = await db.prepare("SELECT * FROM promotions WHERE id = ?").bind(id).first();
  if (!existing) {
    return c.json({ success: false, error: "Promotion not found" }, 404);
  }

  // Check unique code if changing
  if (body.code && body.code !== existing.code) {
    const existingCode = await db.prepare("SELECT id FROM promotions WHERE code = ?").bind(body.code).first();
    if (existingCode) {
      return c.json({ success: false, error: "Promotion code already exists" }, 409);
    }
  }

  // Validate discount value based on type
  const type = body.type || existing.type;
  const discountValue = body.discountValue ?? existing.discount_value;
  if (type === "percentage" && (discountValue > 100 || discountValue <= 0)) {
    return c.json({ success: false, error: "Percentage discount must be between 1 and 100" }, 400);
  }
  if (type === "fixed" && discountValue <= 0) {
    return c.json({ success: false, error: "Fixed discount must be positive" }, 400);
  }

  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  const fields = [
    { key: "code", db: "code" },
    { key: "nameVi", db: "name_vi" },
    { key: "nameEn", db: "name_en" },
    { key: "descriptionVi", db: "description_vi" },
    { key: "descriptionEn", db: "description_en" },
    { key: "type", db: "type" },
    { key: "discountValue", db: "discount_value" },
    { key: "maxDiscount", db: "max_discount" },
    { key: "minOrderAmount", db: "min_order_amount" },
    { key: "maxUses", db: "max_uses" },
    { key: "maxUsesPerCustomer", db: "max_uses_per_customer" },
    { key: "validFrom", db: "valid_from" },
    { key: "validTo", db: "valid_to" },
    { key: "isActive", db: "is_active", transform: (v: boolean) => v ? 1 : 0 },
    { key: "status", db: "status" },
    { key: "applicableCategories", db: "applicable_categories", transform: (v: string[]) => JSON.stringify(v) },
    { key: "applicableProducts", db: "applicable_products", transform: (v: string[]) => JSON.stringify(v) },
    { key: "excludedProducts", db: "excluded_products", transform: (v: string[]) => JSON.stringify(v) },
    { key: "applicableLocations", db: "applicable_locations", transform: (v: string[]) => JSON.stringify(v) },
    { key: "customerTiers", db: "customer_tiers", transform: (v: string[]) => JSON.stringify(v) },
    { key: "locationId", db: "location_id" },
  ];

  for (const field of fields) {
    const value = body[field.key as keyof typeof body];
    if (value !== undefined) {
      updates.push(`${field.db} = ?`);
      params.push(field.transform ? field.transform(value) : value);
    }
  }

  updates.push("updated_at = ?");
  params.push(now);
  params.push(id);

  await db.prepare(`UPDATE promotions SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, "promotion_update", "promotion", id, JSON.stringify(body), now).run();

  const promotion = await db.prepare("SELECT * FROM promotions WHERE id = ?").bind(id).first();

  return c.json({
    success: true,
    data: {
      ...promotion!,
      discountValue: promotion!.discount_value,
      maxDiscount: promotion!.max_discount,
      minOrderAmount: promotion!.min_order_amount,
      maxUses: promotion!.max_uses,
      currentUses: promotion!.current_uses,
      maxUsesPerCustomer: promotion!.max_uses_per_customer,
      validFrom: promotion!.valid_from,
      validTo: promotion!.valid_to,
      isActive: promotion!.is_active,
      applicableCategories: promotion!.applicable_categories ? JSON.parse(promotion!.applicable_categories) : [],
      applicableProducts: promotion!.applicable_products ? JSON.parse(promotion!.applicable_products) : [],
      excludedProducts: promotion!.excluded_products ? JSON.parse(promotion!.excluded_products) : [],
      applicableLocations: promotion!.applicable_locations ? JSON.parse(promotion!.applicable_locations) : [],
      customerTiers: promotion!.customer_tiers ? JSON.parse(promotion!.customer_tiers) : [],
      createdAt: promotion!.created_at,
      updatedAt: promotion!.updated_at,
    },
  });
});

// DELETE /api/promotions/:id - Delete promotion (soft delete via status)
openApiPromotionsRouter.openapi(PromotionRoutes.delete, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const { id } = c.req.valid("param");
  const user = c.get("user");
  const now = new Date().toISOString();

  const existing = await db.prepare("SELECT * FROM promotions WHERE id = ?").bind(id).first();
  if (!existing) {
    return c.json({ success: false, error: "Promotion not found" }, 404);
  }

  await db.prepare("UPDATE promotions SET status = 'deleted', updated_at = ? WHERE id = ?").bind(now, id).run();

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, "promotion_delete", "promotion", id, JSON.stringify({ code: existing.code }), now).run();

  return c.json({ success: true, data: { deleted: true } });
});

// POST /api/promotions/validate - Validate promotion code
openApiPromotionsRouter.openapi(PromotionRoutes.validate, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = c.req.valid("json");
  const now = new Date().toISOString();
  const nowDate = new Date();

  const promotion = await db.prepare(
    `SELECT * FROM promotions WHERE code = ? AND is_active = 1 AND status = 'active'`
  ).bind(body.code).first();

  if (!promotion) {
    return c.json({
      success: false,
      error: "Invalid or expired promotion code",
      data: { valid: false },
    }, 400);
  }

  // Check validity period
  if (promotion.valid_from && new Date(promotion.valid_from) > nowDate) {
    return c.json({
      success: false,
      error: "Promotion not yet valid",
      data: { valid: false },
    }, 400);
  }
  if (promotion.valid_to && new Date(promotion.valid_to) < nowDate) {
    return c.json({
      success: false,
      error: "Promotion expired",
      data: { valid: false },
    }, 400);
  }

  // Check max uses
  if (promotion.max_uses && promotion.current_uses >= promotion.max_uses) {
    return c.json({
      success: false,
      error: "Promotion usage limit reached",
      data: { valid: false },
    }, 400);
  }

  // Check min order amount
  if (promotion.min_order_amount && body.orderAmount < promotion.min_order_amount) {
    return c.json({
      success: false,
      error: `Minimum order amount ${promotion.min_order_amount} VND required`,
      data: { valid: false, minOrderAmount: promotion.min_order_amount },
    }, 400);
  }

  // Check customer tier
  if (promotion.customer_tiers && body.customerTier) {
    const allowedTiers = JSON.parse(promotion.customer_tiers);
    if (!allowedTiers.includes(body.customerTier)) {
      return c.json({
        success: false,
        error: "Promotion not available for your tier",
        data: { valid: false },
      }, 400);
    }
  }

  // Check location
  if (promotion.applicable_locations && body.locationId) {
    const allowedLocations = JSON.parse(promotion.applicable_locations);
    if (!allowedLocations.includes(body.locationId)) {
      return c.json({
        success: false,
        error: "Promotion not valid at this location",
        data: { valid: false },
      }, 400);
    }
  }

  // Check applicable products/categories if order items provided
  if (body.orderItems && body.orderItems.length > 0) {
    const applicableProducts = promotion.applicable_products ? JSON.parse(promotion.applicable_products) : [];
    const excludedProducts = promotion.excluded_products ? JSON.parse(promotion.excluded_products) : [];
    const applicableCategories = promotion.applicable_categories ? JSON.parse(promotion.applicable_categories) : [];

    let hasApplicableItem = false;
    for (const item of body.orderItems) {
      if (excludedProducts.includes(item.productId)) {
        continue;
      }
      if (applicableProducts.length === 0 || applicableProducts.includes(item.productId)) {
        hasApplicableItem = true;
        break;
      }
      // Check category (would need to join with products table)
      // For now, skip category check if no product match
    }

    if (applicableProducts.length > 0 && !hasApplicableItem) {
      return c.json({
        success: false,
        error: "No applicable items in order for this promotion",
        data: { valid: false },
      }, 400);
    }
  }

  // Check customer usage limit
  if (body.customerId) {
    const customerUsage = await db.prepare(
      `SELECT COUNT(*) as count FROM promotion_usages WHERE promotion_id = ? AND customer_id = ?`
    ).bind(promotion.id, body.customerId).first();
    if (customerUsage && customerUsage.count >= promotion.max_uses_per_customer) {
      return c.json({
        success: false,
        error: "Customer has reached usage limit for this promotion",
        data: { valid: false },
      }, 400);
    }
  }

  // Calculate discount
  let discountAmount = 0;
  if (promotion.type === "percentage") {
    discountAmount = Math.floor(body.orderAmount * promotion.discount_value / 100);
    if (promotion.max_discount && discountAmount > promotion.max_discount) {
      discountAmount = promotion.max_discount;
    }
  } else if (promotion.type === "fixed") {
    discountAmount = Math.min(promotion.discount_value, body.orderAmount);
  } else if (promotion.type === "free_item") {
    // Free item - discount is the price of the free item
    discountAmount = body.freeItemPrice || 0;
  }

  return c.json({
    success: true,
    data: {
      valid: true,
      promotion: {
        id: promotion.id,
        code: promotion.code,
        nameVi: promotion.name_vi,
        nameEn: promotion.name_en,
        type: promotion.type,
        discountValue: promotion.discount_value,
        maxDiscount: promotion.max_discount,
      },
      discountAmount,
      finalAmount: body.orderAmount - discountAmount,
    },
  });
});

// POST /api/promotions/use - Record promotion usage
openApiPromotionsRouter.openapi(PromotionRoutes.use, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = c.req.valid("json");
  const user = c.get("user");
  const now = new Date().toISOString();

  const promotion = await db.prepare("SELECT * FROM promotions WHERE id = ?").bind(body.promotionId).first();
  if (!promotion) {
    return c.json({ success: false, error: "Promotion not found" }, 404);
  }

  // Check customer usage limit
  if (body.customerId) {
    const customerUsage = await db.prepare(
      `SELECT COUNT(*) as count FROM promotion_usages WHERE promotion_id = ? AND customer_id = ?`
    ).bind(body.promotionId, body.customerId).first();
    if (customerUsage && customerUsage.count >= promotion.max_uses_per_customer) {
      return c.json({ success: false, error: "Customer has reached usage limit" }, 400);
    }
  }

  // Create usage record
  const usageId = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO promotion_usages (id, promotion_id, order_id, customer_id, discount_amount, location_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(usageId, body.promotionId, body.orderId, body.customerId || null, body.discountAmount, body.locationId || null, now).run();

  // Increment promotion usage count
  await db.prepare(
    "UPDATE promotions SET current_uses = current_uses + 1, updated_at = ? WHERE id = ?"
  ).bind(now, body.promotionId).run();

  // Audit log
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(`audit_${Date.now()}`, user.id, "promotion_use", "promotion_usage", usageId, JSON.stringify({ promotionId: body.promotionId, orderId: body.orderId, discountAmount: body.discountAmount }), now).run();

  const usage = await db.prepare("SELECT * FROM promotion_usages WHERE id = ?").bind(usageId).first();

  return c.json({
    success: true,
    data: {
      ...usage!,
      promotionId: usage!.promotion_id,
      orderId: usage!.order_id,
      customerId: usage!.customer_id,
      discountAmount: usage!.discount_amount,
      locationId: usage!.location_id,
      createdAt: usage!.created_at,
    },
  });
});

// GET /api/promotions/summary - Get promotion summary
openApiPromotionsRouter.openapi(PromotionRoutes.summary, async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const query = c.req.valid("query");
  const { locationId, dateFrom, dateTo } = query;

  let whereClause = "WHERE 1=1";
  const params: (string | number)[] = [];

  if (locationId) {
    whereClause += ` AND location_id = ?`;
    params.push(locationId);
  }
  if (dateFrom) {
    whereClause += ` AND date(created_at) >= ?`;
    params.push(dateFrom);
  }
  if (dateTo) {
    whereClause += ` AND date(created_at) <= ?`;
    params.push(dateTo);
  }

  // Total promotions
  const totalPromotions = await db.prepare(
    `SELECT COUNT(*) as total FROM promotions ${whereClause}`
  ).bind(...params).first();

  // Active promotions
  const activePromotions = await db.prepare(
    `SELECT COUNT(*) as total FROM promotions ${whereClause} AND is_active = 1 AND status = 'active'`
  ).bind(...params).first();

  // Total uses
  let usageWhere = "WHERE 1=1";
  const usageParams: (string | number)[] = [];
  if (locationId) {
    usageWhere += ` AND location_id = ?`;
    usageParams.push(locationId);
  }
  if (dateFrom) {
    usageWhere += ` AND date(created_at) >= ?`;
    usageParams.push(dateFrom);
  }
  if (dateTo) {
    usageWhere += ` AND date(created_at) <= ?`;
    usageParams.push(dateTo);
  }

  const totalUses = await db.prepare(
    `SELECT COUNT(*) as total, SUM(discount_amount) as total_discount FROM promotion_usages ${usageWhere}`
  ).bind(...usageParams).first();

  // Top promotions by usage
  const topPromotions = await db.prepare(
    `SELECT p.id, p.code, p.name_vi, p.name_en, p.type, COUNT(pu.id) as use_count, SUM(pu.discount_amount) as total_discount
     FROM promotions p
     LEFT JOIN promotion_usages pu ON p.id = pu.promotion_id ${usageWhere.replace("WHERE 1=1", "AND 1=1")}
     ${whereClause}
     GROUP BY p.id
     ORDER BY use_count DESC
     LIMIT 10`
  ).bind(...params, ...usageParams).all();

  return c.json({
    success: true,
    data: {
      totalPromotions: totalPromotions?.total || 0,
      activePromotions: activePromotions?.total || 0,
      totalUses: totalUses?.total || 0,
      totalDiscountGiven: totalUses?.total_discount || 0,
      topPromotions: topPromotions.results.map(p => ({
        id: p.id,
        code: p.code,
        nameVi: p.name_vi,
        nameEn: p.name_en,
        type: p.type,
        useCount: p.use_count,
        totalDiscount: p.total_discount,
      })),
    },
  });
});

export default openApiPromotionsRouter;