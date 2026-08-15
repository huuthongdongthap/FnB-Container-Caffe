export interface DataPoint {
  label: string;
  value: number;
}

export interface RevenueChartProps {
  data: DataPoint[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  period?: 'daily' | 'weekly' | 'monthly';
  onPeriodChange?: (p: 'daily' | 'weekly' | 'monthly') => void;
  className?: string;
  /** Optional total amount to display below the chart */
  total?: number;
}

export interface ChartPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
