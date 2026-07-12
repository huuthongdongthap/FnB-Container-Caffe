import { useState } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

interface OrderItem {
  icon: string;
  name: string;
  qty: number;
  price: string;
}

const ORDER_ITEMS: readonly OrderItem[] = [
  { icon: '☕', name: 'Midnight Espresso', qty: 1, price: '$6.50' },
  { icon: '\u{1F35E}', name: 'Silver Leaf Pastry', qty: 1, price: '$8.00' },
] as const;

export default function TrackOrderNew() {
  const [mounted, setMounted] = useState(false);

  const handleMount = () => {
    setMounted(true);
  };

  return (
    <StitchShell>
      <style>{`
        .tracking-timeline::before {
          content: '';
          position: absolute;
          left: 21px;
          top: 0;
          bottom: 0;
          width: 1px;
          background: rgba(198, 198, 199, 0.1);
        }
        .diamond-step {
          transform: rotate(45deg);
        }
        @keyframes pulse-bronze {
          0% { transform: scale(1) rotate(45deg); opacity: 1; }
          50% { transform: scale(1.2) rotate(45deg); opacity: 0.7; }
          100% { transform: scale(1) rotate(45deg); opacity: 1; }
        }
        .animate-pulse-bronze {
          animation: pulse-bronze 2s infinite ease-in-out;
        }
      `}</style>

      {/* TopAppBar */}
<PageHeader brand="AURA CAFE" scrollEffect />

      <main className="max-w-[1200px] mx-auto px-5 pt-8 space-y-8 mb-24">
        {/* Hero Card */}
        <section className="glass-panel rounded-xl p-8 relative overflow-hidden">
          <div className="relative z-10 space-y-2">
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Order Reference</p>
            <h2 className="font-headline-md text-headline-md text-[var(--aura-tertiary)]">#AC-8842</h2>
            <div className="pt-6 flex items-baseline gap-2">
              <span className="font-headline-lg-mobile text-headline-lg-mobile text-[var(--aura-tertiary)] font-bold">8</span>
              <span className="font-headline-sm-mobile text-headline-sm-mobile text-[var(--aura-tertiary)]">MINS</span>
            </div>
            <p className="font-body-md text-secondary">Estimated Arrival Time</p>
          </div>
        </section>

        {/* Timeline */}
        <section className="py-4 relative tracking-timeline">
          <div className="space-y-12">
            {[
              { label: 'Confirmed', time: '10:42 AM', pulse: false, status: 'active' as const },
              { label: 'Preparing', time: 'IN PROGRESS', pulse: true, status: 'active' as const },
              { label: 'Out for Delivery', time: '', pulse: false, status: 'inactive' as const },
              { label: 'Delivered', time: '', pulse: false, status: 'inactive' as const },
            ].map((step) => (
              <div key={step.label} className="flex items-center gap-6 relative">
                <div className="z-10 w-11 h-11 flex items-center justify-center bg-[var(--aura-noir-deep)]">
                  <div
                    className={`w-3 h-3 bg-[var(--aura-tertiary)] diamond-step ${step.pulse ? 'animate-pulse-bronze' : ''}`}
                    style={step.status === 'inactive' ? { background: '#2E3A4C', opacity: 0.4 } : {}}
                  />
                </div>
                <div>
                  <h3
                    className={`font-label-md text-label-md uppercase tracking-widest ${
                      step.status === 'active' ? 'text-[var(--aura-tertiary)]' : 'text-secondary opacity-40'
                    }`}
                  >
                    {step.label}
                  </h3>
                  {step.time && (
                    <p className="text-[10px] text-on-surface-variant mt-1">{step.time}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Order Summary */}
        <section className="glass-panel rounded-xl p-6 border-secondary/10">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">Order Summary</h4>
            <span className="material-symbols-outlined text-on-surface-variant text-sm">receipt_long</span>
          </div>
          <ul className="space-y-4">
            {ORDER_ITEMS.map(item => (
              <li key={item.name} className="flex justify-between items-center py-3 border-b border-secondary/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[var(--aura-surface-container-high)] border border-secondary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[var(--aura-tertiary)]">{item.icon}</span>
                  </div>
                  <div>
                    <p className="font-body-md text-on-surface">{item.name}</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">Qty: {item.qty}</p>
                  </div>
                </div>
                <span className="font-label-md text-label-md text-secondary">{item.price}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-between items-center">
            <span className="font-label-md text-label-md text-on-surface-variant">TOTAL</span>
            <span className="font-headline-sm-mobile text-headline-sm-mobile text-[var(--aura-tertiary)]">$14.50</span>
          </div>
        </section>

        {/* Track on Map */}
        <div className="pt-4">
          <button
            type="button"
            className="w-full h-16 bg-[var(--aura-tertiary)] text-on-primary-container font-label-md text-label-md uppercase tracking-[0.2em] rounded-xl bronze-glow flex items-center justify-center gap-3 transition-transform active:scale-95 duration-150"
          >
            <span className="material-symbols-outlined" style={{ fontWeight: 700 }}>map</span>
            TRACK ON MAP
          </button>
        </div>
      </main>

      {/* Map filler */}
      <div className="mt-12 mb-20 px-5 opacity-60">
        <div className="w-full h-32 rounded-xl overflow-hidden glass-panel relative grayscale contrast-125">
          <div
            className="absolute inset-0 bg-cover bg-center"
            role="img"
            aria-label="A minimalist, high-contrast dark mode map of an urban city center with glowing bronze paths and industrial blue-toned streets in a premium cafe brand identity."
            style={{
              backgroundImage:
                "url('https://lh3.googleusercontent.com/aida-public/AB6AXuA90WxYaHlUtsvBh5534XaBjg3-fyQzGcu9QrG8G_nEQu4rgCaHQbZzovFYquvVmqJ_sOldR6kY6wTGueiGtBVeKCTFkLR0fA-CcWscaVkcZ26ZYtbSXO76dQQWSpoLYCaBK-zl_h4QrJ0zHmHn0xUz131HlKl8mLPvzFCqI7ADhgbPX4bx1RlFukblIah1zs6ntPM1SOcoMvHdnxxj5T1DSAULw3dUQbMCDPP3dI-09iV0EDvwWAj0ga_AWpjCaxj2DO_NAcMyMjo')",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" aria-hidden="true" />
        </div>
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full z-50 backdrop-blur-xl bg-[var(--aura-surface-container-low)]/80 border-t border-outline-variant/10 px-5 py-2 pb-safe">
        <div className="flex justify-around items-center w-full">
          <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant hover:text-[var(--aura-tertiary)] transition-colors active:scale-95 transition-transform duration-150">
            <span className="material-symbols-outlined">restaurant_menu</span>
            <span className="font-label-sm text-label-sm mt-1">Menu</span>
          </a>
          <a href="#" className="flex flex-col items-center justify-center text-[var(--aura-tertiary)] bg-[var(--aura-tertiary)]/10 rounded-xl px-4 py-1 active:scale-95 transition-transform duration-150">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
            <span className="font-label-sm text-label-sm mt-1">Orders</span>
          </a>
          <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant hover:text-[var(--aura-tertiary)] transition-colors active:scale-95 transition-transform duration-150">
            <span className="material-symbols-outlined">person</span>
            <span className="font-label-sm text-label-sm mt-1">Profile</span>
          </a>
        </div>
      </nav>
    </StitchShell>
  );
}
