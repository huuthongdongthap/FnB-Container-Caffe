export interface KDSOrder {
  id: string;
  table: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served';
  items: Array<{
    name: string;
    quantity: number;
    modifiers?: string[];
    notes?: string;
  }>;
  station?: string;
  createdAt: string;
}

/** Snapshot payload from GET /api/kds/orders/stream (D1-backed). */
export interface KdsStreamOrder {
  id: string;
  customer_name: string;
  table_id: string | null;
  items: Array<{ product_name: string; product_id?: string; quantity: number; unit_price?: number; notes?: string }>;
  status: string;
  elapsed_minutes: number;
  created_at: string;
}


function normalizeModifiers(mods: unknown): string[] | undefined {
  if (!Array.isArray(mods)) return undefined;
  const names = mods
    .map((m) => (typeof m === 'string' ? m : String((m as { name?: unknown })?.name ?? '')))
    .filter(Boolean);
  return names.length > 0 ? names : undefined;
}

export function mapStreamOrders(orders: KdsStreamOrder[]): KDSOrder[] {
  return orders.map((o) => ({
    id: o.id,
    table: o.table_id || '',
    status: o.status as KDSOrder['status'],
    items: (o.items || []).map((item) => {
      const rawItem = item as Record<string, unknown>;
      const modifiers = normalizeModifiers(rawItem.modifiers);
      return {
        name: String(item.product_name ?? rawItem.name ?? ''),
        quantity: Number(item.quantity ?? rawItem.qty ?? 1),
        ...(modifiers ? { modifiers } : {}),
        ...(item.notes || rawItem.note ? { notes: String(item.notes ?? rawItem.note) } : {}),
      };
    }),
    createdAt: o.created_at,
  }));
}

export function normalizeKdsOrder(raw: Record<string, unknown>): KDSOrder {
  if (
    typeof raw.table === 'string' &&
    typeof raw.createdAt === 'string' &&
    Array.isArray(raw.items) &&
    raw.items.every(
      (i: unknown) =>
        typeof (i as { name?: unknown })?.name === 'string' &&
        typeof (i as { quantity?: unknown })?.quantity === 'number',
    )
  ) {
    return raw as unknown as KDSOrder;
  }

  let parsedItems: Array<Record<string, unknown>> = [];
  if (Array.isArray(raw.items)) {
    parsedItems = raw.items as Array<Record<string, unknown>>;
  } else if (typeof raw.items === 'string' && raw.items.trim()) {
    try {
      const parsed = JSON.parse(raw.items);
      if (Array.isArray(parsed)) parsedItems = parsed;
    } catch {
      parsedItems = [];
    }
  }

  return {
    id: String(raw.id ?? ''),
    table: String(raw.table ?? raw.table_number ?? raw.table_id ?? ''),
    status: (raw.status as KDSOrder['status']) || 'pending',
    items: parsedItems.map((item) => {
      const modifiers = normalizeModifiers(item.modifiers);
      return {
        name: String(item.name ?? item.product_name ?? ''),
        quantity: Number(item.quantity ?? item.qty ?? 1),
        ...(modifiers ? { modifiers } : {}),
        ...(item.notes || item.note ? { notes: String(item.notes ?? item.note) } : {}),
      };
    }),
    ...(typeof raw.station === 'string' ? { station: raw.station } : {}),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
  };
}
