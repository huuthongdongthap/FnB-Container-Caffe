import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { getCustomerMenu, getCustomerMenuItem } from '@aura/domain-catalog';
import { optionalAuth } from '../../middleware/auth';
import { FORBIDDEN_TENANT_SENTINEL, resolveCatalogTenantId } from '../openapi-products-handlers/helpers';

const CATALOG_STAFF_ROLES = new Set([
  'owner',
  'admin',
  'manager',
  'supervisor',
  'staff',
  'cashier',
  'barista',
  'kitchen',
  'chef',
  'waiter',
  'warehouse',
]);

export async function getCustomerMenuHandler(c: Context<{ Bindings: Env }>) {
  if (!c.get('user' as never) && c.req.header('Authorization')) {
    await optionalAuth()(c, async () => {});
  }
  const tenantId = resolveCatalogTenantId(c);
  if (tenantId === FORBIDDEN_TENANT_SENTINEL) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  const db = c.env.AURA_DB;
  const category = c.req.query('category');
  const user = c.get('user' as never) as { role?: string } | undefined;
  const userRole = typeof user?.role === 'string' ? user.role.trim().toLowerCase() : '';
  const includeUnavailable = c.req.query('include_unavailable') === 'true' && CATALOG_STAFF_ROLES.has(userRole);
  const locale = c.req.query('locale') || 'vi-VN';

  const menu = await getCustomerMenu(db, { category, includeUnavailable, locale, tenantId });
  return c.json({
    success: true,
    data: menu,
    meta: {
      locale: locale === 'en-US' ? 'en-US' : 'vi-VN',
    },
  });
}

export async function getMenuItemHandler(c: Context<{ Bindings: Env }>) {
  if (!c.get('user' as never) && c.req.header('Authorization')) {
    await optionalAuth()(c, async () => {});
  }
  const db = c.env.AURA_DB;
  const id = c.req.param('id');

  if (!id) {
    return c.json({ success: false, error: 'Item ID is required' }, 400);
  }

  const tenantId = resolveCatalogTenantId(c);
  if (tenantId === FORBIDDEN_TENANT_SENTINEL) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  const item = await getCustomerMenuItem(db, id, { tenantId });
  if (!item) {
    return c.json({ success: false, error: 'Menu item not found' }, 404);
  }

  return c.json({ success: true, data: item });
}
