import type { Review } from './review-types';
import { StarRating } from './star-rating';
import { HeartButton } from './heart-button';

export function ReviewCard({
  review,
  isFeatured,
}: {
  review: Review;
  isFeatured: boolean;
}) {
  const hasPhotos = review.photos && review.photos.length > 0;

  return (
    <div
      className={`rounded-2xl p-6 md:p-8 flex flex-col gap-4 transition-all duration-300 relative overflow-hidden group ${
        isFeatured
          ? 'bg-white/5 backdrop-blur-xl border border-[var(--aura-tertiary)]/30 shadow-[inset_0_0_10px_rgba(212,165,116,0.1)]'
          : 'bg-white/5 backdrop-blur-xl border border-white/10 hover:border-[var(--aura-chrome-mid)]/20'
      }`}
    >
      {isFeatured && (
        <div className="absolute top-3 right-3">
          <span className="bg-[#291500] text-[var(--aura-tertiary)] font-body text-[10px] px-2 py-1 rounded-full uppercase tracking-tighter">
            Chef&apos;s Choice
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full overflow-hidden border border-[var(--aura-chrome-dark)]/30 shrink-0">
          <div className="w-full h-full bg-[var(--aura-noir-deep)] flex items-center justify-center">
            <span className="font-body text-sm text-[var(--aura-chrome-bright)]">{review.initials}</span>
          </div>
        </div>
        <div>
          <h3 className="font-display text-lg text-[var(--aura-chrome-bright)]">{review.name}</h3>
          <StarRating rating={review.rating} />
        </div>
      </div>

      {/* Text */}
      <p className="font-body text-[var(--aura-chrome-mid)] leading-relaxed text-sm md:text-base">{review.text}</p>

      {/* Photos */}
      {hasPhotos && (
        <div
          className={`grid gap-2 mt-2 ${review.photos!.length >= 2 ? 'grid-cols-2' : ''}`}
        >
          {review.photos!.map((src, i) => (
            <div key={i} className="h-32 md:h-36 rounded-lg overflow-hidden bg-white/5 backdrop-blur-xl">
              <img
                src={src}
                alt={`${review.name} review photo ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center mt-auto pt-4 border-t border-white/5">
        <span className="font-body text-xs text-[var(--aura-chrome-dark)]/60 uppercase tracking-widest">
          {review.date}
        </span>
        <HeartButton likes={review.likes} />
      </div>
    </div>
  );
}
