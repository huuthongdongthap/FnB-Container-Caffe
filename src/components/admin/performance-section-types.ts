/* Performance section shared types */

export interface WebVitalData {
  good: number;
  needsImprovement: number;
  poor: number;
}

export interface WebVitalCardProps {
  name: string;
  displayName: string;
  data: WebVitalData;
  target?: { good: string; poor: string };
  targetThreshold?: { good: number; poor: number };
}

export interface PercentileCardProps {
  label: string;
  value?: number;
}

export interface ErrorCardProps {
  message: string;
  onRetry: () => void;
}
