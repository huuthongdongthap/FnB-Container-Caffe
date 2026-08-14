/**
 * StitchOrderMgmtNew Types
 * Type definitions for the AURA CAFE Order Management Terminal.
 */
import type React from 'react';

/* ─── Order Types ────────────────────────────────────────────────────── */

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';

export interface OrderItem {
  name: string;
  quantity: number;
}

export interface OrderData {
  id: string;
  customer: string;
  table: string;
  timeAgo: string;
  status: OrderStatus;
  items: OrderItem[];
  total: string;
  cancelledReason?: string;
}

/* ─── UI Types ───────────────────────────────────────────────────────── */

export interface StatCardData {
  label: string;
  value: string;
  icon: 'activeOrders' | 'inPreparation' | 'readyPickup' | 'avgLeadTime';
}

export interface NavItem {
  label: string;
  key: string;
  icon: React.ReactNode;
  active?: boolean;
}

/* ─── Component Props ────────────────────────────────────────────────── */

export interface StitchOrderMgmtNewProps {
  brandName?: string;
  brandSubtitle?: string;
  headerTitle?: string;
  headerSubtitle?: string;
  adminName?: string;
  adminAvatarUrl?: string;
  stats?: StatCardData[];
  orders?: OrderData[];
  activeNav?: string;
  activeFilter?: OrderStatus | 'all';
  isLoading?: boolean;
  error?: string | null;
  onFilterChange?: (filter: OrderStatus | 'all') => void;
  onSearch?: (query: string) => void;
  onOrderAction?: (orderId: string, action: string) => void;
  onRefresh?: () => void;
}

/* ─── Status Config Types ────────────────────────────────────────────── */

export interface StatusBadgeConfig {
  bg: string;
  text: string;
  border: string;
  tKey: string;
}

/* ─── Filter Tab Type ────────────────────────────────────────────────── */

export interface FilterTab {
  key: OrderStatus | 'all';
  tKey: string;
}
