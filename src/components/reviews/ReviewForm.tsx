import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RatingStars } from '@/components/reviews/RatingStars';
import { Button } from '@/components/ui/button';
import { useSubmitReview } from '@/hooks/use-reviews';

interface ReviewFormProps {
  orderId: string;
  customerName?: string;
  onSubmit?: () => void;
}

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export function ReviewForm({ orderId, customerName, onSubmit }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [name, setName] = useState(customerName || '');
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const { t } = useTranslation();

  const submitMutation = useSubmitReview();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      setErrorMessage(t('reviews.selectRatingError'));
      return;
    }

    setFormState('submitting');
    setErrorMessage('');

    try {
      await submitMutation.mutateAsync({
        order_id: orderId,
        rating,
        comment: comment.trim() || undefined,
        customer_name: name.trim() || undefined,
      });

      setFormState('success');
      setRating(0);
      setComment('');
      onSubmit?.();
    } catch (err) {
      setFormState('error');
      setErrorMessage(err instanceof Error ? err.message : t('reviews.submitError'));
    }
  };

  if (formState === 'success') {
    return (
      <div className="rounded-xl border border-white/5 bg-white/5 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
          <svg className="h-6 w-6 text-green-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="font-display text-lg font-semibold text-chrome-bright">
          {t('reviews.thankYouTitle')}
        </p>
        <p className="mt-1 text-sm text-chrome-light/60">
          {t('reviews.thankYouDesc')}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-white/5 bg-white/5 p-6">
      <h3 className="mb-4 font-display text-lg font-semibold text-chrome-bright">
        {t('reviews.formTitle')}
      </h3>

      {/* Star selector */}
      <div className="mb-4">
        <label className="mb-2 block text-sm text-chrome-light/70">
          {t('reviews.serviceQuality')}
        </label>
        <RatingStars
          rating={rating}
          size="lg"
          interactive
          onChange={setRating}
        />
      </div>

      {/* Customer name */}
      <div className="mb-4">
        <label htmlFor="review-name" className="mb-1 block text-sm text-chrome-light/70">
          {t('reviews.yourName')}
        </label>
        <input
          id="review-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('reviews.namePlaceholder')}
          maxLength={100}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-chrome-bright placeholder:text-chrome-light/30 focus:border-chrome-light/30 focus:outline-none focus:ring-1 focus:ring-chrome-light/20"
        />
      </div>

      {/* Comment */}
      <div className="mb-4">
        <label htmlFor="review-comment" className="mb-1 flex items-center justify-between text-sm text-chrome-light/70">
          <span>{t('reviews.commentLabel')}</span>
          <span className="text-xs text-chrome-light/40">{comment.length}/500</span>
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 500))}
          placeholder={t('reviews.commentPlaceholder')}
          rows={3}
          maxLength={500}
          className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-chrome-bright placeholder:text-chrome-light/30 focus:border-chrome-light/30 focus:outline-none focus:ring-1 focus:ring-chrome-light/20"
        />
      </div>

      {/* Error */}
      {errorMessage && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
          <p className="text-sm text-red-400">{errorMessage}</p>
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        variant="primary"
        size="md"
        loading={formState === 'submitting'}
        disabled={rating === 0 || formState === 'submitting'}
        className="w-full"
      >
        {formState === 'submitting' ? t('reviews.submitting') : t('reviews.submitReview')}
      </Button>
    </form>
  );
}
