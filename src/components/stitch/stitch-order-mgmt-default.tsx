/**
 * StitchOrderMgmtNew Default Data
 * Default configuration, navigation, stats, and sample order data.
 */
import { LayoutDashboard, Receipt, Package, Users } from 'lucide-react';
import type { NavItem, StatCardData, OrderData, FilterTab, OrderStatus, StatusBadgeConfig } from './StitchOrderMgmtNew-types';

/* ─── Glass Panel Class ──────────────────────────────────────────────── */

export const GLASS_CLASSES =
  'bg-white/5 backdrop-blur-xl border-[0.5px] border-white/10';

/* ─── Navigation Items ───────────────────────────────────────────────── */

export const DEFAULT_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', key: 'dashboard', icon: <LayoutDashboard size={20} /> },
  { label: 'Orders', key: 'orders', icon: <Receipt size={20} />, active: true },
  { label: 'Inventory', key: 'inventory', icon: <Package size={20} /> },
  { label: 'Staffing', key: 'staffing', icon: <Users size={20} /> },
];

/* ─── Stats Data ─────────────────────────────────────────────────────── */

export const DEFAULT_STATS: StatCardData[] = [
  { label: 'Active Orders', value: '24', icon: 'activeOrders' },
  { label: 'In Preparation', value: '12', icon: 'inPreparation' },
  { label: 'Ready for Pickup', value: '06', icon: 'readyPickup' },
  { label: 'Avg. Lead Time', value: '8.5m', icon: 'avgLeadTime' },
];

/* ─── Sample Orders ──────────────────────────────────────────────────── */

export const DEFAULT_ORDERS: OrderData[] = [
  {
    id: '#AC-9821', customer: 'Julian Vane', table: 'Table B01',
    timeAgo: '2 mins ago', status: 'pending',
    items: [{ name: 'Midnight Espresso', quantity: 2 }, { name: 'Smoked Truffle Croissant', quantity: 1 }, { name: 'Hibiscus Cold Brew', quantity: 1 }],
    total: '$34.50',
  },
  {
    id: '#AC-9819', customer: 'Elena Thorne', table: 'Table A04',
    timeAgo: '8 mins ago', status: 'preparing',
    items: [{ name: 'Golden Matcha Latte', quantity: 1 }, { name: 'Lavender Scone', quantity: 1 }, { name: 'Avocado Sourdough', quantity: 1 }],
    total: '$28.20',
  },
  {
    id: '#AC-9818', customer: 'Marcus Chen', table: 'Bar Counter 02',
    timeAgo: '12 mins ago', status: 'ready',
    items: [{ name: 'Iced Nitro Cold Brew', quantity: 1 }, { name: 'Dark Chocolate Ganache Tart', quantity: 1 }],
    total: '$18.00',
  },
  {
    id: '#AC-9817', customer: 'Sara Loft', table: 'Table C09',
    timeAgo: '15 mins ago', status: 'served',
    items: [{ name: 'Double Espresso', quantity: 1 }, { name: 'Sparkling Water', quantity: 1 }, { name: 'Pistachio Macaron', quantity: 3 }],
    total: '$22.50',
  },
  {
    id: '#AC-9816', customer: 'David Miller', table: 'Table B05',
    timeAgo: '1 min ago', status: 'pending',
    items: [{ name: 'Smoked Salmon Toast', quantity: 1 }, { name: 'Earl Grey Tea', quantity: 1 }, { name: 'Mineral Water', quantity: 1 }],
    total: '$31.00',
  },
  {
    id: '#AC-9815', customer: 'Guest User', table: '',
    timeAgo: '', status: 'cancelled',
    items: [],
    total: '$45.00',
    cancelledReason: 'Payment Failed',
  },
];

/* ─── Filter Tabs ────────────────────────────────────────────────────── */

export const FILTER_TABS: FilterTab[] = [
  { key: 'all', tKey: 'orderMgmt.all' },
  { key: 'pending', tKey: 'orderMgmt.pending' },
  { key: 'preparing', tKey: 'orderMgmt.preparing' },
  { key: 'ready', tKey: 'orderMgmt.ready' },
  { key: 'served', tKey: 'orderMgmt.served' },
];

/* ─── Status Badge Styles ────────────────────────────────────────────── */

export const STATUS_BADGE_CONFIG: Record<OrderStatus, StatusBadgeConfig> = {
  pending: {
    bg: 'bg-[#2b1701]/40',
    text: 'text-[#e5c099]',
    border: 'border-[#e5c099]/20',
    tKey: 'orderMgmt.pending',
  },
  preparing: {
    bg: 'bg-[#e5c099]/10',
    text: 'text-[#ffddba]',
    border: 'border-[#ffddba]/20',
    tKey: 'orderMgmt.preparing',
  },
  ready: {
    bg: 'bg-[var(--aura-primary, #c6c6c7)]/10',
    text: 'text-[var(--aura-primary, #c6c6c7)]',
    border: 'border-[var(--aura-primary, #c6c6c7)]/20',
    tKey: 'orderMgmt.ready',
  },
  served: {
    bg: 'bg-white/5',
    text: 'text-[var(--aura-text-secondary, #a0a8b0)]',
    border: 'border-white/10',
    tKey: 'orderMgmt.served',
  },
  cancelled: {
    bg: 'bg-[#ffb4ab]/10',
    text: 'text-[#ffb4ab]',
    border: 'border-[#ffb4ab]/20',
    tKey: 'orderMgmt.cancelled',
  },
};

export const STATUS_BAR_CLASSES: Record<OrderStatus, string> = {
  pending: 'bg-[#e5c099] shadow-[0_0_10px_rgba(229,192,153,0.5)]',
  preparing: 'bg-[#ffddba] shadow-[0_0_10px_rgba(255,221,186,0.5)]',
  ready: 'bg-[var(--aura-primary, #c6c6c7)] shadow-[0_0_10px_rgba(184,199,226,0.5)]',
  served: 'bg-[#8e9097] shadow-[0_0_10px_rgba(142,144,151,0.5)]',
  cancelled: 'bg-[#ffb4ab] shadow-[0_0_10px_rgba(255,180,171,0.5)]',
};

/* ─── Status Helpers ─────────────────────────────────────────────────── */

/** Returns the action label for advancing an order to the next status. */
export function getActionForStatus(status: OrderStatus): string {
  switch (status) {
    case 'pending': return 'Preparing';
    case 'preparing': return 'Ready';
    case 'ready': return 'Serve';
    default: return 'Completed';
  }
}
