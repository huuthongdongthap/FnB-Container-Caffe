'use client';

import type { PeriodDataPoint } from './PeriodComparisonChart-types';
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  PADDING,
  GRID_FRACS,
  MAX_X_LABELS,
  INNER_W,
  INNER_H,
  BOTTOM_Y,
} from './PeriodComparisonChart-constants';

interface ChartSvgProps {
  current: PeriodDataPoint[];
  previous: PeriodDataPoint[];
  currentPoints: string;
  previousPoints: string;
  currentAreaPoints: string;
  maxValue: number;
}

export function ChartSvg({
  current,
  previous,
  currentPoints,
  previousPoints,
  currentAreaPoints,
  maxValue,
}: ChartSvgProps) {
  const labelCount = Math.min(current.length, MAX_X_LABELS);

  return (
    <div className="w-full" style={{ height: CHART_HEIGHT }}>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="w-full h-full overflow-visible"
      >
        {/* Grid lines */}
        {GRID_FRACS.map((frac) => {
          const y = PADDING.top + INNER_H - frac * INNER_H;
          return (
            <line
              key={frac}
              x1={PADDING.left}
              y1={y}
              x2={PADDING.left + INNER_W}
              y2={y}
              stroke="rgba(201,214,223,0.08)"
              strokeWidth="0.3"
            />
          );
        })}

        {/* Previous period area fill */}
        <polygon
          points={`${previousPoints} ${PADDING.left + INNER_W},${BOTTOM_Y} ${PADDING.left},${BOTTOM_Y}`}
          fill="rgba(128,128,128,0.08)"
        />

        {/* Previous period line */}
        <polyline
          points={previousPoints}
          fill="none"
          stroke="var(--aura-text-muted)"
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1.5,1"
        />

        {/* Previous period dots */}
        {previous.map((d, i) => {
          const x = PADDING.left + (i / Math.max(previous.length - 1, 1)) * INNER_W;
          const y = PADDING.top + INNER_H - (d.revenue / maxValue) * INNER_H;
          return (
            <circle
              key={`prev-${i}`}
              cx={x}
              cy={y}
              r="0.5"
              fill="var(--aura-text-muted)"
            >
              <title>{`${d.date}: ${d.revenue.toLocaleString('vi-VN')}₫`}</title>
            </circle>
          );
        })}

        {/* Current period area fill */}
        <polygon
          points={currentAreaPoints}
          fill="url(#period-current-gradient)"
          opacity={0.2}
        />

        {/* Current period line */}
        <polyline
          points={currentPoints}
          fill="none"
          stroke="var(--aura-chrome-silver)"
          strokeWidth="0.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Current period dots */}
        {current.map((d, i) => {
          const x = PADDING.left + (i / Math.max(current.length - 1, 1)) * INNER_W;
          const y = PADDING.top + INNER_H - (d.revenue / maxValue) * INNER_H;
          return (
            <circle
              key={`cur-${i}`}
              cx={x}
              cy={y}
              r="0.7"
              fill="var(--aura-chrome-silver)"
              stroke="var(--aura-noir-deep)"
              strokeWidth="0.3"
            >
              <title>{`${d.date}: ${d.revenue.toLocaleString('vi-VN')}₫`}</title>
            </circle>
          );
        })}

        {/* Bottom axis labels */}
        {current
          .filter((_, i) => {
            if (current.length <= labelCount) return true;
            const step = Math.floor(current.length / labelCount);
            return i % step === 0 || i === current.length - 1;
          })
          .map((d, _, arr) => {
            const i = current.indexOf(d);
            const x = PADDING.left + (i / Math.max(current.length - 1, 1)) * INNER_W;
            return (
              <text
                key={i}
                x={x}
                y={CHART_HEIGHT - 2}
                textAnchor="middle"
                fill="var(--aura-text-muted)"
                fontSize="2.5"
                fontFamily="var(--aura-font-mono)"
              >
                {d.date.length > 5 ? d.date.slice(0, 4) + '..' : d.date}
              </text>
            );
          })}

        <defs>
          <linearGradient id="period-current-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--aura-chrome-silver)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--aura-chrome-silver)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
