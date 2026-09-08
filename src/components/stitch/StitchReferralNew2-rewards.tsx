/**
 * Friend network list displaying referred friends with their
 * status (active/joined) and avatar.
 */

import { useTranslation } from 'react-i18next';
import { BODY_FONT } from './StitchReferralNew2-constants';
import type { ReferralFriendEntry } from './StitchReferralNew2-types';

export function FriendNetwork({
  friends,
}: {
  friends: ReferralFriendEntry[];
}) {
  const { t } = useTranslation();

  if (friends.length === 0) {
    return (
      <section className="mb-8" aria-label={t('stitch.referral.networkTitle')}>
        <h3 className={`mb-4 ${BODY_FONT} text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-secondary, #a0a8b0)]`}>
          {t('stitch.referral.networkTitle')}
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className={`${BODY_FONT} text-base text-[var(--aura-text-secondary, #a0a8b0)]`}>
            {t('stitch.referral.friendsEmpty')}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="mb-8"
      aria-label={t('stitch.referral.networkTitle')}
    >
      <h3 className={`mb-6 ${BODY_FONT} text-xs font-semibold uppercase tracking-widest text-[var(--aura-text-secondary, #a0a8b0)]`}>
        {t('stitch.referral.networkTitle')}
      </h3>
      <div className="space-y-4">
        {friends.map((friend) => (
          <div
            key={friend.id}
            className="flex items-center justify-between rounded-xl bg-[#162a44]/60 p-4 backdrop-blur-[8px] transition-all hover:border-[var(--aura-tertiary,#C9D6DF)]/30"
            style={{ border: '1px solid rgba(var(--aura-glass-bg),0.1)' }}
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 shrink-0 overflow-hidden bg-[var(--aura-noir-deep,#0A1A2E)]"
                style={{ borderRadius: '2px' }}
              >
                <img
                  className="h-full w-full object-cover transition-all duration-500 grayscale hover:grayscale-0"
                  src={friend.avatarUrl}
                  alt={friend.avatarAlt}
                  loading="lazy"
                />
              </div>
              <div>
                <p className={`${BODY_FONT} text-base font-medium text-[var(--aura-text-primary, #e8e8e8)]`}>
                  {friend.name}
                </p>
                <p className={`${BODY_FONT} text-xs text-[var(--aura-text-secondary, #a0a8b0)] opacity-60`}>
                  {t('stitch.referral.joinedAt', { date: friend.joinedDate })}
                </p>
              </div>
            </div>
            <span
              className={`shrink-0 rounded px-3 py-1 ${BODY_FONT} text-[10px] font-semibold uppercase tracking-widest ${
                friend.status === 'active'
                  ? 'border border-[var(--aura-tertiary,#C9D6DF)]/20 bg-[var(--aura-chrome-light,#C9D6DF)]/10 text-[var(--aura-chrome-light,#C9D6DF)]'
                  : 'border border-white/[0.1] bg-[var(--aura-noir-deep,#0A1A2E)] text-[var(--aura-text-secondary, #a0a8b0)]'
              }`}
              aria-label={
                friend.status === 'active'
                  ? t('stitch.referral.statusActive')
                  : t('stitch.referral.statusJoined')
              }
            >
              {friend.status === 'active'
                ? t('stitch.referral.statusActive')
                : t('stitch.referral.statusJoined')}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
