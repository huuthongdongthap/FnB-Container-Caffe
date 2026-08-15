/* ─── Types ─── */

export interface GroupedSalesData {
  groups: {
    label: string;
    value: number;
    count: number;
  }[];
}

export interface GroupedSalesChartProps {
  data: GroupedSalesData | null;
  groupBy: 'hour' | 'day' | 'category' | 'payment';
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}
