/**
 * Customer Menu Router
 * Canonical M4-B customer menu projection with dual DTO support (data + items).
 */

import { Hono } from 'hono';
import { getCustomerMenu, getCustomerMenuItem } from '@aura/domain-catalog';
import type { Env } from '../types/env';

export const customerMenuRouter = new Hono<{ Bindings: Env }>();

customerMenuRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const category = c.req.query('category');
  const includeUnavailable = c.req.query('include_unavailable') === 'true';
  const locale = c.req.query('locale') || 'vi-VN';

  const menu = await getCustomerMenu(db, { category, includeUnavailable, locale });
  const allItems = menu.categories.flatMap((cat) => cat.items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description ?? '',
    price: item.priceCents,
    priceCents: item.priceCents,
    category: item.category,
    image_url: item.imageUrl ?? '',
    imageUrl: item.imageUrl ?? '',
    available: item.available,
    tags: item.tags,
  })));

  return c.json({
    success: true,
    data: menu,
    items: allItems,
    pagination: {
      total: menu.totalItems,
      limit: Number(c.req.query('limit')) || menu.totalItems,
      offset: Number(c.req.query('offset')) || 0,
    },
    meta: { locale: locale === 'en-US' ? 'en-US' : 'vi-VN' },
  });
});

customerMenuRouter.get('/:id', async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const item = await getCustomerMenuItem(db, id);

  if (!item) {
    return c.json({ success: false, error: 'Menu item not found' }, 404);
  }
  const normalizedItem = {
    id: item.id,
    name: item.name,
    description: item.description ?? '',
    price: item.priceCents,
    priceCents: item.priceCents,
    category: item.category,
    image_url: item.imageUrl ?? '',
    imageUrl: item.imageUrl ?? '',
    available: item.available,
    tags: item.tags,
  };
  return c.json({ success: true, data: item, item: normalizedItem });
});
