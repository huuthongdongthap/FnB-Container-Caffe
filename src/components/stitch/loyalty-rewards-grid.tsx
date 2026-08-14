import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import type { LoyaltyRewardItem } from './stitch-loyalty-types';
import { RewardCard } from './loyalty-reward-card';

export function RewardsGrid({
  rewards,
  onClaimReward,
}: {
  rewards: LoyaltyRewardItem[];
  onClaimReward?: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <section>
      <div className="flex justify-between items-center mb-[24px]">
        <h3
          className="text-[24px] leading-[1.4] font-normal"
          style={{ fontFamily: "'Libre Caslon Text', serif", color: 'var(--aura-chrome-bright)' }}
        >
          {t('loyalty.availableRewards')}
        </h3>
        <Link
          to="/loyalty"
          className="text-[12px] leading-none hover:underline uppercase tracking-widest font-bold"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--aura-chrome-bright)' }}
        >
          {t('loyalty.viewAll')}
        </Link>
      </div>

      {rewards.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-xl py-12 text-center"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--aura-bg-high) 40%, transparent)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <Sparkles className="h-8 w-8 mb-3" style={{ color: 'var(--aura-chrome-dim)' }} />
          <p className="text-[16px] leading-[1.5] font-normal" style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--aura-chrome-soft)' }}>
            {t('loyalty.noRewards')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px]">
          {rewards.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              onClaim={onClaimReward}
            />
          ))}
        </div>
      )}
    </section>
  );
}
