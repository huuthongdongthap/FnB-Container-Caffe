/**
 * CRM — Preference extraction.
 *
 * Pure function: aggregates a customer's order history into preference
 * signals (favourite categories/items, avg order value, preferred channel).
 * No D1, no side effects.
 *
 * Parses `orders.items` JSON defensively — malformed items are skipped
 * so a single bad row cannot poison the whole aggregation.
 */

export interface OrderItemInput {
  name?: string;
  category?: string;
  quantity?: number;
  price?: number;
  total?: number;
}

export interface RawOrderForPreferences {
  total?: number;
  items?: string | OrderItemInput[];
  channel?: string;
  payment_method?: string;
  created_at?: string;
}

export interface CustomerPreferences {
  favouriteCategories: Array<{ category: string; count: number }>;
  favouriteItems: Array<{ name: string; count: number }>;
  avgOrderCents: number;
  preferredChannel: string | null;
  orderCount: number;
  totalSpentCents: number;
}

const EMPTY: CustomerPreferences = {
  favouriteCategories: [],
  favouriteItems: [],
  avgOrderCents: 0,
  preferredChannel: null,
  orderCount: 0,
  totalSpentCents: 0,
};

/**
 * Parse `orders.items` — accepts both JSON string and pre-parsed array.
 * Returns empty array on malformed input.
 */
export function parseOrderItems(raw: unknown): OrderItemInput[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as OrderItemInput[];
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Pure aggregation. `orders[]` is the raw `orders` table rows (items
 * column may be JSON string or array).
 */
export function extractPreferences(
  orders: RawOrderForPreferences[],
): CustomerPreferences {
  if (!orders || orders.length === 0) return EMPTY;

  const categoryCounts = new Map<string, number>();
  const itemCounts = new Map<string, number>();
  const channelCounts = new Map<string, number>();
  let totalSpent = 0;

  for (const order of orders) {
    const total = order.total ?? 0;
    totalSpent += total;

    const channel = order.channel ?? order.payment_method;
    if (channel) {
      channelCounts.set(channel, (channelCounts.get(channel) ?? 0) + 1);
    }

    for (const item of parseOrderItems(order.items)) {
      const cat = item.category;
      if (cat) {
        categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
      }
      const name = item.name;
      if (name) {
        const qty = item.quantity ?? 1;
        itemCounts.set(name, (itemCounts.get(name) ?? 0) + qty);
      }
    }
  }

  const sortedCategories = [...categoryCounts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const sortedItems = [...itemCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const preferredChannel = [...channelCounts.entries()]
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    favouriteCategories: sortedCategories,
    favouriteItems: sortedItems,
    avgOrderCents: Math.round(totalSpent / orders.length),
    preferredChannel,
    orderCount: orders.length,
    totalSpentCents: totalSpent,
  };
}
