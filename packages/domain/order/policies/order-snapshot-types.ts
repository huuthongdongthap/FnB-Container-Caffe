/**
 * Order Snapshot Types & Interfaces
 */

import type { Channel, ChannelDeltaConfig, ModifierChoice } from '@aura/domain-catalog';

export interface RawOrderItemInput {
  id?: string;
  product_id?: string;
  productId?: string;
  menuItemId?: string;
  name?: string;
  qty?: number;
  quantity?: number;
  price?: number;
  modifiers?: string[] | ModifierChoice[] | unknown[];
  notes?: string;
  category_id?: string;
  categoryId?: string;
}

export interface EvaluatedOrderItem {
  id?: string;
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  unitPriceCents: number;
  subtotalCents: number;
  modifiers?: unknown[];
  notes?: string | null;
  category_id?: string | null;
}

export interface OrderSnapshotInput {
  items: RawOrderItemInput[];
  order_type?: Channel;
  channel?: Channel;
  shipping_fee?: number;
  discount?: number;
  service_fee?: number;
  tip_amount?: number;
  now?: Date;
  channelDeltas?: ChannelDeltaConfig;
}

export interface OrderSnapshotRejection {
  code:
    | 'item_not_found'
    | 'item_unavailable'
    | 'modifier_invalid'
    | 'modifier_required_missing'
    | 'modifier_max_exceeded'
    | 'modifier_choice_unavailable'
    | 'modifier_choice_not_found';
  message: string;
}

export interface OrderSnapshotResult {
  items: EvaluatedOrderItem[];
  itemsJson: string;
  subtotal: number;
  shipping_fee: number;
  discount: number;
  service_fee: number;
  tip_amount: number;
  total: number;
  rejected: OrderSnapshotRejection | null;
}

export interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      first<T = unknown>(): Promise<T | null>;
      all<T = unknown>(): Promise<{ results?: T[] } | T[]>;
      run(): Promise<unknown>;
    };
  };
}
