export interface KDSOrder {
  id: string;
  orderNumber?: string;
  customerName?: string;
  table: string;
  orderType?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  deliveryTime?: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled';
  items: Array<{
    id?: string;
    name: string;
    quantity: number;
    modifiers?: string[];
    notes?: string;
    ready?: boolean;
    status?: string;
    startedAt?: string;
    readyAt?: string;
  }>;
  notes?: string;
  station?: string;
  cancelAlert?: boolean;
  createdAt: string;
  updatedAt?: string;
  startedAt?: string;
  readyAt?: string;
}

/** Avoids duplicate 'Bàn Bàn 1' or 'Table Table 1' when cafe_tables.name already carries the prefix. */
export function formatTableWithPrefix(
  rawTable: string | null | undefined,
  prefixFormatter: (cleanTable: string) => string,
): string {
  const trimmed = typeof rawTable === 'string' ? rawTable.trim() : '';
  if (!trimmed) return '';
  if (/^(bàn|ban|table)\s+/i.test(trimmed)) {
    return trimmed;
  }
  return prefixFormatter(trimmed);
}

/** Snapshot payload from GET /api/kds/orders/stream (D1-backed). */
export interface KdsStreamOrder {
  id: string;
  order_number?: string | null;
  customer_name: string;
  table_id: string | null;
  table_name?: string | null;
  order_type?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  delivery_time?: string | null;
  items: Array<{ product_name: string; product_id?: string; quantity: number; unit_price?: number; notes?: string }>;
  notes?: string | null;
  status: string;
  elapsed_minutes: number;
  created_at: string;
  updated_at?: string | null;
  started_at?: string | null;
  ready_at?: string | null;
  cancel_alert?: boolean;
  kds_alert?: string;
}

/** Strip internal cron/system tags like `[OVERDUE]` from customer-facing order notes. */
export function stripInternalOrderTags(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const cleaned = raw
    .split('|')
    .map((part) => part.replace(/\[OVERDUE\]/gi, '').trim())
    .filter(Boolean)
    .join(' | ');
  return cleaned || undefined;
}


function normalizeModifiers(mods: unknown): string[] | undefined {
  if (!Array.isArray(mods)) return undefined;
  const names = mods
    .map((m) => (typeof m === 'string' ? m : String((m as { name?: unknown })?.name ?? '')))
    .filter(Boolean);
  return names.length > 0 ? names : undefined;
}

export function mapStreamOrders(orders: KdsStreamOrder[]): KDSOrder[] {
  return orders.map((o) => {
    const cleanedNotes = stripInternalOrderTags(o.notes);
    return {
      id: o.id,
      ...(typeof o.order_number === 'string' && o.order_number.trim() ? { orderNumber: o.order_number.trim() } : {}),
      ...(typeof o.customer_name === 'string' && o.customer_name.trim() ? { customerName: o.customer_name.trim() } : {}),
      table: (typeof o.table_name === 'string' && o.table_name.trim()) || o.table_id || '',
      ...(typeof o.order_type === 'string' && o.order_type.trim() ? { orderType: o.order_type.trim().toLowerCase() } : {}),
      ...(typeof o.payment_status === 'string' && o.payment_status.trim() ? { paymentStatus: o.payment_status.trim().toLowerCase() } : {}),
      ...(typeof o.payment_method === 'string' && o.payment_method.trim() ? { paymentMethod: o.payment_method.trim().toLowerCase() } : {}),
      ...(typeof o.delivery_time === 'string' && o.delivery_time.trim() ? { deliveryTime: o.delivery_time.trim() } : {}),
      status: o.status as KDSOrder['status'],
      items: (o.items || []).map((item) => {
        const rawItem = item as Record<string, unknown>;
        const modifiers = normalizeModifiers(rawItem.modifiers);
        const itemId = rawItem.id ?? rawItem.product_id ?? rawItem.productId ?? rawItem.menuItemId;
        const itemReadyAt = rawItem.ready_at ?? rawItem.readyAt;
        const itemStartedAt = rawItem.started_at ?? rawItem.startedAt;
        const isReady = rawItem.ready === true || rawItem.status === 'ready' || Boolean(itemReadyAt);
        return {
          ...(typeof itemId === 'string' && itemId.trim() ? { id: itemId.trim() } : {}),
          name: String(item.product_name ?? rawItem.name ?? ''),
          quantity: Number(item.quantity ?? rawItem.qty ?? 1),
          ...(modifiers ? { modifiers } : {}),
          ...(item.notes || rawItem.note ? { notes: String(item.notes ?? rawItem.note) } : {}),
          ...(isReady ? { ready: true, status: 'ready' } : typeof rawItem.status === 'string' ? { status: rawItem.status } : {}),
          ...(typeof itemStartedAt === 'string' && itemStartedAt.trim() ? { startedAt: itemStartedAt.trim() } : {}),
          ...(typeof itemReadyAt === 'string' && itemReadyAt.trim() ? { readyAt: itemReadyAt.trim() } : {}),
        };
      }),
      ...(cleanedNotes ? { notes: cleanedNotes } : {}),
      ...(o.cancel_alert || o.kds_alert === 'cancelled' ? { cancelAlert: true } : {}),
      createdAt: o.created_at,
      ...(typeof o.updated_at === 'string' && o.updated_at.trim() ? { updatedAt: o.updated_at.trim() } : {}),
      ...(typeof o.started_at === 'string' && o.started_at.trim() ? { startedAt: o.started_at.trim() } : {}),
      ...(typeof o.ready_at === 'string' && o.ready_at.trim() ? { readyAt: o.ready_at.trim() } : {}),
    };
  });
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
    const cleanedNotes = stripInternalOrderTags(raw.notes);
    return {
      ...(raw as unknown as KDSOrder),
      ...(cleanedNotes ? { notes: cleanedNotes } : { notes: undefined }),
    };
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

  const rawOrderType = raw.orderType ?? raw.order_type;
  const rawPaymentStatus = raw.paymentStatus ?? raw.payment_status;
  const rawPaymentMethod = raw.paymentMethod ?? raw.payment_method;
  const rawDeliveryTime = raw.deliveryTime ?? raw.delivery_time;
  const cleanedNotes = stripInternalOrderTags(raw.notes);
  const rawCustomerName = raw.customerName ?? raw.customer_name;
  const rawOrderNumber = raw.orderNumber ?? raw.order_number;
  const rawUpdatedAt = raw.updatedAt ?? raw.updated_at;
  const rawStartedAt = raw.startedAt ?? raw.started_at;
  const rawReadyAt = raw.readyAt ?? raw.ready_at;
  return {
    id: String(raw.id ?? ''),
    ...(typeof rawOrderNumber === 'string' && rawOrderNumber.trim() ? { orderNumber: rawOrderNumber.trim() } : {}),
    ...(typeof rawCustomerName === 'string' && rawCustomerName.trim() ? { customerName: rawCustomerName.trim() } : {}),
    table: String(raw.table_name ?? raw.table ?? raw.table_number ?? raw.table_id ?? ''),
    ...(typeof rawOrderType === 'string' && rawOrderType.trim() ? { orderType: rawOrderType.trim().toLowerCase() } : {}),
    ...(typeof rawPaymentStatus === 'string' && rawPaymentStatus.trim() ? { paymentStatus: rawPaymentStatus.trim().toLowerCase() } : {}),
    ...(typeof rawPaymentMethod === 'string' && rawPaymentMethod.trim() ? { paymentMethod: rawPaymentMethod.trim().toLowerCase() } : {}),
    ...(typeof rawDeliveryTime === 'string' && rawDeliveryTime.trim() ? { deliveryTime: rawDeliveryTime.trim() } : {}),
    status: (raw.status as KDSOrder['status']) || 'pending',
    items: parsedItems.map((item) => {
      const modifiers = normalizeModifiers(item.modifiers);
      const itemId = item.id ?? item.product_id ?? item.productId ?? item.menuItemId;
      const itemReadyAt = item.ready_at ?? item.readyAt;
      const itemStartedAt = item.started_at ?? item.startedAt;
      const isReady = item.ready === true || item.status === 'ready' || Boolean(itemReadyAt);
      return {
        ...(typeof itemId === 'string' && itemId.trim() ? { id: itemId.trim() } : {}),
        name: String(item.name ?? item.product_name ?? ''),
        quantity: Number(item.quantity ?? item.qty ?? 1),
        ...(modifiers ? { modifiers } : {}),
        ...(item.notes || item.note ? { notes: String(item.notes ?? item.note) } : {}),
        ...(isReady ? { ready: true, status: 'ready' } : typeof item.status === 'string' ? { status: item.status } : {}),
        ...(typeof itemStartedAt === 'string' && itemStartedAt.trim() ? { startedAt: itemStartedAt.trim() } : {}),
        ...(typeof itemReadyAt === 'string' && itemReadyAt.trim() ? { readyAt: itemReadyAt.trim() } : {}),
      };
    }),
    ...(cleanedNotes ? { notes: cleanedNotes } : {}),
    ...(typeof raw.station === 'string' ? { station: raw.station } : {}),
    ...(raw.cancelAlert || raw.cancel_alert || raw.kds_alert === 'cancelled' ? { cancelAlert: true } : {}),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
    ...(typeof rawUpdatedAt === 'string' && rawUpdatedAt.trim() ? { updatedAt: rawUpdatedAt.trim() } : {}),
    ...(typeof rawStartedAt === 'string' && rawStartedAt.trim() ? { startedAt: rawStartedAt.trim() } : {}),
    ...(typeof rawReadyAt === 'string' && rawReadyAt.trim() ? { readyAt: rawReadyAt.trim() } : {}),
  };
}
