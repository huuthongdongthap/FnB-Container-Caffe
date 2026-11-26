/**
 * StitchOrderMgmtNew Default Data
 * Default configuration, navigation, stats, and sample order data.
 */
import { LayoutDashboard, Receipt, Package, Users } from 'lucide-react';
import type { NavItem, StatCardData, OrderData, FilterTab, OrderStatus, StatusBadgeConfig } from './StitchOrderMgmtNew-types';

/* ─── Glass Panel Class ──────────────────────────────────────────────── */

export const GLASS_CLASSES =
  'bg-white/5 backdrop-blur-[8px] border-[0.5px] border-white/10';

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
  { key: 'confirmed', tKey: 'orderMgmt.confirmed' },
  { key: 'preparing', tKey: 'orderMgmt.preparing' },
  { key: 'ready', tKey: 'orderMgmt.ready' },
  { key: 'delivering', tKey: 'orderMgmt.delivering' },
  { key: 'served', tKey: 'orderMgmt.served' },
  { key: 'delivered', tKey: 'orderMgmt.delivered' },
  { key: 'completed', tKey: 'orderMgmt.completed' },
  { key: 'cancelled', tKey: 'orderMgmt.cancelled' },
  { key: 'failed', tKey: 'orderMgmt.failed' },
  { key: 'expired', tKey: 'orderMgmt.expired' },
];

/* ─── Status Badge Styles (High-contrast FnB semantic colors) ────────── */

export const STATUS_BADGE_CONFIG: Record<OrderStatus, StatusBadgeConfig> = {
  pending: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
    border: 'border-amber-400/40',
    tKey: 'orderMgmt.pending',
  },
  confirmed: {
    bg: 'bg-sky-500/15',
    text: 'text-sky-300',
    border: 'border-sky-400/40',
    tKey: 'orderMgmt.confirmed',
  },
  preparing: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-300',
    border: 'border-blue-400/40',
    tKey: 'orderMgmt.preparing',
  },
  ready: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-300',
    border: 'border-emerald-400/40',
    tKey: 'orderMgmt.ready',
  },
  delivering: {
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-300',
    border: 'border-indigo-400/40',
    tKey: 'orderMgmt.delivering',
  },
  served: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-300',
    border: 'border-slate-400/30',
    tKey: 'orderMgmt.served',
  },
  delivered: {
    bg: 'bg-teal-500/15',
    text: 'text-teal-300',
    border: 'border-teal-400/40',
    tKey: 'orderMgmt.delivered',
  },
  completed: {
    bg: 'bg-slate-600/20',
    text: 'text-slate-300',
    border: 'border-slate-400/30',
    tKey: 'orderMgmt.completed',
  },
  cancelled: {
    bg: 'bg-red-500/15',
    text: 'text-red-300',
    border: 'border-red-400/40',
    tKey: 'orderMgmt.cancelled',
  },
  failed: {
    bg: 'bg-rose-500/15',
    text: 'text-rose-300',
    border: 'border-rose-400/40',
    tKey: 'orderMgmt.failed',
  },
  expired: {
    bg: 'bg-zinc-500/15',
    text: 'text-zinc-300',
    border: 'border-zinc-400/30',
    tKey: 'orderMgmt.expired',
  },
};

export const STATUS_BAR_CLASSES: Record<OrderStatus, string> = {
  pending: 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]',
  confirmed: 'bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.5)]',
  preparing: 'bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]',
  ready: 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]',
  delivering: 'bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.5)]',
  served: 'bg-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.4)]',
  delivered: 'bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.4)]',
  completed: 'bg-slate-500 shadow-[0_0_10px_rgba(100,116,139,0.4)]',
  cancelled: 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.5)]',
  failed: 'bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.5)]',
  expired: 'bg-zinc-400 shadow-[0_0_10px_rgba(161,161,170,0.4)]',
};

/* ─── Status Helpers ─────────────────────────────────────────────────── */

/** Returns the action label key for advancing an order to the next status. */
export function getActionForStatus(status: OrderStatus, orderType?: string): string {
  switch (status) {
    case 'pending': return 'preparing';
    case 'confirmed': return 'preparing';
    case 'preparing': return 'ready';
    case 'ready': return orderType === 'delivery' ? 'delivering' : 'serve';
    case 'delivering': return 'deliver';
    case 'served':
    case 'delivered': return 'complete';
    default: return 'completed';
  }
}
