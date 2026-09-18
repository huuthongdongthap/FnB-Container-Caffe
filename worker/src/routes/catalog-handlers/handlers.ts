import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { getCustomerMenu, getCustomerMenuItem } from '@aura/domain-catalog';

export async function getCustomerMenuHandler(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const category = c.req.query('category');
  const includeUnavailable = c.req.query('include_unavailable') === 'true';
  const locale = c.req.query('locale') || 'vi-VN';

  const menu = await getCustomerMenu(db, { category, includeUnavailable, locale });
  return c.json({
    success: true,
    data: menu,
    meta: {
      locale: locale === 'en-US' ? 'en-US' : 'vi-VN',
    },
  });
}

export async function getMenuItemHandler(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');

  if (!id) {
    return c.json({ success: false, error: 'Item ID is required' }, 400);
  }

  const item = await getCustomerMenuItem(db, id);
  if (!item) {
    return c.json({ success: false, error: 'Menu item not found' }, 404);
  }

  return c.json({ success: true, data: item });
}
