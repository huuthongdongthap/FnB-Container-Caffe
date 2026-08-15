import { useState } from 'react';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout';
import { ORDER_STYLES } from './order-success-constants';
import { HeroSection } from './hero-section';
import { OrderDetailsCard } from './order-details-card';
import { LocationCard } from './location-card';

export default function OrderSuccessConfirmation() {
  const [currentStep] = useState(1);
  const completedSteps = currentStep;

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <style>{ORDER_STYLES}</style>

      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-[#09141e] via-[#0a2035] to-[#09141e]" />

      <PageHeader brand="AURA CAFE" scrollEffect />

      <main className="w-full max-w-md mx-auto px-5 pt-24 pb-8 flex flex-col gap-6 items-center">
        <HeroSection />

        <OrderDetailsCard completedSteps={completedSteps} />

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

        <LocationCard />
      </main>

      <PageFooter
        brand="&copy; 2024 AURA CAFE. ALL RIGHTS RESERVED."
        socialLinks={["IG", "FB", "TT"].map(s => ({ label: s }))}
        socialSize="sm"
      />
    </div>
  );
}
