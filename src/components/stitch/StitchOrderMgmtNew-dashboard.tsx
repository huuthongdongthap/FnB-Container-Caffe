/**
 * StitchOrderMgmtNew Dashboard Section
 * Revenue analytics chart, staff clock-in panel, and active promotions.
 */
import { cn } from '@/lib/cn';
import { GLASS_CLASSES } from './stitch-order-mgmt-default';

/* ─── Revenue Analytics Chart ────────────────────────────────────────── */

function RevenueChart() {
  const bars = [
    { height: '40%', opacity: 0.2 },
    { height: '65%', opacity: 0.3 },
    { height: '55%', opacity: 0.2 },
    { height: '85%', opacity: 0.5, glow: true },
    { height: '70%', opacity: 0.2 },
    { height: '95%', opacity: 0.65, glow: true },
    { height: '45%', opacity: 0.15 },
  ];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className={cn(GLASS_CLASSES, 'lg:col-span-2 flex flex-col rounded-xl p-6')}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold bg-gradient-to-r from-[#f2c08d] via-[#efbd8a] to-[#d4a574] bg-clip-text text-transparent">
            Revenue Analytics
          </h2>
          <p className="text-[13px] text-[var(--aura-text-secondary, #a0a8b0)]">
            Weekly growth and peak hours
          </p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-full bg-white/10 px-3 py-1 text-[12px] text-[var(--aura-text-primary, #e8e8e8)]">
            Weekly
          </button>
          <button className="rounded-full px-3 py-1 text-[12px] text-[var(--aura-text-secondary, #a0a8b0)] hover:bg-white/5">
            Monthly
          </button>
        </div>
      </div>

      <div className="flex-1 relative flex items-end justify-between gap-3 h-[180px]">
        {bars.map((bar, i) => (
          <div key={i} className="w-full flex-1 rounded-t-lg bg-white/5" style={{ height: bar.height }}>
            <div
              className={cn(
                'h-full rounded-t-lg',
                bar.glow && 'shadow-[0_0_12px_rgba(212,165,116,0.35)]',
              )}
              style={{ backgroundColor: `rgba(212,165,116,${bar.opacity})` }}
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-between px-1 text-[11px] text-[var(--aura-text-secondary, #a0a8b0)] opacity-50">
        {days.map((d) => (
          <span key={d} className={d === 'Sat' ? 'font-bold text-[#d4a574]' : undefined}>
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Staff Clock-In Panel ───────────────────────────────────────────── */

function StaffPanel() {
  const staff = [
    { name: 'Sarah J.', active: true, since: 'Active since 06:00 AM' },
    { name: 'Marcus T.', active: true, since: 'Active since 07:30 AM' },
    { name: 'Elena W.', active: false, since: 'Starts 10:00 AM' },
  ];

  return (
    <div className={cn(GLASS_CLASSES, 'flex flex-col rounded-xl p-6')}>
      <div className="mb-4 text-center">
        <p className="mb-1 text-[12px] uppercase tracking-widest text-[var(--aura-text-secondary, #a0a8b0)] opacity-60">
          Monday, Oct 24
        </p>
        <h2 className="text-5xl font-mono font-extrabold bg-gradient-to-r from-[#f2c08d] via-[#efbd8a] to-[#d4a574] bg-clip-text text-transparent tabular-nums">
          {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </h2>
      </div>

      <div className="mb-4 flex-1 space-y-3 overflow-y-auto pr-1">
        <p className="border-b border-white/10 pb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--aura-text-primary, #e8e8e8)] opacity-60">
          CURRENT SHIFT
        </p>
        {staff.map((s) => (
          <div key={s.name} className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-white/5">
            <div className="flex items-center gap-3">
              <div className={cn('h-2 w-2 rounded-full', s.active ? 'bg-[#d4a574] animate-pulse' : 'bg-white/20')} />
              <span className={cn('text-[13px] font-medium text-[var(--aura-text-primary, #e8e8e8)]', !s.active && 'opacity-50')}>
                {s.name}
              </span>
            </div>
            <span className="text-[12px] text-[var(--aura-text-secondary, #a0a8b0)] opacity-50">{s.since}</span>
          </div>
        ))}
      </div>

      <button className="w-full rounded-xl bg-gradient-to-r from-[#f2c08d] to-[#d4a574] py-4 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[#16130f] shadow-lg shadow-[rgba(212,165,116,0.3)] transition-all hover:brightness-110 active:scale-[0.97]">
        CLOCK IN
      </button>
    </div>
  );
}

/* ─── Active Promotions Panel ────────────────────────────────────────── */

function PromotionsPanel() {
  const promos = [
    {
      title: 'Buy 1 Get 1 Mocha',
      desc: 'Ends in 4h • Afternoon Rush',
      progress: 65,
      color: '#d4a574',
      hoverBorder: 'hover:border-[#d4a574]',
    },
    {
      title: 'Morning Happy Hour',
      desc: '6 AM – 9 AM • 20% Off Pastries',
      progress: 100,
      color: '#f2c08d',
      hoverBorder: 'hover:border-[#f2c08d]',
    },
  ];

  return (
    <div className={cn(GLASS_CLASSES, 'flex flex-col rounded-xl p-6')}>
      <h2 className="font-display mb-5 text-xl font-semibold bg-gradient-to-r from-[#f2c08d] via-[#efbd8a] to-[#d4a574] bg-clip-text text-transparent">
        Active Promotions
      </h2>
      <div className="flex flex-1 flex-col gap-3">
        {promos.map((p) => (
          <div
            key={p.title}
            className={cn(
              'cursor-pointer rounded-xl border border-white/10 bg-white/5 p-4 transition-all group',
              p.hoverBorder,
            )}
          >
            <div className="mb-2 flex items-start justify-between">
              <h4 className="font-bold text-[var(--aura-text-primary, #e8e8e8)]">{p.title}</h4>
              <span className="text-[#d4a574] opacity-0 transition-opacity group-hover:opacity-100">&rsaquo;</span>
            </div>
            <p className="mb-3 text-[12px] text-[var(--aura-text-secondary, #a0a8b0)]">{p.desc}</p>
            <div className="h-1.5 w-full rounded-full bg-white/5">
              <div className="h-full rounded-full transition-all" style={{ width: `${p.progress}%`, backgroundColor: p.color }} />
            </div>
          </div>
        ))}
        <button className="w-full rounded-lg border border-dashed border-white/20 py-3 text-[13px] text-[var(--aura-text-secondary, #a0a8b0)] transition-colors hover:bg-white/5 hover:text-[var(--aura-text-primary, #e8e8e8)]">
          + Create New Promotion
        </button>
      </div>
    </div>
  );
}

/* ─── Dashboard Section Export ───────────────────────────────────────── */

export function StitchOrderMgmtDashboard() {
  return (
    <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <RevenueChart />
      <StaffPanel />
      <PromotionsPanel />
    </section>
  );
}
