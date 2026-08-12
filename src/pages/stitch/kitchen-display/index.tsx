import { useState, useEffect } from 'react';
import { StitchShell } from '../StitchBase';

/* ── Data Types ─────────────────────────────────────────────────── */

type TicketStatus = 'preparing' | 'pending' | 'ready' | 'cancelled';

interface TicketItem {
  qty: string;
  name: string;
  modifier?: string;
  isCompleted?: boolean;
}

interface Ticket {
  id: string;
  status: TicketStatus;
  table: string;
  serviceType: string;
  timerText: string;
  timerLabel: string;
  isOverdue?: boolean;
  items: TicketItem[];
  actionLabel: string;
  actionDisabled?: boolean;
}

interface NavItem {
  label: string;
  icon: string;
  active?: boolean;
}

/* ── Constants ──────────────────────────────────────────────────── */

const STATUS_TABS = ['ALL', 'PRIORITY', 'PREPARING', 'READY'] as const;

const NAV_ITEMS = [
  { label: 'DASHBOARD', icon: '📊', active: true },
  { label: 'HISTORY', icon: '📋', active: false },
  { label: 'INVENTORY', icon: '📦', active: false },
  { label: 'STAFF', icon: '👥', active: false },
] as const;

const TICKETS: Ticket[] = [
  {
    id: '9842',
    status: 'preparing',
    table: 'TABLE B01',
    serviceType: 'DINE IN',
    timerText: '08:45',
    timerLabel: 'ELAPSED',
    items: [
      { qty: '2x', name: 'Midnight Espresso', modifier: 'Modifier: Oat Milk' },
      { qty: '1x', name: 'Smoked Truffle Croissant' },
    ],
    actionLabel: 'COMPLETE TICKET',
  },
  {
    id: '9843',
    status: 'pending',
    table: 'TABLE B05',
    serviceType: 'TOGO',
    timerText: '02:10',
    timerLabel: 'ELAPSED',
    items: [
      { qty: '1x', name: 'Nitro Tonic' },
      { qty: '1x', name: 'Ceremonial Matcha', modifier: 'EXTRA OAT MILK' },
    ],
    actionLabel: 'START PREP',
  },
  {
    id: '9841',
    status: 'ready',
    table: 'TABLE B12',
    serviceType: 'DINE IN',
    timerText: '12:30',
    timerLabel: 'TOTAL TIME',
    isOverdue: false,
    items: [
      { qty: '3x', name: 'Chrome Velvet Latte', isCompleted: true },
      { qty: '2x', name: 'Bronze Chai', isCompleted: true },
    ],
    actionLabel: 'ORDER PICKED UP',
    actionDisabled: true,
  },
  {
    id: '9844',
    status: 'pending',
    table: 'TABLE B02',
    serviceType: 'TOGO',
    timerText: '00:45',
    timerLabel: 'ELAPSED',
    items: [{ qty: '1x', name: 'Industrial Cold Brew' }],
    actionLabel: 'START PREP',
  },
  {
    id: '9838',
    status: 'preparing',
    table: 'TABLE B09',
    serviceType: 'DELIVERY',
    timerText: '18:12',
    timerLabel: 'OVERDUE',
    isOverdue: true,
    items: [{ qty: '4x', name: 'Double Smoked Cortado' }],
    actionLabel: 'PRIORITY COMPLETE',
  },
];

/* ── Style helpers (matching brand tokens) ──────────────────────── */

const fontDisplayLg = {
  fontFamily: "var(--aura-font-display)",
  fontSize: 'var(--aura-fs-h1)',
  lineHeight: 'var(--aura-lh-tight)',
  fontWeight: '700',
  letterSpacing: '-0.02em',
};

const headlineMd = {
  fontFamily: "var(--aura-font-display)",
  fontSize: 'var(--aura-fs-h2)',
  lineHeight: '1.2',
  fontWeight: '700',
};

const timerDisplay = {
  fontFamily: "var(--aura-font-mono, 'Space Grotesk', sans-serif)",
  fontSize: '40px',
  lineHeight: '1',
  letterSpacing: '-0.05em',
  fontWeight: '700',
};

const labelCaps = {
  fontFamily: "var(--aura-font-body)",
  fontSize: 'var(--aura-fs-label-caps)',
  lineHeight: '1',
  letterSpacing: '0.1em',
  fontWeight: '700',
};

const bodyLg = {
  fontFamily: "var(--aura-font-body)",
  fontSize: 'var(--aura-fs-body-lg)',
  lineHeight: 'var(--aura-lh-body)',
  fontWeight: '500',
};

const bodyMd = {
  fontFamily: "var(--aura-font-body)",
  fontSize: 'var(--aura-fs-body)',
  lineHeight: 'var(--aura-lh-body)',
  fontWeight: '400',
};

const glassCard = {
  background: 'rgba(10, 26, 46, 0.6)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px) as any',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)',
};

const btnChrome = {
  background: 'linear-gradient(135deg, #E2E8F0 0%, #94A3B8 50%, #475569 100%)',
  color: '#2c1700',
  boxShadow: '0 4px 0 rgba(0,0,0,0.3)',
  transition: 'all 0.1s ease',
};

/* ── Pulse animation ─────────────────────────────────────────────── */

const pulseGlowKeyframes = `
@keyframes kds-pulse-glow {
  0%, 100% { text-shadow: 0 0 10px rgba(255, 180, 171, 0.2); opacity: 1; }
  50% { text-shadow: 0 0 25px rgba(255, 180, 171, 0.8); opacity: 0.8; }
}
`;

/* ── Component ──────────────────────────────────────────────────── */

export default function KitchenDisplaySystem() {
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [timers, setTimers] = useState<Record<string, string>>(
    () => Object.fromEntries(TICKETS.map((t) => [t.id, t.timerText]))
  );
  const [pressedButton, setPressedButton] = useState<string | null>(null);

  // Tick timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) => {
        const next: Record<string, string> = { ...prev };
        for (const ticket of TICKETS) {
          if (ticket.actionDisabled) continue; // static "picked up" time
          const timeStr = prev[ticket.id] ?? '00:00'; const parts = timeStr.split(':'); const min = parseInt(parts[0] ?? '0', 10); const sec = parseInt(parts[1] ?? '0', 10);
          const newSec = (sec + 1) % 60;
          const newMin = min + (sec + 1 >= 60 ? 1 : 0);
          next[ticket.id] = `${String(newMin).padStart(2, '0')}:${String(newSec).padStart(2, '0')}`;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleButtonDown = (id: string) => setPressedButton(id);
  const handleButtonUp = (id: string) => setPressedButton(null);
  const handleButtonLeave = () => setPressedButton(null);

  // CSS for custom elements not covered by Tailwind utilities
  const customCSS = `
    ${pulseGlowKeyframes}
    .kds-glass-card { ${Object.entries(glassCard).map(([k, v]) => `${k}:${v};`).join(' ')} }
    .kds-btn-chrome { ${Object.entries(btnChrome).map(([k, v]) => `${k}:${v};`).join(' ')} }
    .kds-btn-chrome:active {
      transform: translateY(2px);
      box-shadow: 0 1px 0 rgba(0,0,0,0.5), inset 0 2px 4px rgba(0,0,0,0.2);
    }
    .kds-btn-chrome[data-pressed="true"] {
      transform: scale(0.98) translateY(2px);
      box-shadow: 0 1px 0 rgba(0,0,0,0.5), inset 0 2px 4px rgba(0,0,0,0.2);
    }
    .kds-timer-pulse { animation: kds-pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    .kds-item-completed { text-decoration: line-through; opacity: 0.5; }
    .kds-ticket-ready { opacity: 0.8; }
    .kds-ticket-ready::after {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(173, 200, 245, 0.05);
      pointer-events: none;
    }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #44474d; border-radius: 10px; }
  `;

  return (
    <StitchShell>
      <style>{customCSS}</style>

      {/* ── Top App Bar ──────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 py-4"
        style={{
          background: 'rgba(5, 20, 36, 0.6)',
          backdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(68, 71, 77, 0.2)',
        }}
      >
        <div className="flex items-center gap-6">
          <h1 style={{ ...fontDisplayLg, color: 'var(--aura-chrome-bright)' }}>
            HEARTH &amp; STEEL KDS
          </h1>
          <div style={{ width: '1px', height: '32px', background: 'rgba(68,71,77,0.3)' }} />
          <div className="flex flex-col">
            <span style={{ ...labelCaps, color: 'var(--aura-chrome-mid)', opacity: 0.6 }}>
              STATION
            </span>
            <span style={{ ...headlineMd, color: 'var(--aura-chrome-light)' }}>
              TERMINAL 01
            </span>
          </div>
        </div>

        {/* Filter tabs */}
        <nav className="hidden md:flex items-center gap-8">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                ...labelCaps,
                fontSize: '12px',
                color: tab === 'ALL' ? 'var(--aura-chrome-light)' : 'var(--aura-chrome-mid)',
                fontWeight: tab === 'ALL' ? '700' : '500',
                borderBottom: tab === 'ALL' ? '2px solid var(--aura-chrome-light)' : '2px solid transparent',
                paddingBottom: '4px',
                transition: 'all 0.2s ease',
                opacity: tab === 'ALL' ? 1 : 0.7,
              }}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span style={{ ...labelCaps, fontSize: 11, color: 'var(--aura-chrome-light)' }}>
              AVG PREP: 12M
            </span>
            <span style={{ ...bodyMd, color: 'var(--aura-chrome-mid)' }}>
              ACTIVE ORDERS: {TICKETS.filter((t) => !t.actionDisabled).length}
            </span>
          </div>
          <div className="flex gap-3">
            <span
              className="p-2 rounded-lg transition-colors cursor-pointer"
              style={{ color: 'var(--aura-chrome-light)', opacity: 0.7 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              🔔
            </span>
            <span
              className="p-2 rounded-lg transition-colors cursor-pointer"
              style={{ color: 'var(--aura-chrome-light)', opacity: 0.7 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              ⚙️
            </span>
          </div>
        </div>
      </header>

      {/* ── Side Nav ────────────────────────────────────────── */}
      <aside
        className="fixed left-0 top-0 h-full z-40 flex flex-col pt-24 pb-8 px-4"
        style={{
          width: '256px',
          background: 'rgba(1, 15, 31, 0.8)',
          backdropFilter: 'blur(32px)',
          borderRight: '1px solid rgba(68, 71, 77, 0.1)',
        }}
      >
        <div className="flex items-center gap-4 px-4 mb-10">
          <div
            className="rounded-full overflow-hidden border"
            style={{
              width: '48px',
              height: '48px',
              background: 'var(--aura-noir-mid)',
              borderColor: 'rgba(68,71,77,0.3)',
            }}
          >
            <span className="flex items-center justify-center w-full h-full text-2xl">
              👨‍🍳
            </span>
          </div>
          <div className="flex flex-col">
            <span style={{ ...labelCaps, color: 'var(--aura-chrome-light)', opacity: 0.6 }}>
              STATION 01
            </span>
            <span style={{ ...headlineMd, fontSize: 16, color: 'var(--aura-chrome-bright)' }}>
              GRILL &amp; SAUTÉ
            </span>
          </div>
        </div>

        <nav className="flex flex-col gap-2 flex-grow">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href="#"
              className="flex items-center gap-4 px-4 py-3 transition-all"
              style={{
                color: item.active ? 'var(--aura-chrome-light)' : 'var(--aura-chrome-mid)',
                borderRight: item.active ? '2px solid var(--aura-chrome-light)' : '2px solid transparent',
                background: item.active ? 'rgba(39, 54, 71, 0.2)' : 'transparent',
                opacity: item.active ? 1 : 0.6,
              }}
              onMouseEnter={(e) => {
                if (!item.active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={(e) => {
                if (!item.active) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span style={labelCaps}>{item.label}</span>
            </a>
          ))}
        </nav>

        {/* Station load */}
        <div className="px-4 mt-auto">
          <div
            className="p-4 rounded-lg"
            style={{
              background: 'var(--aura-noir-deep)',
              border: '1px solid rgba(68,71,77,0.2)',
            }}
          >
            <span
              style={{ ...labelCaps, fontSize: 11, color: 'var(--aura-chrome-light)', opacity: 0.6 }}
              className="block mb-2"
            >
              STATION LOAD
            </span>
            <div
              className="rounded-full overflow-hidden"
              style={{ height: '8px', background: 'var(--aura-noir-mid)' }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: '75%', background: 'var(--aura-chrome-light)' }}
              />
            </div>
            <span
              style={{ ...labelCaps, fontSize: 11, color: 'var(--aura-chrome-mid)', marginTop: '8px' }}
              className="block"
            >
              75% CAPACITY
            </span>
          </div>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────── */}
      <main
        className="ml-64 pt-24 px-8 pb-8 h-screen overflow-y-auto"
        style={{ background: 'var(--aura-noir-void)' }}
      >
        {/* Status Bar */}
        <div
          className="mb-8 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(68,71,77,0.1)', paddingBottom: '16px' }}
        >
          <div className="flex gap-4">
            <span
              className="px-3 py-1 rounded-full flex items-center gap-2"
              style={{
                ...labelCaps,
                fontSize: 11,
                background: 'rgba(100, 66, 26, 0.4)',
                color: '#dfaf7e',
                border: '1px solid rgba(223, 175, 126, 0.3)',
              }}
            >
              <span
                className="rounded-full animate-pulse"
                style={{ width: '8px', height: '8px', background: '#efbd8a' }}
              />
              PREPARING (4)
            </span>
            <span
              className="px-3 py-1 rounded-full"
              style={{
                ...labelCaps,
                fontSize: 11,
                background: 'rgba(39, 54, 71, 0.4)',
                color: 'var(--aura-chrome-mid)',
              }}
            >
              PENDING (6)
            </span>
            <span
              className="px-3 py-1 rounded-full"
              style={{
                ...labelCaps,
                fontSize: 11,
                background: 'rgba(0, 26, 56, 0.5)',
                color: '#6984ad',
              }}
            >
              READY (2)
            </span>
          </div>
          <span style={{ ...labelCaps, fontSize: 11, color: 'var(--aura-chrome-mid)' }}>
            AURA CAFE • REVENUE CENTER: BAR
          </span>
        </div>

        {/* Tickets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {TICKETS.map((ticket) => {
            const isPreparing = ticket.status === 'preparing';
            const isReady = ticket.status === 'ready';
            const isPending = ticket.status === 'pending';
            const isOverdue = ticket.isOverdue;

            // Status bar color
            let statusBarColor = 'var(--aura-chrome-mid)'; // pending
            if (isPreparing) statusBarColor = 'var(--aura-chrome-light)'; // amber-ish = secondary
            if (isReady) statusBarColor = '#adc8f5'; // tertiary blue
            if (isOverdue) statusBarColor = '#ffb4ab'; // error red

            // Timer color
            let timerColor = 'var(--aura-chrome-bright)';
            if (isPreparing) timerColor = 'var(--aura-chrome-light)';
            if (isReady) timerColor = '#adc8f5';
            if (isOverdue) timerColor = '#ffb4ab';

            // Button style
            let buttonStyle = { ...btnChrome } as React.CSSProperties;
            if (isReady) {
              buttonStyle.opacity = 0.5;
            }
            if (isOverdue) {
              buttonStyle.background = 'linear-gradient(135deg, #E2E8F0 0%, #94A3B8 50%, #475569 100%)';
              buttonStyle.background = '#93000a';
              buttonStyle.color = '#ffdad6';
            }

            return (
              <article
                key={ticket.id}
                className={"kds-glass-card flex flex-col relative overflow-hidden" + (isReady ? " kds-ticket-ready" : "")}                style={{
                  minHeight: '400px',
                  ...(isReady ? { opacity: '0.8' } : {}),
                  ...(isOverdue ? { boxShadow: '0 0 0 1px rgba(255, 180, 171, 0.5)' } : {}),
                }}
              >
                {/* Status bar */}
                <div style={{ height: '4px', width: '100%', background: statusBarColor }} />

                <div className="p-6 flex-grow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2
                        style={{
                          ...headlineMd,
                          color: isOverdue ? '#ffb4ab' : isReady ? '#adc8f5' : isPreparing ? 'var(--aura-chrome-light)' : 'var(--aura-chrome-bright)',
                        }}
                      >
                        #{ticket.id}
                      </h2>
                      <p
                        style={{
                          ...labelCaps,
                          fontSize: 11,
                          color: 'var(--aura-chrome-mid)',
                        }}
                      >
                        {ticket.table} • {ticket.serviceType}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={isOverdue ? 'kds-timer-pulse' : ''}
                        style={{
                          ...timerDisplay,
                          fontSize: '40px',
                          color: timerColor,
                          ...(isOverdue ? { textShadow: '0 0 10px rgba(255, 180, 171, 0.2)' } : {}),
                        }}
                      >
                        {timers[ticket.id]}
                      </span>
                      <p
                        style={{
                          ...labelCaps,
                          fontSize: 11,
                          color: isOverdue ? '#ffb4ab' : 'var(--aura-chrome-mid)',
                          marginTop: '4px',
                        }}
                      >
                        {ticket.timerLabel}
                      </p>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="space-y-4 mt-6">
                    {ticket.items.map((item, idx) => (
                      <div
                        key={`${ticket.id}-${idx}`}
                        className="flex items-start gap-4"
                        style={item.isCompleted ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}
                      >
                        <span
                          style={{
                            ...headlineMd,
                            color: 'var(--aura-chrome-bright)',
                            minWidth: '32px',
                          }}
                        >
                          {item.qty}
                        </span>
                        <div className="flex-grow">
                          <p style={{ ...bodyLg, color: 'var(--aura-chrome-bright)' }}>{item.name}</p>
                          {item.modifier && (
                            <span
                              className="inline-block mt-1"
                              style={{
                                ...labelCaps,
                                fontSize: 10,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                border: `1px solid ${isReady || isPending ? 'rgba(107,159,184,0.3)' : 'rgba(223,175,126,0.3)'}`,
                                background: isReady || isPending ? 'rgba(0,26,56,0.5)' : 'rgba(100,66,26,0.4)',
                                color: isReady || isPending ? '#6984ad' : '#dfaf7e',
                                fontWeight: '700',
                                textTransform: 'uppercase',
                              }}
                            >
                              {item.modifier}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action button */}
                <div
                  className="p-6"
                  style={{ borderTop: '1px solid rgba(68,71,77,0.1)' }}
                >
                  <button
                    disabled={ticket.actionDisabled}
                    data-pressed={pressedButton === ticket.actionLabel}
                    className="kds-btn-chrome w-full py-4 rounded-lg font-black tracking-widest"
                    style={{
                      ...labelCaps,
                      fontSize: 12,
                      background: buttonStyle.background,
                      color: buttonStyle.color,
                      opacity: ticket.actionDisabled ? 0.5 : 1,
                      boxShadow: buttonStyle.boxShadow,
                    }}
                    onMouseDown={() => handleButtonDown(ticket.actionLabel)}
                    onMouseUp={() => handleButtonUp(ticket.actionLabel)}
                    onMouseLeave={handleButtonLeave}
                  >
                    {ticket.actionLabel}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </StitchShell>
  );
}
