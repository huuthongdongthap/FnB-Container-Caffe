import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, PenLine, Loader2, X } from 'lucide-react';

interface WriteReviewFormProps {
  onSubmit: (data: { customer_name: string; rating: number; comment: string }) => void;
  onClose: () => void;
  isSubmitting: boolean;
  error: string | null;
}

export function WriteReviewForm({
  onSubmit,
  onClose,
  isSubmitting,
  error,
}: Readonly<WriteReviewFormProps>) {
  const { t } = useTranslation('reviews');
  const [customerName, setCustomerName] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoverRating, setHoverRating] = useState(0);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;
    onSubmit({ customer_name: customerName, rating, comment });
  };

  const canSubmit = rating > 0 && !isSubmitting;

  return (
    <div
      className="mb-8 overflow-hidden rounded-xl p-6 md:p-8"
      style={{
        background: 'rgba(11, 32, 56, 0.6)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(212, 165, 116, 0.25)',
      }}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full p-1 transition-colors hover:bg-white/10"
        aria-label={t('closeForm')}
      >
        <X className="h-5 w-5" style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }} />
      </button>

      <h3
        className="mb-6 text-2xl"
        style={{
          fontFamily: 'var(--aura-font-display, "EB Garamond", Georgia, serif)',
          color: 'var(--aura-text-primary, #e8e8e8)',
        }}
      >
        {t('shareExperience')}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Customer name */}
        <div>
          <label
            className="mb-2 block text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
          >
            {t('yourName')}
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder={t('enterName')}
            required
            className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all focus:ring-2"
            style={{
              backgroundColor: 'var(--aura-bg-input, rgba(255,255,255,0.05))',
              color: 'var(--aura-text-primary, #e8e8e8)',
              border: '1px solid var(--aura-border-card, rgba(255,255,255,0.08))',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--aura-border-focus, rgba(198,198,199,0.5))';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--aura-border-card, rgba(255,255,255,0.08))';
            }}
          />
        </div>

        {/* Rating */}
        <div>
          <label
            className="mb-2 block text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
          >
            {t('rating')}
          </label>
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, idx) => {
              const starValue = idx + 1;
              const isFilled = starValue <= (hoverRating || rating);
              return (
                <button
                  key={idx}
                  type="button"
                  onMouseEnter={() => setHoverRating(starValue)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(starValue)}
                  className="transition-transform hover:scale-110"
                  aria-label={t('rateStars', { count: starValue })}
                >
                  <Star
                    className="h-6 w-6"
                    style={{
                      fill: isFilled ? 'var(--aura-tertiary, #d4a574)' : 'transparent',
                      color: isFilled
                        ? 'var(--aura-tertiary, #d4a574)'
                        : 'var(--aura-outline, #8e9097)',
                      transition: 'fill 0.15s ease, color 0.15s ease',
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Comment */}
        <div>
          <label
            className="mb-2 block text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
          >
            {t('commentOptional')}
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('commentPlaceholder')}
            rows={3}
            maxLength={500}
            className="w-full resize-none rounded-lg px-4 py-3 text-sm outline-none transition-all focus:ring-2"
            style={{
              backgroundColor: 'var(--aura-bg-input, rgba(255,255,255,0.05))',
              color: 'var(--aura-text-primary, #e8e8e8)',
              border: '1px solid var(--aura-border-card, rgba(255,255,255,0.08))',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--aura-border-focus, rgba(198,198,199,0.5))';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--aura-border-card, rgba(255,255,255,0.08))';
            }}
          />
          <p
            className="mt-1 text-right text-xs"
            style={{ color: 'var(--aura-text-disabled, #5a6270)' }}
          >
            {comment.length}/500
          </p>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm" style={{ color: 'var(--aura-error, #ffb4ab)' }}>
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-bold uppercase tracking-widest transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: canSubmit
              ? 'linear-gradient(135deg, #c6c6c7 0%, #e3e2e3 50%, #8e9097 100%)'
              : 'var(--aura-bg-elevated, #162a3d)',
            color: canSubmit
              ? 'var(--aura-on-primary, #1a1a2e)'
              : 'var(--aura-text-disabled, #5a6270)',
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('submitting')}
            </>
          ) : (
            <>
              <PenLine className="h-4 w-4" />
              {t('submitReview')}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
