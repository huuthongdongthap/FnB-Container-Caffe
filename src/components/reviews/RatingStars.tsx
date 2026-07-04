import { cn } from '@/lib/cn';
import { useTranslation } from 'react-i18next';

const FILLED_COLOR = '#f59e0b';
const EMPTY_COLOR = '#374151';

const sizeMap = {
  sm: { star: 14, container: 'gap-0.5' },
  md: { star: 20, container: 'gap-1' },
  lg: { star: 28, container: 'gap-1.5' },
} as const;

interface RatingStarsProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

function StarIcon({ size, fill }: { size: number; fill: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

export function RatingStars({
  rating,
  size = 'md',
  interactive = false,
  onChange,
}: RatingStarsProps) {
  const { star: starSize, container: containerGap } = sizeMap[size];
  const clampedRating = Math.max(0, Math.min(5, rating));
  const { t } = useTranslation();

  if (interactive && !onChange) {
    throw new Error('RatingStars: onChange is required when interactive=true');
  }

  return (
    <div
      className={cn('inline-flex items-center', containerGap)}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={interactive ? undefined : t('reviews.ratingAriaLabel', { count: clampedRating })}
    >
      {Array.from({ length: 5 }).map((_, idx) => {
        const starValue = idx + 1;
        const filled = starValue <= clampedRating;

        if (interactive) {
          return (
            <button
              key={idx}
              type="button"
              role="radio"
              aria-checked={starValue === Math.round(clampedRating)}
              aria-label={t('reviews.starAriaLabel', { count: starValue })}
              className="cursor-pointer transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-light/50 rounded-sm"
              onClick={() => onChange?.(starValue)}
            >
              <StarIcon size={starSize} fill={filled ? FILLED_COLOR : EMPTY_COLOR} />
            </button>
          );
        }

        return <StarIcon key={idx} size={starSize} fill={filled ? FILLED_COLOR : EMPTY_COLOR} />;
      })}
    </div>
  );
}
