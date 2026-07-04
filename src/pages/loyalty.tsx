import { useLoyaltyStore } from '@/hooks/stores/use-loyalty-store';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { cn } from '@/lib/cn';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StitchLoyaltyNew,
  type LoyaltyDashboardData,
  type LoyaltyRewardItem,
  type LoyaltyHistoryEntry,
  type LoyaltyStreakDay,
  type LoyaltyTierBenefit,
  type LoyaltyLoadingState,
} from '@/components/stitch/StitchLoyaltyNew';

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

const TIER_BENEFIT_KEYS = ['benefit1', 'benefit2', 'benefit3', 'benefit4'];

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

/* ═══════════════════════════════════════════════════════════════════
   Sub-components are now provided by StitchLoyaltyNew
   ═══════════════════════════════════════════════════════════════════ */

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
  const { t } = useTranslation();
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

  /* ── Derived loading state for StitchLoyaltyNew ────────────────── */
  const loadingState: LoyaltyLoadingState = storeLoading
    ? 'loading'
    : storeError
      ? 'error'
      : 'idle';

  /* ── Build dashboard data ──────────────────────────────────────── */
  const TOTAL_POINTS = 15000;
  const progressPct = Math.min(100, Math.round((points / TOTAL_POINTS) * 100));
  const formattedTier = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : 'Bronze';

  const streakDays: LoyaltyStreakDay[] = WEEK_DAYS.map((day) => ({
    label: t(`loyalty.days.${day}`),
    checked: checkinDays[day] ?? false,
  }));

  const mappedRewards: LoyaltyRewardItem[] = rewards.map((r, idx) => ({
    id: r.id,
    title: r.name,
    pointsCost: r.cost,
    imageUrl: REWARD_IMAGES[idx % REWARD_IMAGES.length] ?? '',
    imageAlt: r.name,
  }));

  const mappedHistory: LoyaltyHistoryEntry[] = history.map((h) => ({
    id: h.id,
    activity: h.reason,
    date: h.date,
    status: 'completed' as const,
    points: h.points,
  }));

  const tierBenefits: LoyaltyTierBenefit[] = TIER_BENEFIT_KEYS.map((key) => ({
    label: t(`loyalty.${key}`),
  }));

  const dashboardData: LoyaltyDashboardData = {
    tierName: formattedTier,
    memberSince: '2022',
    tierDescription: t('loyalty.heroDescription'),
    nextTier: 'Black Tier',
    pointsRemainingForNextTier: TOTAL_POINTS - points,
    progressPercent: progressPct,
    pointsBalance: points,
    streakCount: 12,
    referralCode: referralCode,
    rewards: mappedRewards,
    pointsHistory: mappedHistory,
    streakDays: streakDays,
    tierBenefits: tierBenefits,
  };

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
          {[
            { key: 'navTiers', label: 'Tiers' },
            { key: 'navRewards', label: 'Rewards' },
            { key: 'navLounge', label: 'Lounge' },
            { key: 'navConcierge', label: 'Concierge' },
          ].map(({ key }) => {
            const isActive = key === 'navRewards';
            return (
              <a
                key={key}
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
                {t(`loyalty.${key}`)}
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
            {t('loyalty.membership')}
          </button>
          <div
            className="w-10 h-10 rounded-full border p-0.5 overflow-hidden"
            style={{ borderColor: 'rgba(205,127,50,0.2)' }}
          >
            <img
              className="w-full h-full object-cover rounded-full"
              alt={t('loyalty.memberProfileAlt')}
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuC_Oxyq1zrTrXQ-uyuJYfLRy8IFFqmzEHbnEXxIUveRL23mJRBnSxK-c9OIOkxZSfOmXN0c8G4GRUaYb_NMLeRoySWCtvjIx62nk_KpJRdKtUCsX6Dc0Kg754MPsYj9fEGkFuVRngOx9w4M5ncO5c_wLbsdcH_ee8NxAasSgQdHynopzhjGsB0yBRttQ4JfDGRNZRzZcgIDEVbU52i2F__EDsJzIegpEIenyZKYmrQCb-e14odxLXJ8H5Y6cHD4Vj_6aPENmx-OThk"
            />
          </div>
        </div>
      </header>

      <StitchLoyaltyNew
        data={dashboardData}
        loadingState={loadingState}
        errorMessage={storeError || t('loyalty.errorDescription')}
        onClaimReward={(rewardId) => store.redeemReward(rewardId)}
      />
    </div>
  );
}
