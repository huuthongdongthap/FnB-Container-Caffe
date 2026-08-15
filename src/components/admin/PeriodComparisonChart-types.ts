export interface PeriodDataPoint {
  date: string;
  revenue: number;
}

export interface PeriodComparisonChartProps {
  data: {
    current: PeriodDataPoint[];
    previous: PeriodDataPoint[];
  } | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}
