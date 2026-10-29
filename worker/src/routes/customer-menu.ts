/**
 * Customer Menu Router
 * Canonical M4-B customer menu projection with dual DTO support (data + items).
 */

import { Hono } from 'hono';
import {
  getCustomerMenu,
  getCustomerMenuItem,
  parseAvailabilityFilter,
  type CustomerMenuCategory,
  type CustomerMenuItem,
} from '@aura/domain-catalog';
import type { Env } from '../types/env';

export const customerMenuRouter = new Hono<{ Bindings: Env }>();

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

function toLegacyMenuDto(item: CustomerMenuItem) {
  return {
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
}

customerMenuRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const category = c.req.query('category');
  const availableParam = c.req.query('available') ?? null;
  const availabilityFilter = parseAvailabilityFilter(availableParam);
  const includeUnavailable =
    c.req.query('include_unavailable') === 'true' || availabilityFilter === 0;
  const locale = c.req.query('locale') || 'vi-VN';
  const channel = c.req.query('channel');
  const normalizedSearch = normalizeSearchText(c.req.query('search') ?? '');

  const rawLimit = Number(c.req.query('limit'));
  const hasLimit = Number.isFinite(rawLimit) && rawLimit > 0;
  const rawOffset = Number(c.req.query('offset'));
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  const menu = await getCustomerMenu(db, {
    category,
    includeUnavailable,
    locale,
    channel,
    now: new Date(),
  });

  const matchedItems = menu.categories.flatMap((cat) =>
    cat.items.filter((item) => {
      if (availabilityFilter === 1 && !item.available) return false;
      if (availabilityFilter === 0 && item.available) return false;
      if (normalizedSearch) {
        const matchesName = normalizeSearchText(item.name).includes(normalizedSearch);
        const matchesDesc = normalizeSearchText(item.description ?? '').includes(normalizedSearch);
        if (!matchesName && !matchesDesc) return false;
      }
      return true;
    }),
  );

  const totalMatched = matchedItems.length;
  const limit = hasLimit ? Math.floor(rawLimit) : totalMatched;
  const pagedItems =
    hasLimit || offset > 0
      ? matchedItems.slice(offset, hasLimit ? offset + limit : undefined)
      : matchedItems;

  const includedIds = new Set(pagedItems.map((item) => item.id));
  const categories: CustomerMenuCategory[] = menu.categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => includedIds.has(item.id)),
    }))
    .filter((cat) => cat.items.length > 0);

  return c.json({
    success: true,
    data: {
      ...menu,
      categories,
      totalItems: totalMatched,
    },
    items: pagedItems.map(toLegacyMenuDto),
    pagination: {
      total: totalMatched,
      limit,
      offset,
    },
    meta: { locale: locale === 'en-US' ? 'en-US' : 'vi-VN' },
  });
});

customerMenuRouter.get('/:id', async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const channel = c.req.query('channel');
  const item = await getCustomerMenuItem(db, id, { channel, now: new Date() });

  if (!item) {
    return c.json({ success: false, error: 'Menu item not found' }, 404);
  }
  return c.json({ success: true, data: item, item: toLegacyMenuDto(item) });
});
