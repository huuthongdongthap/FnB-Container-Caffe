import { useState, useEffect } from 'react';

type TicketStatus = 'PREPARING' | 'PENDING' | 'READY' | 'OVERDUE';
type FilterStatus = 'ALL' | 'PRIORITY' | 'PREPARING' | 'READY';

const STATUS_CONFIG: Record<TicketStatus, { color: string; btn: string; label: string }> = {
  PREPARING: { color: '#D4A574', btn: 'bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)]', label: 'PREPARING' },
  PENDING: { color: 'var(--aura-chrome-mid)', btn: 'bg-white/5 border border-white/10 text-[var(--aura-chrome-mid)]', label: 'PENDING' },
  READY: { color: '#7BA89C', btn: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30', label: 'READY' },
  OVERDUE: { color: '#ef4444', btn: 'bg-red-500 text-white', label: 'OVERDUE' },
};

interface Ticket {
  id: number;
  status: TicketStatus;
  table: string;
  service: string;
  elapsed: string;
  items: { name: string; qty: string; mod?: string }[];
  isPriority?: boolean;
}

const TICKETS: Ticket[] = [
  { id: 9842, status: 'PREPARING', table: 'B01', service: 'DINE IN', elapsed: '08:45', items: [{ name: 'Midnight Espresso', qty: '2x', mod: 'Oat Milk' }, { name: 'Smoked Truffle Croissant', qty: '1x' }] },
  { id: 9843, status: 'PENDING', table: 'B05', service: 'TOGO', elapsed: '02:10', items: [{ name: 'Nitro Tonic', qty: '1x' }, { name: 'Ceremonial Matcha', qty: '1x', mod: 'EXTRA OAT MILK' }] },
  { id: 9841, status: 'READY', table: 'B12', service: 'DINE IN', elapsed: '12:30', items: [{ name: 'Chrome Velvet Latte', qty: '3x' }, { name: 'Bronze Chai', qty: '2x' }] },
  { id: 9844, status: 'PENDING', table: 'B02', service: 'TOGO', elapsed: '00:45', items: [{ name: 'Industrial Cold Brew', qty: '1x' }] },
  { id: 9838, status: 'OVERDUE', table: 'B09', service: 'DELIVERY', elapsed: '18:12', items: [{ name: 'Double Smoked Cortado', qty: '4x' }], isPriority: true },
];

export default function KitchenDisplaySystem() {
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('ALL');
  const [timers, setTimers] = useState<Record<number, string>>(
    Object.fromEntries(TICKETS.map(t => [t.id, t.elapsed]))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const next = { ...prev };
        TICKETS.forEach(t => {
          const raw = next[t.id] ?? '00:00'; const parts = raw.split(':'); const m = Number(parts[0]); const s = Number(parts[1]);
          const newS = s + 1;
          const newM = newS >= 60 ? m + 1 : m;
          next[t.id] = `${String(newM).padStart(2, '0')}:${String(newS % 60).padStart(2, '0')}`;
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredTickets = activeFilter === 'ALL' || activeFilter === 'PRIORITY'
    ? TICKETS
    : TICKETS.filter(t => t.status === activeFilter);

  const counts = {
    PREPARING: TICKETS.filter(t => t.status === 'PREPARING').length,
    PENDING: TICKETS.filter(t => t.status === 'PENDING').length,
    READY: TICKETS.filter(t => t.status === 'READY').length,
  };

  return (
    <div className="flex h-screen bg-[var(--aura-noir-deep)] text-[var(--aura-chrome-bright)]">
      {/* Left Sidebar */}
      <aside className="w-64 bg-[var(--aura-noir-void)] border-r border-white/10 flex flex-col shrink-0">
        <div className="p-5 border-b border-white/10">
          <h1 className="font-display text-headline-md text-[var(--aura-tertiary)] tracking-wider" style={{ fontFamily: 'var(--font-display, serif)' }}>HEARTH & STEEL</h1>
          <p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] mt-1 uppercase tracking-widest">KDS v2.0 / Kitchen Display</p>
        </div>
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl">👨‍🍳</span>
            <div>
              <p className="font-body-sm text-body-sm text-[var(--aura-chrome-bright)]">Station Bar / Quầy bar</p>
              <p className="font-label-caps text-[10px] text-emerald-400">● Online / Hoạt động</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {[{ id: 'Dashboard', icon: '📊' }, { id: 'History', icon: '📜' }, { id: 'Inventory', icon: '📦' }, { id: 'Staff', icon: '👥' }].map(item => (
            <button key={item.id} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] hover:bg-white/5 transition-all font-body text-sm active:scale-[0.98]">
              <span>{item.icon}</span>
              <span className="font-label-caps text-label-caps tracking-wider">{item.id}</span>
            </button>
          ))}
        </nav>
        {/* Capacity */}
        <div className="p-4 border-t border-white/10">
          <div className="p-3 rounded-xl bg-white/5">
            <p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-widest">Station Load</p>
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-[var(--aura-tertiary)] rounded-full" style={{ width: '75%' }} />
            </div>
            <p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] mt-1">75% CAPACITY</p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-[var(--aura-noir-deep)]/80 backdrop-blur-xl border-b border-white/10 px-6 h-16 flex items-center justify-between">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-[var(--aura-chrome-bright)] uppercase tracking-widest">Kitchen Display / Màn hình bếp</h2>
            <p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)]">AURA CAFE • Revenue Center: BAR</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              {(Object.keys(STATUS_CONFIG) as TicketStatus[]).map(s => (
                <span key={s} className="px-2.5 py-1 rounded-full font-label-caps text-[10px] uppercase" style={{ backgroundColor: `${STATUS_CONFIG[s].color}20`, color: STATUS_CONFIG[s].color }}>
                  {s} ({s === 'PREPARING' ? counts.PREPARING : s === 'PENDING' ? counts.PENDING : s === 'READY' ? counts.READY : TICKETS.filter(t => t.status === 'OVERDUE').length})
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* Filter Tabs */}
        <div className="px-6 py-3 border-b border-white/5 flex gap-2">
          {(['ALL', 'PRIORITY', 'PREPARING', 'READY'] as FilterStatus[]).map(f => (
            <button key={f} onClick={() => setActiveFilter(f)} className={`px-4 py-2 rounded-lg font-label-caps text-label-caps text-xs transition-all active:scale-95 ${activeFilter === f ? 'bg-[var(--aura-tertiary)]/15 text-[var(--aura-tertiary)] border border-[var(--aura-tertiary)]/30' : 'text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)]'}`}>
              {f}
            </button>
          ))}
        </div>

        {/* Tickets */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
          {filteredTickets.map(ticket => {
            const cfg = STATUS_CONFIG[ticket.status];
            const elapsed = timers[ticket.id];
            return (
              <div key={ticket.id} className={`glass-panel rounded-xl flex flex-col min-h-[380px] relative overflow-hidden transition-all ${ticket.status === 'OVERDUE' ? 'ring-1 ring-red-500/50' : ''}`}>
                <div className="h-1.5 w-full" style={{ backgroundColor: cfg.color }} />
                <div className="p-5 flex-grow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="font-display text-headline-lg" style={{ fontFamily: 'var(--font-display, serif)', color: cfg.color }}>#{ticket.id}</h2>
                      <p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase">Table {ticket.table} • {ticket.service}</p>
                    </div>
                    <div className="text-right">
                      <span className={`font-mono text-2xl ${ticket.status === 'OVERDUE' ? 'text-red-400 animate-pulse' : ''}`} style={{ color: ticket.status !== 'OVERDUE' ? cfg.color : undefined }}>{elapsed}</span>
                      <p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] mt-0.5">{ticket.isPriority ? '⏰ OVERDUE' : 'ELAPSED'}</p>
                    </div>
                  </div>
                  {ticket.isPriority && <span className="inline-block px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-label-caps text-[9px] uppercase tracking-wider mb-3 border border-red-500/30">PRIORITY COMPLETE</span>}
                  <div className="space-y-3 mt-4">
                    {ticket.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="font-bold text-headline-md text-[var(--aura-chrome-bright)] min-w-[32px]">{item.qty}</span>
                        <div className="flex-1">
                          <p className="font-body text-sm text-[var(--aura-chrome-bright)]">{item.name}</p>
                          {item.mod && <span className="inline-block mt-1 px-2 py-0.5 text-[9px] border rounded font-bold uppercase" style={{ borderColor: `${cfg.color}40`, color: cfg.color }}>{item.mod}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-4 border-t border-white/5">
                  <button className={`w-full py-3 rounded-lg font-label-caps text-[10px] uppercase tracking-widest transition-all active:scale-[0.98] ${cfg.btn} ${ticket.status === 'READY' ? 'opacity-50' : ''}`} style={ticket.status === 'PREPARING' ? { boxShadow: '0 2px 8px rgba(0,0,0,0.2)', transformStyle: 'preserve-3d' } : undefined}>
                    {ticket.status === 'PENDING' ? 'START PREP' : ticket.status === 'PREPARING' ? 'COMPLETE TICKET' : ticket.status === 'READY' ? 'ORDER PICKED UP' : 'PRIORITY COMPLETE'}
                  </button>
                </div>
                {ticket.status === 'READY' && <div className="absolute inset-0 bg-[var(--aura-tertiary)]/5 pointer-events-none" />}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}