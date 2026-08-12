import { useState } from 'react';
import { StitchShell } from '../StitchBase';

export default function OrderFailureNew() {
  const [scrolled, setScrolled] = useState(false);

  const handleScrollEffect = () => {
    setScrolled(window.scrollY > 20);
  };

  return (
    <StitchShell>
      <div className="industrial-bg fixed inset-0 pointer-events-none" aria-hidden="true" />

      {/* TopAppBar */}
      <header
        className={`fixed top-0 w-full z-50 bg-[var(--aura-surface-container)]/60 backdrop-blur-xl border-b border-white/20 flex justify-between items-center px-5 h-16 ${
          scrolled ? 'bg-[var(--aura-noir-deep)]' : ''
        }`}
      >
        <button
          type="button"
          className="active:scale-95 transition-transform text-[var(--aura-tertiary)]"
          aria-label="Back"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-headline-sm text-headline-sm text-[var(--aura-tertiary)] uppercase tracking-widest">
          ORDER FAILED
        </h1>
        <button
          type="button"
          className="active:scale-95 transition-transform text-[var(--aura-tertiary)]"
          aria-label="Account"
        >
          <span className="material-symbols-outlined">account_circle</span>
        </button>
      </header>

      <main className="pt-24 px-5 flex flex-col items-start gap-6" onScroll={handleScrollEffect}>
        {/* Error Hero */}
        <section className="w-full flex flex-col items-start space-y-4">
          <div className="relative inline-block">
            <span className="material-symbols-outlined text-[64px] text-[var(--aura-tertiary)]" style={{ fontWeight: 200 }}>
              error_outline
            </span>
            <div className="absolute -inset-2 bg-[var(--aura-tertiary)]/10 blur-xl rounded-full -z-10" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display-lg-mobile text-display-lg-mobile text-on-surface uppercase">
              Payment Failed
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[280px]">
              The transaction couldn't be processed. Please check your card details or try another method.
            </p>
          </div>
        </section>

        {/* Primary Action */}
        <section className="w-full">
          <button
            type="button"
            className="w-full bg-[var(--aura-tertiary)] text-primary-container font-label-caps text-label-caps py-4 uppercase tracking-widest transition-all hover:brightness-110 active:scale-[0.98] bronze-glow"
          >
            Retry Payment
          </button>
        </section>

        {/* Alternative Methods */}
        <section className="w-full space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-[1px] flex-1 bg-white/10" />
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Other Options</span>
            <div className="h-[1px] flex-1 bg-white/10" />
          </div>

          <div className="space-y-3">
            {/* PayOS */}
            <div className="glass-panel p-4 flex justify-between items-center group active:scale-[0.98] transition-transform">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-secondary">account_balance_wallet</span>
                <div>
                  <p className="font-body-sm text-body-sm text-on-surface font-bold">PayOS</p>
                  <p className="font-label-caps text-[10px] text-on-surface-variant uppercase">Fast &amp; Secure Transfer</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-[var(--aura-tertiary)] transition-colors">
                chevron_right
              </span>
            </div>

            {/* COD */}
            <div className="glass-panel p-4 flex justify-between items-center group active:scale-[0.98] transition-transform">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-secondary">payments</span>
                <div>
                  <p className="font-body-sm text-body-sm text-on-surface font-bold">Cash on Delivery</p>
                  <p className="font-label-caps text-[10px] text-on-surface-variant uppercase">Pay at your doorstep</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-[var(--aura-tertiary)] transition-colors">
                chevron_right
              </span>
            </div>
          </div>
        </section>

        {/* Support */}
        <section className="w-full glass-panel relative p-4 overflow-hidden">
          <div className="glow-tab" />
          <h3 className="font-label-caps text-label-caps text-[var(--aura-tertiary)] uppercase mb-2">Need Help?</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
            Our concierge team is available 24/7 to assist with your order issues.
          </p>
          <div className="flex flex-col gap-2">
            <a href="#" className="flex items-center gap-3 text-on-surface font-body-sm py-2 border-b border-white/10 hover:text-[var(--aura-tertiary)] transition-colors">
              <span className="material-symbols-outlined text-lg">chat_bubble</span>
              Chat with Support
            </a>
            <a href="#" className="flex items-center gap-3 text-on-surface font-body-sm py-2 border-b border-white/10 hover:text-[var(--aura-tertiary)] transition-colors">
              <span className="material-symbols-outlined text-lg">call</span>
              Call Us
            </a>
          </div>
        </section>

        {/* Aesthetic filler */}
        <section className="w-full opacity-50" aria-hidden="true">
          <div className="relative w-full h-32 overflow-hidden glass-panel group">
            <div className="absolute inset-0 grayscale contrast-125 mix-blend-overlay">
              <div
                className="w-full h-full bg-cover bg-center"
                role="img"
                aria-label="Close up of a brushed dark metal surface with industrial rivets and soft amber light reflections"
                style={{
                  backgroundImage:
                    "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCMgjaZCyvu05sO2AteEOFB1vDffkWR_d6JWjo-yc2y7-aS95SQPrQtgD2BoAHS5tZtx5n_AZDmiHJAu2enZmqQHgCt2hsGR5S6snToKaN3Rhu29AXrE6FkZH3a8vspLdZgwp8SDTllaNnSmSfqhJyR1rfCngRiXcdwoHOdc96jivsTa7dEVsH8KzAVxcU6Jy6ilyTwyUKZ1XEIpT2-ANDZQCKH9kywZBqjIetybB0gX0s0WW36Pgl6ApYSbrvvUnRtnmdHuthx5Ds')",
                }}
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-display text-[40px] text-white/5 uppercase tracking-tighter select-none">
                AURA CAFE
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center h-20 px-2 pb-4 bg-[var(--aura-surface-container-low)]/60 backdrop-blur-xl border-t border-white/10">
        <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-white/5 px-4 py-1 transition-all">
          <span className="material-symbols-outlined mb-1">restaurant_menu</span>
          <span className="font-label-caps text-[10px]">Menu</span>
        </a>
        <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-white/5 px-4 py-1 transition-all">
          <span className="material-symbols-outlined mb-1">group_add</span>
          <span className="font-label-caps text-[10px]">Referrals</span>
        </a>
        <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-white/5 px-4 py-1 transition-all">
          <span className="material-symbols-outlined mb-1">military_tech</span>
          <span className="font-label-caps text-[10px]">Rewards</span>
        </a>
        <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant hover:bg-white/5 px-4 py-1 transition-all">
          <span className="material-symbols-outlined mb-1">person</span>
          <span className="font-label-caps text-[10px]">Profile</span>
        </a>
      </nav>

      <style>{`
        .industrial-bg {
          background: radial-gradient(circle at 50% 50%, #0c1a2d 0%, #081425 100%);
        }
        .glow-tab {
          width: 100%;
          height: 2px;
          background-color: #D4A574;
          position: absolute;
          top: 0;
          left: 0;
        }
        .bronze-glow {
          box-shadow: 0 0 15px rgba(212, 165, 116, 0.4);
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
    </StitchShell>
  );
}
