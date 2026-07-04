import { RatingStars } from '@/components/reviews/RatingStars';
import type { ReviewRecord } from '@/hooks/use-reviews';
import { useTranslation } from 'react-i18next';

interface ReviewCardProps {
  review: ReviewRecord;
}

function getInitial(name: string): string {
  return (name || 'A').charAt(0).toUpperCase();
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

const AVATAR_COLORS = [
  'bg-amber-500/20 text-amber-400',
  'bg-blue-500/20 text-blue-400',
  'bg-green-500/20 text-green-400',
  'bg-purple-500/20 text-purple-400',
  'bg-rose-500/20 text-rose-400',
  'bg-cyan-500/20 text-cyan-400',
];

function getAvatarColor(name: string): string {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!;
}

export function ReviewCard({ review }: ReviewCardProps) {
  const { t } = useTranslation();
  const displayName = review.customer_name || t('reviews.defaultName');

  return (
    <div className="glass-panel p-4 hover:bg-white/[0.07] hover:border-white/[0.07] [&:hover]:scale-100">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className={`
            flex h-10 w-10 shrink-0 items-center justify-center rounded-full
            text-sm font-semibold ${getAvatarColor(displayName)}
          `}
          aria-hidden="true"
        >
          {getInitial(displayName)}
        </div>

        <div className="min-w-0 flex-1">
          {/* Name + date */}
          <div className="flex flex-wrap items-center justify-between gap-1">
            <p className="font-display text-sm font-semibold text-chrome-bright truncate">
              {displayName}
            </p>
            <time className="text-xs text-chrome-light/40 shrink-0" dateTime={review.created_at}>
              {formatDate(review.created_at)}
            </time>
          </div>

          {/* Stars */}
          <div className="mt-1">
            <RatingStars rating={review.rating} size="sm" />
          </div>

          {/* Comment */}
          {review.comment && (
            <p className="mt-2 text-sm leading-relaxed text-chrome-light/70">
              {review.comment}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
