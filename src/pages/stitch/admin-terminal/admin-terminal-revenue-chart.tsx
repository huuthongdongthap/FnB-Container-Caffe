interface RevenueChartProps {
  chartView: 'monthly' | 'quarterly';
  onChartViewChange: (view: 'monthly' | 'quarterly') => void;
}

export function RevenueChart({ chartView, onChartViewChange }: RevenueChartProps) {
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 w-full relative overflow-hidden h-[400px]">
      <div className="flex justify-between items-center mb-8 relative z-10">
        <div>
          <h2 className="font-display text-2xl text-[var(--aura-chrome-bright)]">
            Revenue Growth
          </h2>
          <p className="font-body text-[var(--aura-chrome-mid)]">
            Monthly fiscal performance tracking
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onChartViewChange('monthly')}
            className={`px-4 py-1 rounded text-xs font-bold tracking-widest transition-colors ${
              chartView === 'monthly'
                ? 'bg-[var(--aura-primary)]/30 text-[var(--aura-tertiary)] border border-[var(--aura-tertiary)]/20'
                : 'text-[var(--aura-chrome-mid)] hover:bg-white/5'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => onChartViewChange('quarterly')}
            className={`px-4 py-1 rounded text-xs font-bold tracking-widest transition-colors ${
              chartView === 'quarterly'
                ? 'bg-[var(--aura-primary)]/30 text-[var(--aura-tertiary)] border border-[var(--aura-tertiary)]/20'
                : 'text-[var(--aura-chrome-mid)] hover:bg-white/5'
            }`}
          >
            Quarterly
          </button>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="absolute inset-0 pt-32 pb-8 px-8 pointer-events-none">
        <div className="w-full h-full flex items-end gap-1">
          <svg
            className="w-full h-full"
            preserveAspectRatio="none"
            viewBox="0 0 1000 300"
          >
            <defs>
              <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#CD7F32" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#CD7F32" stopOpacity={0} />
              </linearGradient>
            </defs>
            <path
              d="M0,250 Q100,220 200,240 T400,150 T600,180 T800,80 T1000,50 L1000,300 L0,300 Z"
              fill="url(#chartGradient)"
            />
            <path
              d="M0,250 Q100,220 200,240 T400,150 T600,180 T800,80 T1000,50"
              fill="none"
              filter="drop-shadow(0 0 8px rgba(205,127,50,0.6))"
              stroke="#CD7F32"
              strokeLinecap="round"
              strokeWidth={3}
            />
            <circle cx={200} cy={240} fill="#CD7F32" r={4} />
            <circle cx={400} cy={150} fill="#CD7F32" r={4} />
            <circle cx={600} cy={180} fill="#CD7F32" r={4} />
            <circle cx={800} cy={80} fill="#CD7F32" r={4} />
            <circle className="animate-pulse" cx={1000} cy={50} fill="#CD7F32" r={6} />
          </svg>
        </div>
      </div>

      {/* Grid Lines */}
      <div className="absolute inset-0 p-8 flex flex-col justify-between opacity-10 pointer-events-none">
        <div className="border-b border-[var(--aura-chrome-bright)] w-full" />
      </div>
    </div>
  );
}
