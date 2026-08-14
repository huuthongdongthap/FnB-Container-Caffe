import { useTranslation, Trans } from 'react-i18next';
import { Award, MapPin } from 'lucide-react';
import type { LoyaltyStreakDay } from './stitch-loyalty-types';

export function WeeklyStreak({
  days,
  streakCount,
  onCheckIn,
}: {
  days: LoyaltyStreakDay[];
  streakCount: number;
  onCheckIn?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <section
      className="rounded-xl p-[24px]"
      aria-label={t('loyalty.weeklyStreakAria')}
      data-glass="card"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--aura-bg-high) 40%, transparent)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <h3
        className="mb-[24px] text-[24px] leading-[1.4] font-normal"
        style={{ fontFamily: "'Libre Caslon Text', serif", color: 'var(--aura-chrome-bright)' }}
      >
        {t('loyalty.weeklyStreak')}
      </h3>
      <div className="flex justify-between items-center gap-2">
        {days.map((day) => (
          <div key={day.label} className="flex flex-col items-center gap-2">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                border: day.checked
                  ? '1px solid var(--aura-chrome-bright)'
                  : '1px solid color-mix(in srgb, var(--aura-chrome-soft) 20%, transparent)',
                backgroundColor: day.checked
                  ? 'color-mix(in srgb, var(--aura-chrome-bright) 10%, transparent)'
                  : 'transparent',
                color: day.checked ? 'var(--aura-chrome-bright)' : 'color-mix(in srgb, var(--aura-chrome-soft) 30%, transparent)',
              }}
            >
              <Award
                className="h-5 w-5"
                style={{ fill: day.checked ? 'var(--aura-chrome-bright)' : 'none' }}
              />
            </div>
            <span
              className="text-[10px] font-bold"
              style={{
                color: day.checked ? 'var(--aura-chrome-bright)' : 'var(--aura-chrome-soft)',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {day.label}
            </span>
          </div>
        ))}
      </div>
      <p
        className="mt-[24px] text-[16px] leading-relaxed font-normal"
        style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--aura-chrome-soft)' }}
      >
        <Trans
          i18nKey="loyalty.streakDescription"
          values={{ count: streakCount }}
          components={{ strong: <strong style={{ color: 'var(--aura-chrome-bright)' }} /> }}
        />
      </p>
      <button
        type="button"
        onClick={onCheckIn}
        className="mt-4 w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          backgroundColor: 'var(--aura-surface-container)',
          border: '1px solid color-mix(in srgb, var(--aura-chrome-soft) 20%, transparent)',
          color: 'var(--aura-chrome-bright)',
          fontSize: '16px',
          lineHeight: '1.5',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--aura-chrome-bright) 40%, transparent)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--aura-chrome-soft) 20%, transparent)';
        }}
        aria-label={t('loyalty.checkinAria')}
      >
        <MapPin className="h-[20px] w-[20px]" />
        {t('loyalty.checkinRoastery')}
      </button>
    </section>
  );
}
