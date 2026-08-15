import type { Order, OrderStatus } from './order-management-types';

export const STATUS_ACTIONS: Record<OrderStatus, { primary: string; disabled?: boolean }> = {
  pending: { primary: 'Preparing' },
  preparing: { primary: 'Ready' },
  ready: { primary: 'Serve' },
  served: { primary: 'Completed', disabled: true },
  cancelled: { primary: 'View Log' },
};

export const ORDERS: readonly Order[] = [
  { id: '#AC-9821', customer: 'Julian Vane', table: 'Table B01', timeAgo: '2 mins ago', items: 'Midnight Espresso x2, Smoked Truffle Croissant, Hibiscus Cold Brew', total: '$34.50', status: 'pending' },
  { id: '#AC-9819', customer: 'Elena Thorne', table: 'Table A04', timeAgo: '8 mins ago', items: 'Golden Matcha Latte, Lavender Scone, Avocado Sourdough', total: '$28.20', status: 'preparing' },
  { id: '#AC-9818', customer: 'Marcus Chen', table: 'Bar Counter 02', timeAgo: '12 mins ago', items: 'Iced Nitro Cold Brew, Dark Chocolate Ganache Tart', total: '$18.00', status: 'ready' },
  { id: '#AC-9817', customer: 'Sara Loft', table: 'Table C09', timeAgo: '15 mins ago', items: 'Double Espresso, Sparkling Water, Pistachio Macaron x3', total: '$22.50', status: 'served' },
  { id: '#AC-9816', customer: 'David Miller', table: 'Table B05', timeAgo: '1 min ago', items: 'Smoked Salmon Toast, Earl Grey Tea, Mineral Water', total: '$31.00', status: 'pending' },
  { id: '#AC-9815', customer: 'Guest User', table: '—', timeAgo: '—', items: 'Order voided by system', total: '$45.00', status: 'cancelled' },
] as const;

export const FILTERS = ['All', 'Pending', 'Preparing', 'Ready', 'Served'] as const;

export const SIDEBAR_LINKS = [
  { label: 'Dashboard', icon: '', active: false },
  { label: 'Orders', icon: '⭐', active: true },
  { label: 'Inventory', icon: '🛒', active: false },
  { label: 'Staffing', icon: '✅', active: false },
] as const;
