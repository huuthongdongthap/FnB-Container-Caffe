import { useLoyaltyStore } from '@/hooks/stores/use-loyalty-store';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { cn } from '@/lib/cn';
import { useEffect, useState, useCallback } from 'react';
import {
  Award,
  MapPin,
  Copy,
  Check,
  Share2,
  ListFilter,
  Gift,
  RefreshCw,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

interface Reward {
  id: string;
  name: string;
  cost: number;
  icon: string;
  description: string;
}

interface PointsHistoryEntry {
  id: string;
  date: string;
  reason: string;
  points: number;
  balance: number;
}

interface LoyaltyPageProps {
  /** Override points (default: store.points) */
  points?: number;
  /** Override tier (default: store.tier) */
  tier?: string;
  /** Override rewards (default: store.rewards) */
  rewards?: Reward[];
  /** Override history (default: store.history) */
  history?: PointsHistoryEntry[];
  /** Override referral code (default: "AURA-PLAT-882") */
  referralCode?: string;
  /** Override check-in days (default: Mon-Wed checked) */
  checkinDays?: Record<string, boolean>;
}

/* ═══════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════ */

const WEEK_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

const TIER_BENEFITS = [
  'Complementary valet parking',
  'Priority reservation access',
  'Invite-only tasting events',
  '15% Discount on retail gear',
];

const DEFAULT_CHECKIN: Record<string, boolean> = {
  MON: true,
  TUE: true,
  WED: true,
  THU: false,
  FRI: false,
  SAT: false,
};

/** Default campaign image URLs from the Stitch design. */
const REWARD_IMAGES = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB5VoyAqqlj9v1p_Fd0vKnkJbm4fDpCbBfcfnGk9iXWJsQkUY4p9MwZE9gW4aIGDezgU5nVuKq9kA5nJlELipUIKxSAu-iJ0TyddMgMz4EetP8GtGSFzEHu72d1fnLIk3pCADfO75fGMgJjAfybKZas0EOq-e0Wu_847djVJd6nISO3cs0Pjyb7NUii2ULfHnRyQW30Laqzeso6-81-OMMeqPUorTlgkBBRabwNARHVIRCd7uvVvxzFycbE1Y4I-ysk4OWL4tc5Mtk',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuD1ZYyk4mbXZG3-ZeOC-Q5TZST8LNWGfeghQ08Q6qfgBKPaqKi2xvxzOhGO64VKfR7PP8RlK7NqYc5d0KyUivemYw5JwC_jdKmOULyvxP6-iAfdcE3TynE0mhz2DNdVaaRjQQi2rnuYdumCRNtZb-HNEiKa1grVkNIXGPNK9z0SxwpgcmyPwiY8KGLjvlpu-inWp6t01uR2oV28qWJNBVzw7R7ne9nt747XKEB9Q2FKmg7c_NrELvOi2xwOpzmbhqX2YaBD_vG3uRE',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAHAfEGOOefIl2MVbYXeX3iigZB8rveXFZ7jluS_IW7_nDi6Phokeh3xVop2G1btyCwd2nrPhZnWVDIeCsGyK_u0ukBnx06WTAn2Irk1_14p99qJYFVXOIyjxQPmBB5ONiDOz-sZHx1_hSVTRDTwU7zj75xxi5_-LTat6pQ36So9JPYZ4X4k9sCoOIWYVgr_SmQXuEaD9hCKRXmaI-eicBKDQJnGmeubIirNBf0n4CzrYV1-4-CnEiGR7ksClo00VjDHOFshsJkssc',
];

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

function formatPoints(n: number): string {
  return n.toLocaleString('en-US');
}

/* ═══════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════ */

/** Glass skeleton placeholder for loading state. */
function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl',
        'bg-[rgba(40,54,71,0.3)] backdrop-blur-[24px] border border-white/5',
        className,
      )}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#051424] pt-32 pb-24 px-5 md:px-16">
      <div className="mx-auto max-w-[1440px] grid grid-cols-12 gap-6">
        {/* Left column skeletons */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-12">
          <SkeletonBlock className="h-56" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SkeletonBlock className="h-72" />
            <SkeletonBlock className="h-72" />
            <SkeletonBlock className="h-72" />
          </div>
          <SkeletonBlock className="h-64" />
        </div>
        {/* Right column skeletons */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-12">
          <SkeletonBlock className="h-72" />
          <SkeletonBlock className="h-48" />
          <SkeletonBlock className="h-56" />
        </div>
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-[#051424] flex items-center justify-center px-5">
      <div
        className="max-w-md w-full p-10 text-center rounded-xl"
        style={{
          background: 'rgba(40,54,71,0.4)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="w-14 h-14 mx-auto mb-5 rounded-full border border-[rgba(255,180,171,0.4)] flex items-center justify-center bg-[rgba(255,180,171,0.1)]">
          <RefreshCw size={24} color="#ffb4ab" />
        </div>
        <h2
          className="mb-2"
          style={{
            fontFamily: "'Libre Caslon Text', serif",
            fontSize: '28px',
            color: '#d5e4fa',
          }}
        >
          Unable to load
        </h2>
        <p className="text-sm mb-6" style={{ color: '#a18d7f' }}>
          Your loyalty data could not be fetched. Please check your connection and try again.
        </p>
        <button
          onClick={onRetry}
          className="w-full py-3 rounded-lg font-bold text-sm transition-transform active:scale-95"
          style={{
            background: 'var(--aura-tertiary)',
            color: '#4c2700',
          }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 px-6 text-center rounded-xl"
      style={{
        background: 'rgba(40,54,71,0.4)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <Gift size={36} color="#a18d7f" opacity={0.5} className="mb-4" />
      <p
        className="text-lg"
        style={{
          fontFamily: "'Libre Caslon Text', serif",
          color: '#d5e4fa',
        }}
      >
        {message}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════════ */

export function LoyaltyPage({
  points: propPoints,
  tier: propTier,
  rewards: propRewards,
  history: propHistory,
  referralCode: propReferralCode,
  checkinDays: propCheckinDays,
}: Readonly<LoyaltyPageProps> = {}) {
  const store = useLoyaltyStore();
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = !!token;

  useEffect(() => {
    if (isAuthenticated) {
      store.fetchLoyalty();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  /* ── Data (props override store) ─────────────────────────────── */
  const points = propPoints ?? store.points;
  const tier = propTier ?? store.tier;
  const rewards = propRewards ?? store.rewards;
  const history = propHistory ?? store.history;
  const storeError = store.error;
  const storeLoading = store.loading;
  const referralCode = propReferralCode ?? 'AURA-PLAT-882';
  const checkinDays = propCheckinDays ?? DEFAULT_CHECKIN;

  const [copied, setCopied] = useState(false);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [referralCode]);

  /* ── Loading state ───────────────────────────────────────────── */
  if (storeLoading) {
    return <LoadingSkeleton />;
  }

  /* ── Error state ─────────────────────────────────────────────── */
  if (storeError) {
    return <ErrorState onRetry={store.fetchLoyalty} />;
  }

  /* ── Progress bar calc ───────────────────────────────────────── */
  const TOTAL_POINTS = 15000;
  const progressPct = Math.min(100, Math.round((points / TOTAL_POINTS) * 100));

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{
        backgroundColor: '#051424',
        color: '#d5e4fa',
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      {/* ═══════════ Header ═══════════ */}
      <header
        className="fixed top-0 w-full z-50 border-b backdrop-blur-xl flex justify-between items-center px-5 md:px-16 py-2 mx-auto"
        style={{
          background: 'rgba(5, 20, 36, 0.8)',
          borderColor: 'rgba(161, 141, 127, 0.1)',
        }}
      >
        <div
          className="tracking-widest uppercase"
          style={{
            fontFamily: "'Libre Caslon Text', serif",
            fontSize: '40px',
            lineHeight: '1',
            fontWeight: '400',
            color: 'var(--aura-tertiary)',
          }}
        >
          AURA CAFE
        </div>

        <nav className="hidden md:flex gap-6 items-center">
          {['Tiers', 'Rewards', 'Lounge', 'Concierge'].map((label) => {
            const isActive = label === 'Rewards';
            return (
              <a
                key={label}
                href="#"
                className={cn(
                  'text-sm font-medium transition-colors duration-300',
                  isActive && 'font-bold border-b-2 pb-1',
                )}
                style={{
                  color: isActive ? 'var(--aura-tertiary)' : '#d8c2b2',
                  borderColor: isActive ? 'var(--aura-tertiary)' : 'transparent',
                }}
              >
                {label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <button
            className="px-6 py-2 text-xs font-semibold tracking-[0.1em] rounded-full border transition-all hover:bg-white/5"
            style={{
              borderColor: 'rgba(205,127,50,0.3)',
              color: 'var(--aura-tertiary)',
            }}
          >
            Membership
          </button>
          <div
            className="w-10 h-10 rounded-full border p-0.5 overflow-hidden"
            style={{ borderColor: 'rgba(205,127,50,0.2)' }}
          >
            <img
              className="w-full h-full object-cover rounded-full"
              alt="Member profile"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuC_Oxyq1zrTrXQ-uyuJYfLRy8IFFqmzEHbnEXxIUveRL23mJRBnSxK-c9OIOkxZSfOmXN0c8G4GRUaYb_NMLeRoySWCtvjIx62nk_KpJRdKtUCsX6Dc0Kg754MPsYj9fEGkFuVRngOx9w4M5ncO5c_wLbsdcH_ee8NxAasSgQdHynopzhjGsB0yBRttQ4JfDGRNZRzZcgIDEVbU52i2F__EDsJzIegpEIenyZKYmrQCb-e14odxLXJ8H5Y6cHD4Vj_6aPENmx-OThk"
            />
          </div>
        </div>
      </header>

      {/* ═══════════ Main Content ═══════════ */}
      <main
        className="pt-32 pb-24 px-5 md:px-16 mx-auto grid grid-cols-12 gap-6"
        style={{ maxWidth: '1440px' }}
      >
        {/* ─── Left Column: Hero & Rewards ─── */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-12">

          {/* ─── Platinum Hero Card ─── */}
          <section
            className="rounded-xl p-6 flex flex-col md:flex-row justify-between items-end md:items-stretch gap-6 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(205,127,50,0.15) 0%, rgba(5,20,36,0.4) 100%)',
              backdropFilter: 'blur(32px)',
              WebkitBackdropFilter: 'blur(32px)',
              border: '1px solid rgba(205,127,50,0.3)',
              boxShadow: '0 0 20px rgba(205,127,50,0.2)',
            }}
          >
            {/* Brushed texture overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-5"
              style={{
                backgroundImage: "url('https://www.transparenttextures.com/patterns/brushed-alum.png')",
              }}
            />

            <div className="flex flex-col justify-between flex-1 relative z-10">
              <div>
                <div
                  className="inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase mb-3"
                  style={{
                    background: 'rgba(205,127,50,0.2)',
                    border: '1px solid rgba(205,127,50,0.4)',
                    color: 'var(--aura-tertiary)',
                  }}
                >
                  {tier.charAt(0).toUpperCase() + tier.slice(1)} Tier
                </div>
                <h2
                  className="mb-2"
                  style={{
                    fontFamily: "'Libre Caslon Text', serif",
                    fontSize: '48px',
                    lineHeight: '1.1',
                    letterSpacing: '-0.02em',
                    fontWeight: '400',
                    color: '#d5e4fa',
                  }}
                >
                  Member Since 2022
                </h2>
                <p
                  className="text-base opacity-80"
                  style={{ color: '#d8c2b2' }}
                >
                  You are in the top 2% of our community. Enjoy exclusive access to the Obsidian Lounge.
                </p>
              </div>

              <div className="mt-12">
                <div className="flex justify-between items-end mb-2">
                  <span
                    className="text-xs uppercase tracking-wider"
                    style={{ color: '#a18d7f' }}
                  >
                    Next Level: Black Tier
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: 'var(--aura-tertiary)' }}
                  >
                    {formatPoints(TOTAL_POINTS - points)} pts remaining
                  </span>
                </div>
                <div
                  className="h-1.5 w-full rounded-full overflow-hidden"
                  style={{
                    background: '#122031',
                    boxShadow: '0 0 20px rgba(205,127,50,0.2)',
                  }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${progressPct}%`,
                      background: 'linear-gradient(90deg, #8e4e00 0%, #cd7f32 50%, #ffb779 100%)',
                      transition: 'width 0.6s ease',
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end justify-between text-right relative z-10 min-w-[200px]">
              <span
                className="text-xs uppercase tracking-widest"
                style={{ color: '#a18d7f' }}
              >
                Balance
              </span>
              <div
                className="leading-none font-light"
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '72px',
                  color: 'var(--aura-tertiary)',
                }}
              >
                {formatPoints(points)}
              </div>
              <div
                className="text-xs tracking-tighter"
                style={{ color: '#e2e2e2' }}
              >
                PREMIUM REWARD POINTS
              </div>
              <button
                className="mt-6 w-full py-3 rounded-lg font-bold transition-transform active:scale-95"
                style={{
                  background: 'var(--aura-tertiary)',
                  color: '#4c2700',
                }}
              >
                Redeem Points
              </button>
            </div>
          </section>

          {/* ─── Available Rewards ─── */}
          <section>
            <div className="flex justify-between items-center mb-6">
              <h3
                className="text-2xl"
                style={{
                  fontFamily: "'Libre Caslon Text', serif",
                  fontWeight: '400',
                  color: '#d5e4fa',
                }}
              >
                Available Rewards
              </h3>
              <a
                href="#"
                className="text-xs uppercase tracking-widest hover:underline"
                style={{ color: 'var(--aura-tertiary)' }}
              >
                View All
              </a>
            </div>

            {rewards.length === 0 ? (
              <EmptyState message="No rewards available yet. Check back soon!" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {rewards.map((reward, idx) => {
                  const canAfford = points >= reward.cost;
                  return (
                    <div
                      key={reward.id}
                      className="rounded-xl overflow-hidden group cursor-pointer transition-all duration-500"
                      style={{
                        background: 'rgba(40,54,71,0.4)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(205,127,50,0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                      }}
                    >
                      <div className="h-40 relative overflow-hidden">
                        <img
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          src={REWARD_IMAGES[idx % REWARD_IMAGES.length]}
                          alt={reward.name}
                          loading="lazy"
                        />
                        <div
                          className="absolute inset-0"
                          style={{
                            background: 'linear-gradient(to top, #051424, transparent)',
                          }}
                        />
                      </div>
                      <div className="p-6">
                        <h4
                          className="text-lg mb-1"
                          style={{ color: '#d5e4fa' }}
                        >
                          {reward.name}
                        </h4>
                        <p
                          className="text-xs mb-4"
                          style={{ color: '#a18d7f' }}
                        >
                          {formatPoints(reward.cost)} POINTS
                        </p>
                        <button
                          disabled={!canAfford}
                          onClick={() => store.redeemReward(reward.id)}
                          className="w-full py-2 rounded text-xs font-bold transition-colors"
                          style={{
                            border: `1px solid ${canAfford ? 'rgba(161,141,127,0.3)' : 'rgba(161,141,127,0.1)'}`,
                            color: canAfford ? '#d5e4fa' : '#5a6270',
                            opacity: canAfford ? 1 : 0.5,
                            cursor: canAfford ? 'pointer' : 'not-allowed',
                          }}
                          onMouseEnter={(e) => {
                            if (canAfford) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          {canAfford ? 'Claim Reward' : 'Not enough points'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ─── Points History ─── */}
          <section
            className="rounded-xl p-6 overflow-hidden"
            style={{
              background: 'rgba(40,54,71,0.4)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div className="flex justify-between items-center mb-6">
              <h3
                className="text-2xl"
                style={{
                  fontFamily: "'Libre Caslon Text', serif",
                  fontWeight: '400',
                  color: '#d5e4fa',
                }}
              >
                Points History
              </h3>
              <ListFilter
                size={20}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                color="#a18d7f"
              />
            </div>

            {history.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: '#a18d7f' }}>
                No point activity yet. Start earning rewards!
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'rgba(161,141,127,0.1)' }}>
                      <th
                        className="py-4 text-xs tracking-widest uppercase font-bold"
                        style={{ color: '#c6c6c6' }}
                      >
                        Activity
                      </th>
                      <th
                        className="py-4 text-xs tracking-widest uppercase font-bold"
                        style={{ color: '#c6c6c6' }}
                      >
                        Date
                      </th>
                      <th
                        className="py-4 text-xs tracking-widest uppercase font-bold"
                        style={{ color: '#c6c6c6' }}
                      >
                        Status
                      </th>
                      <th
                        className="py-4 text-xs tracking-widest uppercase font-bold text-right"
                        style={{ color: '#c6c6c6' }}
                      >
                        Points
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'rgba(161,141,127,0.05)' }}>
                    {history.map((entry) => (
                      <tr
                        key={entry.id}
                        className="transition-colors hover:bg-white/5"
                      >
                        <td className="py-4 text-base" style={{ color: '#d5e4fa' }}>
                          {entry.reason}
                        </td>
                        <td className="py-4 text-xs" style={{ color: '#a18d7f' }}>
                          {entry.date}
                        </td>
                        <td className="py-4">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] border"
                            style={{
                              borderColor: 'rgba(205,127,50,0.4)',
                              color: 'var(--aura-tertiary)',
                            }}
                          >
                            COMPLETED
                          </span>
                        </td>
                        <td
                          className="py-4 text-right font-bold"
                          style={{ color: 'var(--aura-tertiary)' }}
                        >
                          +{formatPoints(entry.points)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* ─── Right Column: Stats & Social ─── */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-12">

          {/* ─── Check-in Tracker ─── */}
          <section
            className="rounded-xl p-6"
            style={{
              background: 'rgba(40,54,71,0.4)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <h3
              className="text-2xl mb-6"
              style={{
                fontFamily: "'Libre Caslon Text', serif",
                fontWeight: '400',
                color: '#d5e4fa',
              }}
            >
              Weekly Streak
            </h3>
            <div className="flex justify-between items-center gap-2">
              {WEEK_DAYS.map((day) => {
                const checked = checkinDays[day];
                return (
                  <div key={day} className="flex flex-col items-center gap-2">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center border"
                      style={{
                        borderColor: checked ? 'var(--aura-tertiary)' : 'rgba(161,141,127,0.2)',
                        background: checked ? 'rgba(205,127,50,0.1)' : 'transparent',
                        color: checked ? 'var(--aura-tertiary)' : 'rgba(161,141,127,0.3)',
                      }}
                    >
                      <Award
                        size={18}
                        fill={checked ? 'var(--aura-tertiary)' : 'none'}
                        color={checked ? 'var(--aura-tertiary)' : 'rgba(161,141,127,0.3)'}
                      />
                    </div>
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: '#a18d7f' }}
                    >
                      {day}
                    </span>
                  </div>
                );
              })}
            </div>
            <p
              className="mt-6 text-base leading-relaxed"
              style={{ color: '#d8c2b2' }}
            >
              Check in today to maintain your{' '}
              <strong style={{ color: 'var(--aura-tertiary)' }}>12-day streak</strong>{' '}
              and earn double points on your next pour.
            </p>
            <button
              className="mt-4 w-full py-3 rounded-lg border transition-all flex items-center justify-center gap-2 font-bold text-sm"
              style={{
                background: '#122031',
                borderColor: 'rgba(161,141,127,0.2)',
                color: '#d5e4fa',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(205,127,50,0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(161,141,127,0.2)';
              }}
            >
              <MapPin size={20} />
              Check-in at Roastery
            </button>
          </section>

          {/* ─── Referral Block ─── */}
          <section
            className="rounded-xl p-6 relative overflow-hidden"
            style={{
              background: 'rgba(40,54,71,0.4)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div
              className="absolute -right-10 -top-10 w-32 h-32 blur-[64px] pointer-events-none"
              style={{ background: 'rgba(205,127,50,0.1)' }}
            />

            <h3
              className="text-2xl mb-2 relative z-10"
              style={{
                fontFamily: "'Libre Caslon Text', serif",
                fontWeight: '400',
                color: '#d5e4fa',
              }}
            >
              Refer &amp; Earn
            </h3>
            <p
              className="text-base mb-6 relative z-10"
              style={{ color: '#a18d7f' }}
            >
              Invite another connoisseur. When they join, you both receive 2,000 premium points.
            </p>

            <div
              className="p-3 rounded flex items-center justify-between mb-4 relative z-10"
              style={{
                background: '#010f1f',
                border: '1px solid rgba(161,141,127,0.1)',
              }}
            >
              <span
                className="tracking-widest"
                style={{
                  fontFamily: "'Libre Caslon Text', serif",
                  fontSize: '24px',
                  color: 'var(--aura-tertiary)',
                }}
              >
                {referralCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1 text-xs font-bold transition-all active:scale-90"
                style={{ color: copied ? '#4CAF50' : 'var(--aura-tertiary)' }}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? 'COPIED' : 'COPY'}
              </button>
            </div>

            <div className="flex gap-2 relative z-10">
              <button
                className="flex-1 py-2 rounded flex items-center justify-center transition-all hover:bg-white/10"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(161,141,127,0.2)',
                }}
              >
                <Share2 size={18} color="#d5e4fa" />
              </button>
              <button
                className="flex-[3] py-2 rounded font-bold text-sm"
                style={{
                  background: 'var(--aura-tertiary)',
                  color: '#4c2700',
                }}
              >
                Share Invite Link
              </button>
            </div>
          </section>

          {/* ─── Tier Benefits ─── */}
          <section
            className="rounded-xl p-6"
            style={{
              background: 'rgba(40,54,71,0.4)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <h3
              className="text-xs uppercase tracking-[0.2em] mb-6 font-bold"
              style={{ color: '#a18d7f' }}
            >
              Tier Benefits
            </h3>
            <ul className="space-y-3">
              {TIER_BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-center gap-3 group">
                  <span
                    className="w-1.5 h-1.5 rounded-full group-hover:scale-150 transition-transform"
                    style={{ background: 'var(--aura-tertiary)' }}
                  />
                  <span
                    className="text-base group-hover:translate-x-1 transition-transform duration-200"
                    style={{ color: '#d5e4fa' }}
                  >
                    {benefit}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
