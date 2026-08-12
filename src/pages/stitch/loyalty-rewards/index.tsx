import { useState, useRef, useEffect, type ReactNode } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

/* ── Types ──────────────────────────────────────────────────────────── */

interface NavLink {
  label: string;
  href: string;
  active?: boolean;
}

interface Activity {
  activity: string;
  date: string;
  status: string;
  points: string;
}

interface Reward {
  title: string;
  points: string;
  image: string;
  alt?: string;
}

const NAV_LINKS = [
  { label: 'Tiers', href: '#tiers', active: false },
  { label: 'Rewards', href: '#rewards', active: true },
  { label: 'Lounge', href: '#lounge', active: false },
  { label: 'Concierge', href: '#concierge', active: false },
] as const;

const REWARDS = [
  {
    title: 'Private Cupping Session',
    points: '4,500',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB5VoyAqqlj9v1p_Fd0vKnkJbm4fDpCbBfcfnGk9iXWJsQkUY4p9MwZE9gW4aIGDezgU5nVuKq9kA5nJlELipUIKxSAu-iJ0TyddMgMz4EetP8GtGSFzEHu72d1fnLIk3pCADfO75fGMgJjAfybKZas0EOq-e0Wu_847djVJd6nISO3cs0Pjyb7NUii2ULfHnRyQW30Laqzeso6-81-OMMeqPUorTlgkBBRabwNARHVIRCd7uvVvxzFycbE1Y4I-ysk4OWL4tc5Mtk',
    alt: 'Private coffee cupping session with elegant glass vessels on dark industrial wood table',
  },
  {
    title: 'Limited Edition Vessel',
    points: '8,000',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD1ZYyk4mbXZG3-ZeOC-Q5TZST8LNWGfeghQ08Q6qfgBKPaqKi2xvxzOhGO64VKfR7PP8RlK7NqYc5d0KyUivemYw5JwC_jdKmOULyvxP6-iAfdcE3TynE0mhz2DNdVaaRjQQi2rnuYdumCRNtZb-HNEiKa1grVkNIXGPNK9z0SxwpgcmyPwiY8KGLjvlpu-inWp6t01uR2oV28qWJNBVzw7R7ne9nt747XKEB9Q2FKmg7c_NrELvOi2xwOpzmbhqX2YaBD_vG3uRE',
    alt: 'Matte black ceramic coffee vessel with polished bronze handle on dark slate surface',
  },
  {
    title: 'Artisan Coffee Flight',
    points: '2,500',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAHAfEGOOefIl2MVbYXeX3iigZB8rveXFZ7jluS_IW7_nDi6Phokeh3xVop2G1btyCwd2nrPhZnWVDIeCsGyK_u0ukBnx06WTAn2Irk1_14p99qJYFVXOIyjxQPmBB5ONiDOz-sZHx1_hSVTRDTwU7zj75xxi5_-LTat6pQ36So9JPYZ4X4k9sCoOIWYVgr_SmQXuEaD9hCKRXmaI-eicBKDQJnGmeubIirNBf0n4CzrYV1-4-CnEiGR7ksClo00VjDHOFshsJkssc',
    alt: 'Three crystal carafes of specialty coffees on metallic tray in dimly lit lounge',
  },
] as const satisfies readonly Reward[];

const ACTIVITIES = [
  { activity: 'Kenya SL28 Purchase', date: 'OCT 24, 2024', status: 'COMPLETED', points: '+450' },
  { activity: 'Concierge Booking', date: 'OCT 20, 2024', status: 'COMPLETED', points: '+1,200' },
  { activity: 'Referral Bonus', date: 'OCT 15, 2024', status: 'COMPLETED', points: '+2,000' },
] as const satisfies readonly Activity[];

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const COMPLETED_DAYS = 3; // Mon, Tue, Wed completed

const TIER_BENEFITS = [
  'Complementary valet parking',
  'Priority reservation access',
  'Invite-only tasting events',
  '15% Discount on retail gear',
] as const;

/* ── Component ──────────────────────────────────────────────────────── */

export default function LoyaltyRewardsDashboard() {
  const [copied, setCopied] = useState(false);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText('AURA-PLAT-882');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Parallax tilt on glass cards
  useEffect(() => {
    const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];
    const handleMouseMove = (e: MouseEvent) => {
      const card = e.currentTarget as HTMLDivElement;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / 25;
      const rotateY = (centerX - x) / 25;
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    };

    const handleMouseLeave = (card: HTMLDivElement) => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    };

    cards.forEach((card) => {
      card.addEventListener('mousemove', handleMouseMove);
      card.addEventListener('mouseleave', () => handleMouseLeave(card));
    });

    return () => {
      cards.forEach((card) => {
        card.removeEventListener('mousemove', handleMouseMove);
        card.removeEventListener('mouseleave', () => handleMouseLeave(card));
      });
    };
  }, []);

  return (
    <StitchShell>
      <div className="min-h-screen bg-[var(--aura-noir-void)] text-[var(--aura-chrome-bright)]">
        {/* ── Top Navigation ───────────────────────────────────────── */}
<PageHeader brand="AURA CAFE" scrollEffect />

        {/* ── Main Content ─────────────────────────────────────────── */}
        <main className="pt-32 pb-24 px-5 md:px-16 max-w-[1440px] mx-auto grid grid-cols-12 gap-6">
          {/* Left Column */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            {/* Platinum Card */}
            <section
              ref={(el) => { cardRefs.current[0] = el; }}
              className="relative overflow-hidden rounded-xl p-6 flex flex-col md:flex-row justify-between items-end md:items-stretch gap-6"
              style={{
                background: 'linear-gradient(135deg, rgba(205,127,50,0.15) 0%, rgba(5,20,36,0.4) 100%)',
                backdropFilter: 'blur(32px)',
                WebkitBackdropFilter: 'blur(32px)',
                border: '1px solid rgba(205,127,50,0.3)',
              }}
            >
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
                backgroundImage: 'url(https://www.transparenttextures.com/patterns/brushed-alum.png)',
              }} />
              <div className="flex flex-col justify-between flex-1 relative">
                <div>
                  <span className="inline-block px-3 py-1 bg-[var(--aura-tertiary)]/20 border border-[var(--aura-tertiary)]/40 rounded-full text-[10px] font-bold tracking-[0.2em] text-[var(--aura-tertiary)] uppercase mb-4">
                    Platinum Tier
                  </span>
                  <h2 className="font-display text-4xl md:text-5xl text-[var(--aura-chrome-bright)] mb-2 leading-tight">
                    Member Since 2022
                  </h2>
                  <p className="font-body text-[var(--aura-chrome-mid)] opacity-80 text-base">
                    You are in the top 2% of our community. Enjoy exclusive access to the Obsidian Lounge.
                  </p>
                </div>
                <div className="mt-6">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-xs text-[var(--aura-chrome-dark)] uppercase tracking-wider">Next Level: Black Tier</span>
                    <span className="text-xs text-[var(--aura-tertiary)]">2,550 pts remaining</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full overflow-hidden" style={{
                    background: 'rgba(18,32,49,1)',
                    boxShadow: '0 0 20px rgba(205,127,50,0.2)',
                  }}>
                    <div className="h-full rounded-full" style={{
                      width: '78%',
                      background: 'linear-gradient(90deg, #8e4e00 0%, #cd7f32 50%, #ffb779 100%)',
                    }} />
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end justify-between text-right min-w-[200px] relative">
                <span className="text-xs text-[var(--aura-chrome-dark)] uppercase tracking-widest">Balance</span>
                <div className="text-[72px] leading-none text-[var(--aura-tertiary)] font-light mt-2" style={{ fontFamily: "'Libre Caslon Text', serif" }}>
                  12,450
                </div>
                <div className="text-xs tracking-tighter" style={{ color: 'rgba(198,198,198,0.7)' }}>PREMIUM REWARD POINTS</div>
                <button className="mt-6 w-full py-3 bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-bold rounded-lg active:scale-95 transition-transform">
                  Redeem Points
                </button>
              </div>
            </section>

            {/* Rewards Grid */}
            <section>
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-headline-md text-xl text-[var(--aura-chrome-bright)]">Available Rewards</h3>
                <a href="#all" className="text-xs text-[var(--aura-tertiary)] hover:underline uppercase tracking-widest">
                  View All
                </a>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {REWARDS.map((reward) => (
                  <div
                    key={reward.title}
                    className="rounded-xl overflow-hidden group cursor-pointer hover:border-[var(--aura-tertiary)]/40 transition-all duration-500 bg-[rgba(40,54,71,0.4)] backdrop-blur-xl border border-white/10"
                  >
                    <div className="h-40 relative">
                      <img
                        src={reward.image}
                        alt={reward.alt}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-noir-void)] to-transparent" />
                    </div>
                    <div className="p-6">
                      <h4 className="font-body text-lg text-[var(--aura-chrome-bright)] mb-1">{reward.title}</h4>
                      <p className="text-xs text-[var(--aura-chrome-dark)] mb-4">{reward.points} POINTS</p>
                      <button className="w-full py-2 border border-[var(--aura-chrome-dark)]/30 text-xs font-bold rounded hover:bg-white/5 transition-colors">
                        Claim Reward
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Points History */}
            <section
              ref={(el) => { cardRefs.current[1] = el; }}
              className="rounded-xl p-6 overflow-hidden bg-[rgba(40,54,71,0.4)] backdrop-blur-xl border border-white/10"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-headline-md text-xl text-[var(--aura-chrome-bright)]">Points History</h3>
                <button className="text-[var(--aura-chrome-dark)] hover:text-[var(--aura-tertiary)] transition-colors" aria-label="Filter list">
                  {copied ? '✅' : '🔍'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="py-4 text-xs text-[var(--aura-chrome-mid)] tracking-widest uppercase font-bold">Activity</th>
                      <th className="py-4 text-xs text-[var(--aura-chrome-mid)] tracking-widest uppercase font-bold">Date</th>
                      <th className="py-4 text-xs text-[var(--aura-chrome-mid)] tracking-widest uppercase font-bold">Status</th>
                      <th className="py-4 text-xs text-[var(--aura-chrome-mid)] tracking-widest uppercase font-bold text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {ACTIVITIES.map((item) => (
                      <tr key={item.activity} className="group hover:bg-white/5 transition-colors">
                        <td className="py-4 font-body">{item.activity}</td>
                        <td className="py-4 text-sm text-[var(--aura-chrome-dark)]">{item.date}</td>
                        <td className="py-4">
                          <span className="px-2 py-0.5 rounded text-[10px] border border-[var(--aura-tertiary)]/40 text-[var(--aura-tertiary)]">
                            {item.status}
                          </span>
                        </td>
                        <td className="py-4 text-right font-bold text-[var(--aura-tertiary)]">{item.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            {/* Weekly Streak */}
            <section
              ref={(el) => { cardRefs.current[2] = el; }}
              className="rounded-xl p-6 bg-[rgba(40,54,71,0.4)] backdrop-blur-xl border border-white/10"
            >
              <h3 className="font-headline-md text-xl text-[var(--aura-chrome-bright)] mb-6">Weekly Streak</h3>
              <div className="flex justify-between items-center gap-2">
                {WEEKDAYS.map((day, i) => {
                  const isCompleted = i < COMPLETED_DAYS;
                  return (
                    <div key={day} className="flex flex-col items-center gap-2">
                      <div
                        className={`w-10 h-10 rounded-full border flex items-center justify-center text-lg ${
                          isCompleted
                            ? 'border-[var(--aura-tertiary)] text-[var(--aura-tertiary)] bg-[var(--aura-tertiary)]/10'
                            : 'border-white/20 text-white/30'
                        }`}
                      >
                        👑
                      </div>
                      <span className="text-[10px] text-[var(--aura-chrome-dark)] font-bold">{day}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-6 font-body text-base text-[var(--aura-chrome-mid)] leading-relaxed">
                Check in today to maintain your <span className="text-[var(--aura-tertiary)] font-bold">12-day streak</span> and earn double points on your next pour.
              </p>
              <button className="mt-4 w-full py-3 bg-[var(--aura-noir-deep)] border border-white/20 text-[var(--aura-chrome-bright)] font-bold rounded-lg hover:border-[var(--aura-tertiary)]/40 transition-all flex items-center justify-center gap-2">
                📍 Check-in at Roastery
              </button>
            </section>

            {/* Referral Block */}
            <section
              ref={(el) => { cardRefs.current[3] = el; }}
              className="rounded-xl p-6 relative overflow-hidden bg-[rgba(40,54,71,0.4)] backdrop-blur-xl border border-white/10"
            >
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-[var(--aura-tertiary)]/10 blur-[64px]" />
              <h3 className="font-headline-md text-xl text-[var(--aura-chrome-bright)] mb-2">Refer &amp; Earn</h3>
              <p className="font-body text-sm text-[var(--aura-chrome-dark)] mb-6">
                Invite another connoisseur. When they join, you both receive 2,000 premium points.
              </p>
              <div className="p-3 rounded border border-white/10 flex items-center justify-between mb-4" style={{ background: 'rgba(5,20,36,1)' }}>
                <span className="font-display text-xl tracking-widest text-[var(--aura-tertiary)]">AURA-PLAT-882</span>
                <button
                  onClick={handleCopyCode}
                  className="text-[var(--aura-tertiary)] hover:text-white flex items-center gap-1 text-xs font-bold active:scale-90 transition-all"
                >
                  {copied ? '✅' : '📋'} {copied ? 'COPIED' : 'COPY'}
                </button>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 py-2 bg-white/5 border border-white/20 rounded flex items-center justify-center hover:bg-white/10 transition-all">
                  📤
                </button>
                <button className="flex-[3] py-2 bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-bold rounded">
                  Share Invite Link
                </button>
              </div>
            </section>

            {/* Tier Benefits */}
            <section
              ref={(el) => { cardRefs.current[4] = el; }}
              className="rounded-xl p-6 bg-[rgba(40,54,71,0.4)] backdrop-blur-xl border border-white/10"
            >
              <h3 className="text-xs text-[var(--aura-chrome-dark)] uppercase tracking-[0.2em] mb-6">Tier Benefits</h3>
              <ul className="space-y-4">
                {TIER_BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3 group">
                    <span className="w-1.5 h-1.5 bg-[var(--aura-tertiary)] rounded-full group-hover:scale-150 transition-transform" />
                    <span className="font-body text-[var(--aura-chrome-bright)]">{benefit}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </main>

        {/* ── Footer ───────────────────────────────────────────────── */}
<PageFooter
  brand="AURA CAFE"
  socialLinks={["IG", "FB", "TT"].map(s => ({ label: s }))}
  socialSize="sm"
  />
      </div>
    </StitchShell>
  );
}
