import type { PeriodDataPoint } from './PeriodComparisonChart-types';

export const CHART_HEIGHT = 176;
export const CHART_WIDTH = 100;
export const PADDING = { top: 8, right: 4, bottom: 20, left: 4 } as const;

export const GRID_FRACS = [0, 0.25, 0.5, 0.75, 1] as const;

export const MAX_X_LABELS = 7;

export const INNER_W = CHART_WIDTH - PADDING.left - PADDING.right;
export const INNER_H = CHART_HEIGHT - PADDING.top - PADDING.bottom;
export const BOTTOM_Y = PADDING.top + INNER_H;

export function computeChartMetrics(current: PeriodDataPoint[], previous: PeriodDataPoint[]) {
  const currentTotal = current.reduce((s, d) => s + d.revenue, 0);
  const previousTotal = previous.reduce((s, d) => s + d.revenue, 0);
  const changePercent =
    previousTotal > 0
      ? ((currentTotal - previousTotal) / previousTotal) * 100
      : 0;

  const allValues = [...current.map((d) => d.revenue), ...previous.map((d) => d.revenue)];
  const maxValue = Math.max(...allValues, 1);

  return { changePercent, maxValue };
}

export function buildPolylinePoints(
  series: PeriodDataPoint[],
  maxValue: number,
) {
  return series
    .map((d, i) => {
      const x = PADDING.left + (i / Math.max(series.length - 1, 1)) * INNER_W;
      const y = PADDING.top + INNER_H - (d.revenue / maxValue) * INNER_H;
      return `${x},${y}`;
    })
    .join(' ');
}

export function buildAreaPoints(linePoints: string) {
  const firstX = PADDING.left;
  const lastX = PADDING.left + INNER_W;
  return `${linePoints} ${lastX},${BOTTOM_Y} ${firstX},${BOTTOM_Y}`;
}
