/** Admin dashboard page-level constants. */

export const DASHBOARD_HELMET = {
  title: 'Admin Dashboard',
  description: 'AURA CAFE admin dashboard — revenue, orders, customers, and analytics',
} as const;

export const PERIOD_OPTIONS = ['daily', 'weekly', 'monthly'] as const;

export type Period = (typeof PERIOD_OPTIONS)[number];

export interface StatsCardConfig {
  key: string;
  valueKey: 'todayRevenue' | 'todayOrders' | 'activeCustomers' | 'avgOrderValue';
  type: 'revenue' | 'count';
  iconName: string;
  translationKey: string;
}

export const STATS_CARDS: StatsCardConfig[] = [
  { key: 'revenue', valueKey: 'todayRevenue', type: 'revenue', iconName: 'DollarSign', translationKey: 'statsTodayRevenue' },
  { key: 'orders', valueKey: 'todayOrders', type: 'count', iconName: 'ClipboardList', translationKey: 'statsOrders' },
  { key: 'customers', valueKey: 'activeCustomers', type: 'count', iconName: 'Users', translationKey: 'statsCustomers' },
  { key: 'avgOrder', valueKey: 'avgOrderValue', type: 'revenue', iconName: 'TrendingUp', translationKey: 'statsAvgOrderValue' },
];
