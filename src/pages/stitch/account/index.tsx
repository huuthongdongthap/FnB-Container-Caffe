import { useState, useEffect } from 'react';
import { StitchShell } from '../StitchBase';
import { AccountHeader } from './account-header';
import { ProfileCard } from './profile-card';
import { LoyaltySection } from './loyalty-section';
import { RecentTransactions } from './recent-transactions';
import { MembershipCard } from './membership-card';
import { AccountBottomNav } from './account-bottom-nav';

export default function StitchCustomerAccount() {
  const [scrolled, setScrolled] = useState(0);

  useEffect(() => {
    const handler = () => setScrolled(window.pageYOffset);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <StitchShell>
      <AccountHeader />

      <main className="pt-24 pb-28 px-5 max-w-lg mx-auto space-y-5">
        <ProfileCard />
        <LoyaltySection />

        {/* Quick Order CTA */}
        <button
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

        <RecentTransactions />
        <MembershipCard />
      </main>

      <AccountBottomNav />
    </StitchShell>
  );
}
