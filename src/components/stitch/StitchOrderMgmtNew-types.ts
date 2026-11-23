/**
 * StitchOrderMgmtNew Types
 * Type definitions for the AURA CAFE Order Management Terminal.
 */
import type React from 'react';

/* ─── Order Types ────────────────────────────────────────────────────── */

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivering'
  | 'served'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'expired';

export type OrderChannel = 'dine_in' | 'takeaway' | 'delivery';

export type OrderSearchFieldType =
  | 'all'
  | 'id'
  | 'customer_name'
  | 'customer_phone'
  | 'table'
  | 'item'
  | 'address'
  | 'notes';

export interface OrderItem {
  name: string;
  quantity: number;
  notes?: string;
  modifiers?: string[];
}

export interface OrderData {
  id: string;
  customer: string;
  customerPhone?: string;
  customerAddress?: string;
  table: string;
  tableName?: string;
  orderType?: OrderChannel;
  paymentMethod?: string;
  paymentStatus?: string;
  notes?: string;
  deliveryTime?: string;
  createdAt?: string;
  createdTimeLabel?: string;
  timeAgo: string;
  status: OrderStatus;
  items: OrderItem[];
  total: string;
  cancelledReason?: string;
  nextActionLabel?: string;
  nextActionStatus?: string;
  nextActionDisabled?: boolean;
  nextActionTooltip?: string;
  canConfirm?: boolean;
  canCancel?: boolean;
  unpaidWarning?: string;
  additionalActions?: React.ReactNode;
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
  activeChannel?: OrderChannel | 'all';
  searchQuery?: string;
  searchField?: OrderSearchFieldType;
  statusCounts?: Record<string, number>;
  isLoading?: boolean;
  error?: string | null;
  mutationError?: string | null;
  onDismissMutationError?: () => void;
  onFilterChange?: (filter: OrderStatus | 'all') => void;
  onChannelChange?: (channel: OrderChannel | 'all') => void;
  onSearch?: (query: string) => void;
  onSearchFieldChange?: (field: OrderSearchFieldType) => void;
  onOrderAction?: (orderId: string, action: string) => void;
  onViewDetails?: (order: OrderData) => void;
  onCancelOrder?: (order: OrderData) => void;
  onEditOrder?: (order: OrderData) => void;
  onPrintOrder?: (order: OrderData) => void;
  onRefresh?: () => void;
  currentPage?: number;
  pageSize?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  showDashboardPanels?: boolean;
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
