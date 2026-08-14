export interface RevenueOverview {
  todayRevenue: number;
  yesterdayRevenue: number;
  changePercent: number;
  todayOrders: number;
  yesterdayOrders: number;
  avgOrderValue: number;
}

export interface PeriodDataPoint {
  date: string;
  revenue: number;
}

export type Period = '24h' | '7d' | '30d' | 'custom';
export type GroupBy = 'hour' | 'day' | 'category' | 'payment';
