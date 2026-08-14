import { useState, useEffect } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

const PLANS = [
  {
    tier: 'BASIC',
    price: 9,
    period: '/ MONTH',
    features: ['Daily Brew', 'Standard Seating', 'Mobile Ordering'],
    cta: 'SELECT PLAN',
    highlighted: false,
  },
  {
    tier: 'PREMIUM',
    price: 19,
    period: '/ MONTH',
    features: ['All Basic features', 'Specialty Roasts', 'Priority Lounge Access', 'Monthly Cupping'],
    cta: 'SELECT PLAN',
    highlighted: true,
  },
  {
    tier: 'ENTERPRISE',
    price: 49,
    period: '/ MONTH',
    features: ['All Premium features', 'Private Event Hosting', 'Personal Concierge', 'Unlimited Global Access'],
    cta: 'SELECT PLAN',
    highlighted: false,
  },
] as const;

const FOUNDRY_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDPMrpwgePn0UI2cdpLwT9RrZ35cU0vz9ocTBwin3sVHpblXGa-QHk8te_ombgOq1-M2gcWBWnk1wL_anfcBQCwApHj8Z1wc5lFfaMf_iAHapxdviaoGYTqGH7ei7vmngBScMk6jIk2tR0RwA7likFJjOVX09eufGsjK1cAxcmdYP_Q_E0J_qAKlJNU-v_zd3GzY4n8MJe6Mpj8OBO_TM4-Us1dswG01mhQ1oVE-B77-IW1Zz9e_y6_sOQrdKvveYWZw3D27QxsjSU';

export default function SubscriptionsNew() {
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLBodyElement>) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    document.body.style.backgroundImage = `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(212, 165, 116, 0.03) 0%, transparent 50%)`;
    return () => {
      document.body.style.backgroundImage = '';
    };
  }, [mousePos]);

  return (
    <StitchShell>
      {/* TopAppBar */}
<PageHeader brand="AURA CAFE" scrollEffect />

      <main className="pt-24 pb-20 px-5" onMouseMove={handleMouseMove}>
        {/* Hero */}
        <section className="mb-12 text-center">
          <span className="font-label-caps text-label-caps text-[var(--aura-tertiary)] mb-4 block">
            MEMBERSHIP PROGRAMS
          </span>
          <h2 className="font-h1-mobile text-h1-mobile md:font-h1 md:text-h1 mb-6 text-on-surface">
            Precision Craft. <br /> Exclusive Access.
          </h2>
          <p className="text-secondary font-body-lg max-w-xl mx-auto opacity-70">
            Experience the intersection of industrial grit and luxury hospitality with our curated subscription tiers.
          </p>
        </section>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-container-max mx-auto">
          {PLANS.map(plan => (
            <div
              key={plan.tier}
              className={`border p-8 flex flex-col justify-between relative overflow-hidden transition-all duration-300 group ${
                plan.highlighted
                  ? 'border-[var(--aura-tertiary)] bg-[var(--aura-surface-container-high)] transform md:-translate-y-4 shadow-2xl'
                  : 'border-secondary/20 bg-[var(--aura-surface-container)] hover:bg-[var(--aura-surface-container-high)]'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute top-0 right-0 p-4">
                  <span className="bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-label-caps text-[10px] px-3 py-1 tracking-widest">
                    MOST POPULAR
                  </span>
                </div>
              )}
              <div className="mb-12">
                <h3 className={`font-h3 text-h3 mb-2 ${plan.highlighted ? 'text-[var(--aura-tertiary)]' : 'text-secondary group-hover:text-on-surface transition-colors'}`}>
                  {plan.tier}
                </h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className={`font-h2 text-h2 ${plan.highlighted ? 'text-[var(--aura-tertiary)]' : 'text-on-surface'}`}>
                    ${plan.price}
                  </span>
                  <span className={`font-label-caps text-label-caps ${plan.highlighted ? 'text-[var(--aura-tertiary)]/70' : 'text-secondary'}`}>
                    {plan.period}
                  </span>
                </div>
                <div className="metallic-divider mb-8" aria-hidden="true" />
                <ul className="space-y-4">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[var(--aura-tertiary)] text-sm">check</span>
                      <span className={`font-body-md ${plan.highlighted ? 'text-on-surface' : 'text-secondary'}`}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                className={`w-full py-4 font-label-caps text-label-caps uppercase tracking-widest transition-all active:scale-[0.98] ${
                  plan.highlighted
                    ? 'bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] hover:brightness-110'
                    : 'bg-transparent border border-secondary text-secondary hover:bg-secondary hover:text-[var(--aura-noir-deep)]'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Visual Element */}
        <div className="mt-20 relative w-full h-80 chrome-border overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" aria-hidden="true" />
          <img
            className="w-full h-full object-cover grayscale opacity-40 group-hover:opacity-60 group-hover:scale-105 transition-all duration-700"
            alt="A high-contrast, professional architectural photograph of a luxury industrial cafe interior. Deep navy and charcoal shadows contrast with warm bronze lighting. The scene features raw concrete pillars, brushed chrome espresso machines, and minimalist high-end seating."
            src={FOUNDRY_IMAGE}
          />
          <div className="absolute bottom-8 left-8 z-20">
            <p className="font-label-caps text-label-caps text-[var(--aura-tertiary)] mb-2">FOUNDRY LOCATION</p>
            <p className="font-h3 text-h3 text-on-surface">The Central Hub.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
<PageFooter
  brand="AURA CAFE"
  socialLinks={["IG", "FB", "TT"].map(s => ({ label: s }))}
  socialSize="sm"
  />

      <style>{`
        .metallic-divider {
          height: 1px;
          width: 100%;
          background: linear-gradient(90deg, transparent 0%, #c6c6c7 50%, transparent 100%);
          opacity: 0.2;
        }
        .chrome-border {
          border: 1px solid rgba(198, 198, 199, 0.2);
        }
        .bronze-border {
          border: 1px solid #D4A574;
          box-shadow: 0 0 15px rgba(212, 165, 116, 0.1);
        }
        .bronze-glow {
          text-shadow: 0 0 8px rgba(212, 165, 116, 0.4);
        }
      `}</style>
    </StitchShell>
  );
}
