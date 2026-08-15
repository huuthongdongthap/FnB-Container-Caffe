'use client';

import { useTranslation } from 'react-i18next';
import type { ReferralFriendEntry } from './StitchReferralNew1-types';

export function FriendNetwork({
  friends,
  onViewProfile,
}: {
  friends: ReferralFriendEntry[];
  onViewProfile?: (friendId: string) => void;
}) {
  const { t } = useTranslation();

  if (friends.length === 0) {
    return (
      <section className="mb-10" aria-label={t('stitch.referral.networkTitle')}>
        <h3 className="font-body text-[14px] leading-[1.2] font-semibold tracking-[0.05em] text-[var(--aura-chrome-soft)] uppercase tracking-widest mb-6 border-l-2 border-[var(--aura-chrome-bright)] pl-3">
          {t('stitch.referral.networkTitle', { defaultValue: 'Recent Network' })}
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="font-body text-base text-[var(--aura-chrome-soft)]">
            {t('stitch.referral.friendsEmpty', { defaultValue: 'No friends yet. Share your code!' })}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-10" aria-label={t('stitch.referral.networkTitle')}>
      <h3 className="font-body text-[14px] leading-[1.2] font-semibold tracking-[0.05em] text-[var(--aura-chrome-soft)] uppercase tracking-widest mb-6 border-l-2 border-[var(--aura-chrome-bright)] pl-3">
        {t('stitch.referral.networkTitle', { defaultValue: 'Recent Network' })}
      </h3>
      <div className="space-y-3">
        {friends.map((friend) => (
          <div
            key={friend.id}
            className="p-3 rounded-xl flex items-center justify-between"
            style={{
              background: 'color-mix(in srgb, var(--aura-surface-container) 40%, transparent)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div
              className="flex items-center gap-3 flex-1 cursor-pointer"
              onClick={() => onViewProfile?.(friend.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onViewProfile?.(friend.id);
                }
              }}
            >
              <div className="w-10 h-10 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <img
                  className="w-full h-full object-cover"
                  src={friend.avatarUrl}
                  alt={friend.avatarAlt}
                  loading="lazy"
                />
              </div>
              <div>
                <p className="font-body text-base leading-[1.5] font-medium text-[#d9e3f6]">
                  {friend.name}
                </p>
                <p className="font-body text-[12px] leading-[1.2] font-medium text-[var(--aura-chrome-soft)] opacity-50">
                  {t('stitch.referral.joinedAt', { defaultValue: `Joined ${friend.joinedDate}`, date: friend.joinedDate })}
                </p>
              </div>
            </div>
            <span
              className="font-body text-[12px] leading-[1.2] font-medium py-1 px-3 rounded-full"
              style={
                friend.status === 'active'
                  ? {
                      backgroundColor: 'color-mix(in srgb, var(--aura-chrome-bright) 10%, transparent)',
                      color: 'var(--aura-chrome-bright)',
                      border: '1px solid color-mix(in srgb, var(--aura-chrome-bright) 20%, transparent)',
                      boxShadow: '0 0 20px color-mix(in srgb, var(--aura-chrome-bright) 15%, transparent)',
                    }
                  : {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--aura-chrome-soft)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }
              }
            >
              {friend.status === 'active'
                ? t('stitch.referral.statusActive', { defaultValue: 'Active' })
                : t('stitch.referral.statusJoined', { defaultValue: 'Joined' })
              }
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
