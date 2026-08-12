import { useState, useEffect } from 'react';
import { StitchShell } from '../StitchBase';

interface OrderItem {
  icon: string;
  name: string;
  nameEn: string;
  time: string;
  status: string;
  statusVariant: 'default' | 'delivered';
}

const ORDERS: readonly OrderItem[] = [
  { icon: '☕', name: 'Cà phê Truffle', nameEn: 'Truffle Cortado', time: 'Today 08:45AM', status: 'Preparing', statusVariant: 'default' },
  { icon: '🥐', name: 'Croissant Lá Vàng', nameEn: 'Gold Leaf Croissant', time: 'Yesterday 09:12AM', status: 'Delivered', statusVariant: 'delivered' },
  { icon: '🧊', name: 'Cà phê Đen Đói', nameEn: 'Iced Obsidian Brew', time: 'Oct 24 02:30PM', status: 'Delivered', statusVariant: 'delivered' },
] as const;

interface BottomNavItem { icon: string; label: string; labelEn: string; href?: string; active?: boolean }
const BOTTOM_NAV: readonly BottomNavItem[] = [
 { icon: '☕', label: 'Reserve', labelEn: 'Reserve', href: '/stitch/reservation' },
 { icon: '✣', label: 'Đơn hàng', labelEn: 'Orders', href: '/stitch/admin-orders' },
 { icon: '⭐', label: 'Điêm thưßng', labelEn: 'Loyalty', href: '/stitch/loyalty' },
 { icon: '👤', label: 'Tài khoãn', labelEn: 'Account', active: true },
 { icon: '⋅', label: 'Thêm', labelEn: 'More', href: '#' },
];

export default function StitchCustomerAccount() {
  const [scrolled, setScrolled] = useState(0);

  useEffect(() => {
    const handler = () => setScrolled(window.pageYOffset);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <StitchShell>
      {/* ── Fixed Header ─────────────────────────────────────────── */}\n      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 h-16 bg-[#040B14]/80 backdrop-blur-2xl border-b border-white/10">
        <button
          aria-label="Open menu"
          className="flex flex-col gap-[5px] p-1 text-[var(--aura-chrome-bright)] hover:opacity-80 active:scale-95 transition-all"
        >
          <span className="block h-[2px] w-5 bg-current rounded-full" />
          <span className="block h-[2px] w-5 bg-current rounded-full" />
          <span className="block h-[2px] w-5 bg-current rounded-full" />
        </button>

        <h1 className="font-display text-base tracking-[0.3em] text-[var(--aura-chrome-mid)] uppercase">
          AURA CAFE
        </h1>

        <div className="w-9 h-9 rounded-full bg-white/10 border border-white/10 overflow-hidden flex items-center justify-center">
          <span className="text-lg">👤</span>
        </div>
      </header>

      {/* ── Main Scrollable Content ──────────────────────────────── */}\n      <main className="pt-24 pb-28 px-5 max-w-lg mx-auto space-y-5">
        {/* ── Profile Card ──────────────────────────────────────── */}\n        <section className="glass-card relative overflow-hidden">
          {/* Top-right atmospheric shader */}
          <div
            className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-40"
            style={{
              background: 'radial-gradient(circle, rgba(205,127,50,0.35) 0%, transparent 70%)',
              filter: 'blur(40px)',
            }}
          />

          <div className="relative z-10 flex items-center gap-5 p-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-full border-2 border-secondary/30 p-[3px]"
                style={{
                  background: 'linear-gradient(135deg, #CD7F32, #A0522D)',
                  padding: '3px',
                }}
              >
                <div className="w-full h-full rounded-full bg-[#0D1825] flex items-center justify-center">
                  <span className="text-4xl">👤</span>
                </div>
              </div>
            </div>

            {/* Name + Badge */}
            <div>
              <h2 className="font-display text-2xl text-[var(--aura-chrome-bright)]">Julian Vene</h2>
              <span
                className="inline-block mt-2 px-3 py-[3px] rounded-full font-body text-[10px] font-bold uppercase tracking-widest"
                style={{
                  background: 'linear-gradient(135deg, #CD7F32, #A0522D)',
                  color: '#040B14',
                }}
              >
                Gold Tier
              </span>
            </div>
          </div>
        </section>

        {/* ── Loyalty Section ─────────────────────────────────────── */}\n        <section className="glass-card p-6"
          style={{ boxShadow: 'inset 0 1px 0 0 rgba(205,127,50,0.3)' }}
        >
          <div className="flex justify-between items-end mb-4">
            <div>
              <span className="block font-body text-[10px] text-[var(--aura-chrome-mid)] tracking-[0.2em] uppercase mb-1">
                Số dư điểm
              </span>
              <p className="font-display text-[2rem] leading-none primary-gradient">
                1,250 <span className="font-body text-sm text-[var(--aura-chrome-mid)] opacity-70">pts</span>
              </p>
            </div>
            <div className="text-right">
              <span className="block font-body text-[10px] text-[var(--aura-chrome-mid)] tracking-[0.2em] uppercase mb-1">
                Hạng tiếp theo
              </span>
              <p className="font-body text-sm text-[var(--aura-chrome-light)]">Platinum</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-[6px] bg-white/10 rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full"
              style={{
                width: '80%',
                background: 'linear-gradient(135deg, #CD7F32, #A0522D)',
              }}
            />
          </div>
          <p className="font-body text-[11px] text-[var(--aura-chrome-dark)] text-right">
            250 pts to go / Còn 250 điểm
          </p>
        </section>

        {/* ── Quick Order CTA ─────────────────────────────────────── */}\n        <button
          type="button"
          className="w-full h-16 rounded-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-transform group"
          style={{
            background: 'linear-gradient(135deg, #CD7F32, #A0522D)',
            boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.3)',
          }}
        >
          <span className="text-2xl group-hover:rotate-12 transition-transform">☕</span>
          <span className="font-body text-xs font-bold text-[#040B14] tracking-[0.2em] uppercase">
            ĐẶT NHANH / QUICK ORDER
          </span>
        </button>

        {/* ── Recent Transactions ─────────────────────────────────── */}\n        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-display text-xl text-[var(--aura-chrome-bright)]">
              Giao dịch gần đây
            </h3>
            <button
              type="button"
              className="font-body text-[10px] font-bold uppercase tracking-widest text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
            >
              Tất cả / VIEW ALL
            </button>
          </div>

          <div className="space-y-3">
            {ORDERS.map((order) => (
              <div
                key={order.name}
                className="glass-card flex items-center gap-4 p-4"
                style={{ boxShadow: 'inset 0 1px 0 0 rgba(205,127,50,0.15)' }}
              >
                {/* Icon thumbnail */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: 'var(--aura-surface-container-high)' }}
                >
                  {order.icon}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[15px] font-semibold text-[var(--aura-chrome-bright)] truncate">
                    {order.name}
                  </p>
                  <span className="block label-caps text-[10px] text-[var(--aura-chrome-mid)] mt-[2px]">
                    {order.time}
                  </span>
                </div>

                {/* Status badge */}
                <span
                  className={`font-body text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full flex-shrink-0 ${
                    order.statusVariant === 'delivered'
                      ? 'bg-white/5 text-[var(--aura-chrome-mid)] border border-white/10'
                      : 'bg-[var(--aura-chrome-mid)]/10 text-[var(--aura-chrome-mid)] border border-[var(--aura-chrome-mid)]/20'
                  }`}
                >
                  {order.status}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Membership Card ──────────────────────────────────────── */}\n        <div
          className="relative overflow-hidden rounded-2xl"
          style={{ aspectRatio: '1.6 / 1' }}
        >
          {/* Metallic base */}
          <div className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, #2A1F14 0%, #0D1825 40%, #1A2540 70%, #2A1F14 100%)',
            }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0"
            style={{
              background: 'linear-gradient(160deg, rgba(205,127,50,0.25) 0%, transparent 50%, rgba(205,127,50,0.15) 100%)',
            }}
          />
          {/* Rim-light */}
          <div className="absolute inset-0"
            style={{ boxShadow: 'inset 0 1px 0 0 rgba(205,127,50,0.3)' }}
          />

          <div className="relative z-10 flex flex-col items-center justify-center h-full gap-2">
            <span className="font-display text-4xl italic tracking-[0.2em] chrome-text">AURA</span>
            <span className="font-body text-[10px] tracking-[0.3em] text-[var(--aura-chrome-mid)] uppercase">
              Member Since 2022
            </span>
          </div>
        </div>
      </main>

      {/* ── Fixed Bottom Navigation ────────────────────────────────── */}\n      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-20 bg-[#040B14]/90 backdrop-blur-2xl border-t border-white/10"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {BOTTOM_NAV.map((item) => (
          <a
            key={item.label}
            href={item.href ?? '#'}
            aria-current={item.active ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-[3px] px-3 py-2 transition-all min-w-[64px] ${
              item.active
                ? 'text-[var(--aura-tertiary)]'
                : 'text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)]'
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span className="font-body text-[10px] font-semibold uppercase tracking-wider leading-tight">
              {item.label}
            </span>
          </a>
        ))}
      </nav>
    </StitchShell>
  );
}
