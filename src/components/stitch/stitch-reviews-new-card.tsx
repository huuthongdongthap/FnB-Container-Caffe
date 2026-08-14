/**
 * StitchReviewsNew — Individual review card
 *
 * Renders avatar, author name, star rating, quote text, image grid,
 * date, and like toggle. Highlighted cards get a bronze border and glow.
 */

import { useState, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { ReviewStars } from './stitch-reviews-new-rating';
import type { ReviewEntry } from './stitch-reviews-new-types';

export function ReviewCard({
  review,
  onToggleLike,
}: {
  review: ReviewEntry;
  onToggleLike?: (id: string, liked: boolean) => void;
}) {
  const [liked, setLiked] = useState(review.liked);
  const [likeCount, setLikeCount] = useState(review.likeCount);

  const handleLike = useCallback(() => {
    setLiked((prev) => {
      const next = !prev;
      setLikeCount((c) => (next ? c + 1 : c - 1));
      onToggleLike?.(review.id, next);
      return next;
    });
  }, [review.id, onToggleLike]);

  const cardClasses = review.isHighlighted
    ? 'glass-card bronze-glow rounded-xl flex flex-col gap-4 relative overflow-hidden group'
    : 'glass-card rounded-xl flex flex-col gap-4';

  return (
    <article
      className={cardClasses}
      style={{ padding: '32px' }}
      aria-label={`Review by ${review.author}, ${review.rating} out of 5 stars`}
    >
      {/* Badge (highlighted card only) */}
      {review.badge && (
        <div className="absolute right-0 top-0 p-3">
          <span
            className="rounded-full px-2 py-1 text-[10px] uppercase tracking-tighter font-bold"
            style={{
              backgroundColor: '#291500',
              color: 'var(--aura-chrome-bright)',
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
            }}
          >
            {review.badge}
          </span>
        </div>
      )}

      {/* Author + Avatar + Stars */}
      <div className="flex items-center gap-4">
        <div
          className="h-12 w-12 shrink-0 overflow-hidden rounded-full border"
          style={{ borderColor: 'rgba(68, 71, 77, 0.3)' }}
        >
          <img
            className="h-full w-full object-cover"
            src={review.avatarUrl}
            alt={review.avatarAlt}
            loading="lazy"
          />
        </div>
        <div>
          <h3
            className="text-lg font-semibold"
            style={{ fontFamily: "'EB Garamond', Georgia, serif", color: 'var(--aura-noir-void)' }}
          >
            {review.author}
          </h3>
          <ReviewStars rating={review.rating} sm />
        </div>
      </div>

      {/* Quote Content */}
      <p
        className="leading-relaxed"
        style={{
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          fontSize: '16px',
          lineHeight: '1.6',
          fontWeight: 400,
          color: review.isHighlighted ? '#d3e4ff' : 'var(--aura-chrome-soft)',
        }}
      >
        &ldquo;{review.content}&rdquo;
      </p>

      {/* Images Grid */}
      {review.images && review.images.length > 0 && (
        <div className={`grid gap-2 mt-2 ${review.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {review.images.map((img, idx) => (
            <div
              key={idx}
              className="overflow-hidden rounded-lg glass-card"
              style={review.images!.length === 1 ? { height: '160px' } : { height: '128px' }}
            >
              <img
                className="review-photo w-full h-full object-cover"
                src={img.url}
                alt={img.alt}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      {/* Footer: Date + Like */}
      <div
        className="mt-auto flex items-center justify-between pt-4 border-t"
        style={{ borderColor: 'rgba(68, 71, 77, 0.1)' }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-widest"
          style={{
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            lineHeight: '1.0',
            letterSpacing: '0.1em',
            color: 'var(--aura-chrome-soft)',
          }}
        >
          {review.date}
        </span>
        <button
          type="button"
          onClick={handleLike}
          className={`flex items-center gap-1 transition-colors ${
            liked
              ? 'text-[var(--aura-error)]'
              : 'text-[var(--aura-chrome-soft)] hover:text-[var(--aura-error)]'
          }`}
          aria-label={liked ? 'Unlike this review' : 'Like this review'}
          aria-pressed={liked}
        >
          <Heart className="text-lg" fill={liked ? 'currentColor' : 'none'} />
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              lineHeight: '1.0',
              letterSpacing: '0.1em',
            }}
          >
            {likeCount}
          </span>
        </button>
      </div>
    </article>
  );
}
