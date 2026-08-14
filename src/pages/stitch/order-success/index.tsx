import { useState } from 'react';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

interface OrderItem {
  qty: number;
  name: string;
  price: string;
}

interface Step {
  label: string;
  done: boolean;
  active: boolean;
}

const ORDER_ITEMS: readonly OrderItem[] = [
  { qty: 1, name: 'Midnight Espresso', price: '$6.50' },
  { qty: 1, name: 'Chrome Velvet Latte', price: '$7.93' },
] as const;

const STEPS: readonly Step[] = [
  { label: 'RECEIVED', done: true, active: false },
  { label: 'PREPARING', done: false, active: true },
  { label: 'READY', done: false, active: false },
] as const;

export default function OrderSuccessConfirmation() {
  const [currentStep] = useState(1);
  const completedSteps = currentStep;

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Inline styles */}
      <style>{`
        @keyframes shine {
          0% { transform: translateX(-100%) translateY(-100%); }
          100% { transform: translateX(100%) translateY(100%); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.15); }
        }
        @keyframes ring-spin {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .ring-outer {
          animation: ring-spin 20s linear infinite;
        }
        .ring-inner {
          animation: ring-spin 15s linear infinite reverse;
        }
        .pulse-dot {
          animation: pulse-dot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>

      {/* Static gradient background — replaces WebGL shader */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-[#09141e] via-[#0a2035] to-[#09141e]" />

      {/* Header */}
<PageHeader brand="AURA CAFE" scrollEffect />

      {/* Main content */}
      <main className="w-full max-w-md mx-auto px-5 pt-24 pb-8 flex flex-col gap-6 items-center">
        {/* Hero section with CSS ring decoration — replaces THREE.js */}
        <div className="w-full relative aspect-square flex flex-col items-center justify-center overflow-hidden rounded-[40px]">
          {/* CSS-only ring decoration */}
          <div className="absolute top-1/2 left-1/2 -z-10">
            <div
              className="ring-outer absolute top-0 left-0 border border-[var(--aura-tertiary)]/60 rounded-full"
              style={{ width: 260, height: 260 }}
            />
            <div
              className="ring-inner absolute border border-white/20 rounded-full"
              style={{ width: 240, height: 240, top: 10, left: 10 }}
            />
            <div
              className="ring-outer absolute border border-[var(--aura-tertiary)]/30 rounded-full"
              style={{ width: 340, height: 340, top: -40, left: -40 }}
            />
            <div
              className="ring-inner absolute border border-white/10 rounded-full"
              style={{ width: 320, height: 320, top: -30, left: -30 }}
            />
          </div>

          {/* Wait time content */}
          <div className="relative z-10 text-center flex flex-col gap-2">
            <span className="font-body text-xs font-bold tracking-[0.2em] text-[var(--aura-tertiary)] uppercase">
              ESTIMATED WAIT
            </span>
            <div className="font-display text-[clamp(56px,15vw,84px)] leading-none text-[var(--aura-chrome-bright)] flex items-baseline justify-center">
              12
              <span className="text-xl md:text-2xl ml-2 font-body uppercase tracking-widest text-[var(--aura-tertiary)] font-semibold">
                min
              </span>
            </div>
            <div className="mt-3 px-4 py-1.5 rounded-full border border-[var(--aura-tertiary)]/30 bg-[var(--aura-tertiary)]/10 inline-flex items-center gap-2 self-center">
              <div className="w-2 h-2 rounded-full bg-[var(--aura-tertiary)] pulse-dot" />
              <span className="font-body text-[10px] text-[var(--aura-tertiary)] font-semibold tracking-wider uppercase">
                Preparing Your Brew
              </span>
            </div>
          </div>
        </div>

        {/* Order details card */}
        <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-5 flex flex-col gap-5">
          {/* Order header */}
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <span className="font-body text-xs font-bold tracking-wider text-[var(--aura-chrome-mid)]">
              ORDER #AURA-9842
            </span>
            <span className="font-display text-2xl text-[var(--aura-tertiary)]">$14.43</span>
          </div>

          {/* Order items */}
          <div className="flex flex-col gap-4">
            {ORDER_ITEMS.map((item, i) => (
              <div key={`${item.name}-${i}`} className="flex justify-between items-center">
                <div className="flex gap-3 items-center">
                  <span className="text-[var(--aura-tertiary)] font-bold text-sm">{item.qty}x</span>
                  <span className="font-body text-sm text-[var(--aura-chrome-bright)]">{item.name}</span>
                </div>
                <span className="font-display text-sm text-[var(--aura-chrome-mid)] italic">{item.price}</span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-white/5" />

          {/* Step tracker */}
          <div className="flex flex-col gap-4">
            {/* Progress track */}
            <div className="relative w-full h-[2px] bg-white/10">
              {/* Filled portion */}
              <div
                className="absolute h-full bg-[var(--aura-tertiary)] transition-all duration-500"
                style={{
                  width: `${(completedSteps / (STEPS.length - 1)) * 100}%`,
                }}
              />
              {/* Step indicators */}
              <div className="absolute top-1/2 left-0 -translate-y-1/2 flex justify-between w-full">
                {STEPS.map((step, i) => {
                  const isActive = step.active || i < completedSteps;
                  return (
                    <div
                      key={step.label}
                      className={`w-4 h-4 rounded-full flex items-center justify-center border-2 ${
                        i <= completedSteps
                          ? 'bg-[var(--aura-tertiary)] border-white/20 ring-4 ring-[var(--aura-noir-deep)]'
                          : 'bg-[var(--aura-noir-deep)] border-white/10 ring-4 ring-[var(--aura-noir-deep)]'
                      }`}
                    >
                      {i <= completedSteps && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--aura-noir-deep)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step labels */}
            <div className="flex justify-between w-full px-1">
              {STEPS.map((step) => (
                <span
                  key={step.label}
                  className={`font-body text-[10px] tracking-wider uppercase ${
                    step.active || STEPS.indexOf(step) < completedSteps
                      ? 'text-[var(--aura-tertiary)] font-semibold'
                      : 'text-[var(--aura-chrome-mid)]'
                  }`}
                >
                  {step.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Track Order button with chrome shine */}
        <button
          type="button"
          className="w-full py-4 relative overflow-hidden bg-gradient-to-r from-[#e0e0e0] to-[#a1a1aa] text-[var(--aura-noir-deep)] font-body text-xs font-bold tracking-[0.2em] uppercase rounded-2xl shadow-[0_10px_30px_rgba(196,146,113,0.15)] active:scale-[0.98] transition-transform duration-200"
        >
          <span className="absolute inset-0 overflow-hidden">
            <span
              className="absolute inset-0 bg-gradient-to-br from-transparent via-white/40 to-transparent"
              style={{
                animation: 'shine 4s infinite',
                transform: 'translateX(-100%) translateY(-100%)',
              }}
            />
          </span>
          <span className="relative z-10">Track Order</span>
        </button>

        {/* Location card */}
        <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] overflow-hidden h-40 relative group cursor-pointer transition-all duration-500 hover:border-[var(--aura-tertiary)]/40">
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-110"
            style={{
              backgroundImage:
                "url('https://lh3.googleusercontent.com/aida-public/AB6AXuB90p-HQ3qdJbW1M_x492UqW3HLs03n6XsrLpvu0QVEMyWAfjJXfgdukv-IePi8OLn_Qk9sRXhCB6TWZxQjiHd7x9Q-zKzEv3d2WN-rAGGQG1RdY0ZqNz8O3uN0qzYCM0SzE8jsiY0fnJpqyKmnBwU-X8AabgCNah__hRLDyWmhZiERlXaxI9lHVuvx09XcBxXH5agT7CFRnKpMCN0BX-7MEbyZ5crFzbW59kesuIm7l2ve_cVVnwUvWu9O6OVeVE7SMuo6ycupg')",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-noir-void)] to-transparent opacity-80" />
          <div className="absolute bottom-4 left-4 flex flex-col gap-1">
            <span className="font-body text-[10px] text-[var(--aura-tertiary)] font-semibold tracking-wider uppercase">
              Location
            </span>
            <span className="font-body text-lg text-[var(--aura-chrome-bright)] font-medium">
              District 7 Station
            </span>
          </div>
          <div className="absolute top-4 right-4 bg-[var(--aura-noir-void)]/60 backdrop-blur-md p-2 rounded-full border border-white/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--aura-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </div>
        </div>
      </main>

      {/* Footer */}
<PageFooter
  brand="&copy; 2024 AURA CAFE. ALL RIGHTS RESERVED."
  socialLinks={["IG", "FB", "TT"].map(s => ({ label: s }))}
  socialSize="sm"
  />
    </div>
  );
}
