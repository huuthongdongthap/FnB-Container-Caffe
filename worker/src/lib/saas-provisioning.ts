/**
 * Atomic Self-Serve SaaS Tenant Provisioning.
 *
 * Uses D1 `db.batch(...)` so owner account creation, tenant record, 14-day trial
 * subscription, branding, categories, products, BOM recipes, cafe_tables, and
 * initial shifts either commit together or roll back cleanly with zero orphans.
 */

import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { hashPassword } from './jwt';
import { GRACE_DAYS, SAAS_PLANS, TRIAL_DAYS, normalizeSaasPlanId, type SaasPlanId } from './saas-plans';
import { addDaysIso } from './saas-entitlement';
import { SAAS_TEMPLATES, isValidTemplateId, type SaasTemplateId } from './saas-templates';

const RESERVED_SLUGS = new Set([
  'default',
  'hq',
  'admin',
  'api',
  'app',
  'www',
  'saas',
  's',
  'auth',
  'login',
  'register',
  'signup',
  'billing',
  'webhook',
  'webhooks',
  'kds',
  'pos',
  'menu',
  'table',
  'order',
  'orders',
  'static',
  'assets',
  'support',
  'help',
  'docs',
  'status',
  'aura',
]);

export function sanitizeSlug(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function validateSlug(slug: string): { valid: boolean; reason?: string } {
  if (!slug || slug.length < 3) {
    return { valid: false, reason: 'Đường dẫn quán phải có ít nhất 3 ký tự.' };
  }
  if (slug.length > 48) {
    return { valid: false, reason: 'Đường dẫn quán tối đa 48 ký tự.' };
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    return { valid: false, reason: 'Chỉ dùng chữ thường không dấu, số và dấu gạch ngang (-).' };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { valid: false, reason: `Đường dẫn "${slug}" thuộc danh sách bảo lưu của hệ thống.` };
  }
  return { valid: true };
}

export async function isSlugAvailable(
  db: D1Database,
  rawSlug: string
): Promise<{ available: boolean; slug: string; reason?: string }> {
  const slug = sanitizeSlug(rawSlug);
  const check = validateSlug(slug);
  if (!check.valid) {
    return { available: false, slug, reason: check.reason };
  }
  const existing = await db
    .prepare('SELECT id FROM saas_tenants WHERE slug = ? OR subdomain = ? LIMIT 1')
    .bind(slug, slug)
    .first<{ id: string }>();
  if (existing) {
    return { available: false, slug, reason: 'Đường dẫn quán này đã được sử dụng.' };
  }
  return { available: true, slug };
}

export interface ProvisionTenantInput {
  shopName: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  password: string;
  templateId?: string;
  planId?: string;
  address?: string;
  primaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  attribution?: Record<string, string>;
}

function sanitizeAttribution(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const clean: Record<string, string> = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= 16) break;
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(k)) continue;
    if (typeof v !== 'string') continue;
    const trimmed = v.trim().slice(0, 200);
    if (!trimmed) continue;
    clean[k] = trimmed;
    count++;
  }
  return count > 0 ? clean : undefined;
}

export interface ProvisionTenantResult {
  tenantId: string;
  slug: string;
  shopName: string;
  ownerId: string;
  ownerEmail: string;
  templateId: SaasTemplateId;
  planId: SaasPlanId;
  trialEndsAt: string;
  graceEndsAt: string;
  seededCounts: {
    categories: number;
    products: number;
    ingredients: number;
    recipes: number;
    tables: number;
    shifts: number;
  };
}

export class ProvisionError extends Error {
  constructor(
    public readonly status: 400 | 409 | 500,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ProvisionError';
  }
}

export async function provisionSelfServeTenant(
  db: D1Database,
  input: ProvisionTenantInput,
  now: Date = new Date()
): Promise<ProvisionTenantResult> {
  const shopName = String(input.shopName || '').trim();
  const ownerName = String(input.ownerName || '').trim();
  const ownerEmail = String(input.ownerEmail || '').trim().toLowerCase();
  const ownerPhone = String(input.ownerPhone || '').trim();
  const password = String(input.password || '');

  if (shopName.length < 2 || shopName.length > 100) {
    throw new ProvisionError(400, 'invalid_shop_name', 'Tên quán phải từ 2 đến 100 ký tự.');
  }
  if (ownerName.length < 2 || ownerName.length > 80) {
    throw new ProvisionError(400, 'invalid_owner_name', 'Họ tên chủ quán phải từ 2 đến 80 ký tự.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    throw new ProvisionError(400, 'invalid_email', 'Email chủ quán không hợp lệ.');
  }
  if (password.length < 8) {
    throw new ProvisionError(400, 'weak_password', 'Mật khẩu phải có ít nhất 8 ký tự.');
  }

  const slugCheck = await isSlugAvailable(db, input.slug);
  if (!slugCheck.available) {
    throw new ProvisionError(409, 'slug_unavailable', slugCheck.reason || 'Slug không khả dụng.');
  }
  const slug = slugCheck.slug;

  const existingEmail = await db
    .prepare('SELECT email FROM staff_login_identities WHERE email = ? LIMIT 1')
    .bind(ownerEmail)
    .first<{ email: string }>();
  if (existingEmail) {
    throw new ProvisionError(409, 'email_already_registered', 'Email này đã được đăng ký tài khoản.');
  }

  const templateId: SaasTemplateId =
    input.templateId && isValidTemplateId(input.templateId)
      ? input.templateId
      : 'traditional-cafe';
  const template = SAAS_TEMPLATES[templateId];
  const planId: SaasPlanId = normalizeSaasPlanId(input.planId || 'pro');
  const plan = SAAS_PLANS[planId];

  const tenantId = `ten_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const ownerId = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const subscriptionId = `sub_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const auditId = `aud_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const passwordHash = await hashPassword(password);

  const nowIso = now.toISOString();
  const todayStr = nowIso.slice(0, 10);
  const trialEndsAt = addDaysIso(now, TRIAL_DAYS);
  const graceEndsAt = addDaysIso(now, TRIAL_DAYS + GRACE_DAYS);

  const primaryColor = /^#[0-9a-fA-F]{6}$/.test(String(input.primaryColor || ''))
    ? String(input.primaryColor)
    : template.primaryColor;
  const accentColor = /^#[0-9a-fA-F]{6}$/.test(String(input.accentColor || ''))
    ? String(input.accentColor)
    : template.accentColor;
  const attribution = sanitizeAttribution(input.attribution);
  const tenantConfig = {
    templateId,
    planId,
    currency: 'VND',
    ...(attribution ? { attribution } : {}),
  };

  const statements: D1PreparedStatement[] = [];

  // 1. Tenant master record
  statements.push(
    db
      .prepare(
        `INSERT INTO saas_tenants (
          id, name, slug, subdomain, template_id, owner_user_id, owner_email, owner_name, owner_phone,
          tier, status, trial_ends_at, current_period_end, config_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'trial', ?, ?, ?, ?, ?)`
      )
      .bind(
        tenantId,
        shopName,
        slug,
        slug,
        templateId,
        ownerId,
        ownerEmail,
        ownerName,
        ownerPhone,
        planId,
        trialEndsAt,
        trialEndsAt,
        JSON.stringify(tenantConfig),
        nowIso,
        nowIso
      )
  );

  // 2. Owner account + D1 login identity
  statements.push(
    db
      .prepare(
        `INSERT INTO users (
          id, name, role, phone, tenant_id, is_active, auth_version, password_hash, created_at, updated_at
        ) VALUES (?, ?, 'owner', ?, ?, 1, 1, ?, ?, ?)`
      )
      .bind(ownerId, ownerName, ownerPhone || null, tenantId, passwordHash, nowIso, nowIso)
  );
  statements.push(
    db
      .prepare(`INSERT INTO staff_login_identities (email, staff_id) VALUES (?, ?)`)
      .bind(ownerEmail, ownerId)
  );

  // 3. Tenant subscription (14-day full trial + 3-day grace)
  statements.push(
    db
      .prepare(
        `INSERT INTO tenant_subscriptions (
          id, tenant_id, tier, billing_cycle, status, trial_ends_at, grace_ends_at,
          current_period_start, current_period_end, price_vnd, created_at, updated_at
        ) VALUES (?, ?, ?, 'monthly', 'trial', ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        subscriptionId,
        tenantId,
        planId,
        trialEndsAt,
        graceEndsAt,
        nowIso,
        trialEndsAt,
        plan.monthlyPriceVnd,
        nowIso,
        nowIso
      )
  );

  // 4. Tenant branding (clean tenant identity, never inherits AURA branding)
  statements.push(
    db
      .prepare(
        `INSERT INTO tenant_branding (
          tenant_id, display_name, tagline, logo_url, primary_color, accent_color,
          address, phone, receipt_footer, template_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        tenantId,
        shopName,
        template.defaultTagline,
        String(input.logoUrl || '').trim(),
        primaryColor,
        accentColor,
        String(input.address || '').trim(),
        ownerPhone,
        template.receiptFooter,
        templateId,
        nowIso,
        nowIso
      )
  );

  // 5. Default VietQR payment config stub (unconfigured until merchant enters bank/PayOS)
  statements.push(
    db
      .prepare(
        `INSERT INTO tenant_payment_configs (
          tenant_id, provider, is_active, updated_by, created_at, updated_at
        ) VALUES (?, 'vietqr', 1, ?, ?, ?)`
      )
      .bind(tenantId, ownerId, nowIso, nowIso)
  );

  // 6. Seed Categories
  const categoryIdMap = new Map<string, string>();
  for (const cat of template.categories) {
    const catId = `cat_${slug}_${cat.key}`;
    const catSlug = `${slug}-${cat.key}`;
    categoryIdMap.set(cat.key, catId);
    statements.push(
      db
        .prepare(
          `INSERT INTO categories (
            tenant_id, id, name, slug, description, sort_order, display_name_vi, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
        )
        .bind(tenantId, catId, cat.name, catSlug, cat.description, cat.sortOrder, cat.name, nowIso, nowIso)
    );
  }

  // 7. Seed Ingredients & Inventory Items
  const ingredientIdMap = new Map<string, string>();
  for (const ing of template.ingredients) {
    const ingId = `ing_${slug}_${ing.key}`;
    const sku = `${slug.toUpperCase().replace(/-/g, '_')}_${ing.key.toUpperCase().replace(/-/g, '_')}`;
    ingredientIdMap.set(ing.key, ingId);
    statements.push(
      db
        .prepare(
          `INSERT INTO ingredients (
            tenant_id, id, name, sku, category, unit, cost_per_unit, current_stock, min_stock, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'raw_materials', ?, ?, ?, ?, ?, ?)`
        )
        .bind(tenantId, ingId, ing.name, sku, ing.unit, ing.costPerUnit, ing.initialStock, ing.minStock, nowIso, nowIso)
    );
    statements.push(
      db
        .prepare(
          `INSERT INTO inventory_items (
            id, sku, tenant_id, name, category, unit, current_stock, min_stock, cost_per_unit, active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'raw_materials', ?, ?, ?, ?, 1, ?, ?)`
        )
        .bind(
          `inv_${slug}_${ing.key}`,
          sku,
          tenantId,
          ing.name,
          ing.unit,
          ing.initialStock,
          ing.minStock,
          ing.costPerUnit,
          nowIso,
          nowIso
        )
    );
  }

  // 8. Seed Products + BOM Recipes
  let recipeCount = 0;
  template.products.forEach((prod, idx) => {
    const prodId = `prd_${slug}_${prod.key}`;
    const catId = categoryIdMap.get(prod.categoryKey) || `cat_${slug}_${prod.categoryKey}`;
    statements.push(
      db
        .prepare(
          `INSERT INTO products (
            tenant_id, id, category_id, name, slug, price, description, available, is_available, sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?)`
        )
        .bind(tenantId, prodId, catId, prod.name, `${slug}-${prod.key}`, prod.price, prod.description, idx + 1, nowIso, nowIso)
    );

    if (prod.bom.length > 0) {
      const recipeId = `rcp_${slug}_${prod.key}`;
      recipeCount += 1;
      statements.push(
        db
          .prepare(
            `INSERT INTO recipes (
              tenant_id, id, product_id, name, instructions, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(tenantId, recipeId, prodId, `Công thức ${prod.name}`, `Định lượng chuẩn cho ${prod.name}`, nowIso, nowIso)
      );

      prod.bom.forEach((bomItem, bIdx) => {
        const ingId = ingredientIdMap.get(bomItem.ingredientKey);
        if (!ingId) return;
        statements.push(
          db
            .prepare(
              `INSERT INTO recipe_ingredients (
                tenant_id, id, recipe_id, product_id, ingredient_id, quantity, unit, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              tenantId,
              `ri_${slug}_${prod.key}_${bIdx + 1}`,
              recipeId,
              prodId,
              ingId,
              bomItem.quantity,
              bomItem.unit,
              nowIso
            )
        );
      });
    }
  });

  // 9. Seed Cafe Tables (namespaced table_number to avoid global UNIQUE collisions)
  template.tables.forEach((tbl, idx) => {
    const tblId = `tbl_${slug}_${tbl.code.toLowerCase()}`;
    const uniqueTableNumber = `${slug}-${tbl.code}`;
    statements.push(
      db
        .prepare(
          `INSERT INTO cafe_tables (
            id, table_number, code, name, capacity, zone, sort_order, is_active, status, tenant_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'Available', ?, ?, ?)`
        )
        .bind(tblId, uniqueTableNumber, tbl.code, tbl.name, tbl.capacity, tbl.zone, idx + 1, tenantId, nowIso, nowIso)
    );
  });

  // 10. Seed Default Shifts
  for (const shift of template.shifts) {
    statements.push(
      db
        .prepare(
          `INSERT INTO staff_shifts (
            tenant_id, staff_id, staff_name, role, date, shift, start_time, end_time, status, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, 'owner', ?, ?, ?, ?, 'scheduled', 1, ?, ?)`
        )
        .bind(tenantId, ownerId, ownerName, todayStr, shift.name, shift.startTime, shift.endTime, nowIso, nowIso)
    );
  }

  // 11. Audit Log Entry
  statements.push(
    db
      .prepare(
        `INSERT INTO saas_audit_logs (
          id, tenant_id, actor_user_id, actor_role, action, after_json, reason, created_at
        ) VALUES (?, ?, ?, 'owner', 'tenant_self_serve_signup', ?, ?, ?)`
      )
      .bind(
        auditId,
        tenantId,
        ownerId,
        JSON.stringify({ slug, templateId, planId, trialEndsAt, ...(attribution ? { attribution } : {}) }),
        'Self-serve onboarding',
        nowIso
      )
  );

  try {
    await db.batch(statements);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('unique')) {
      throw new ProvisionError(
        409,
        'duplicate_registration',
        'Slug quán hoặc email chủ quán đã tồn tại. Vui lòng chọn giá trị khác.'
      );
    }
    throw new ProvisionError(500, 'provisioning_failed', 'Không thể khởi tạo quán lúc này. Vui lòng thử lại sau.');
  }

  return {
    tenantId,
    slug,
    shopName,
    ownerId,
    ownerEmail,
    templateId,
    planId,
    trialEndsAt,
    graceEndsAt,
    seededCounts: {
      categories: template.categories.length,
      products: template.products.length,
      ingredients: template.ingredients.length,
      recipes: recipeCount,
      tables: template.tables.length,
      shifts: template.shifts.length,
    },
  };
}
