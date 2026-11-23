/**
 * TrackOrderPage — Real-time order tracking page for AURA CAFE
 * Subscribes to SSE via useOrderStore; falls back to demo data without ?id=
 */
'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { StitchTrackOrderNew } from '@/components/stitch/StitchTrackOrderNew';
import { TopBar } from '@/components/stitch/StitchTrackOrderNew-top-bar';
import { TrackOrderEmptyCard } from '@/components/tracking/track-order-empty-card';
import { TrackOrderLoadingCard } from '@/components/tracking/track-order-loading-card';
import { TrackOrderErrorCard } from '@/components/tracking/track-order-error-card';
import { useOrderObservation } from '@/hooks/use-order-observation';

const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 min

const TERMINAL_OR_READY_STATUSES = new Set([
  'ready',
  'served',
  'delivered',
  'completed',
  'cancelled',
  'failed',
  'expired',
]);

function OrderLookupForm({
  initialValue = '',
  onLookup,
}: {
  initialValue?: string;
  onLookup: (orderId: string) => void;
}) {
  const { t } = useTranslation();
  const [inputId, setInputId] = useState(initialValue);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleaned = inputId.trim();
    if (!cleaned) return;
    onLookup(cleaned);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-xl border border-white/10 bg-white/5 p-5 space-y-3"
    >
      <label
        htmlFor="track-order-id-input"
        className="block text-sm font-semibold text-white"
      >
        {t('trackOrder.title', 'Theo Dõi Đơn Hàng')}
      </label>
      <p className="text-xs text-[var(--aura-chrome-soft,#9fb0c2)]">
        {t('trackOrder.helper', 'Nhập mã đơn từ email xác nhận hoặc tin nhắn Zalo')}
      </p>
      <div className="flex gap-2">
        <input
          id="track-order-id-input"
          type="text"
          value={inputId}
          onChange={(e) => setInputId(e.target.value)}
          placeholder={t('trackOrder.placeholder', 'Nhập mã đơn hàng (VD: ORD-001)')}
          className="flex-1 rounded-lg border border-white/15 bg-black/25 px-3.5 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[var(--aura-bronze-shimmer,#d4a574)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!inputId.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--aura-bronze-shimmer,#d4a574)] px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          {t('trackOrder.searchButton', 'Tra cứu đơn hàng')}
        </button>
      </div>
    </form>
  );
}

export default function TrackOrderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('id') || searchParams.get('order_id');
  const queryOrderToken = searchParams.get('order_token');

  const { matchedOrder, loading, error, refresh } = useOrderObservation(orderId, {
    timeoutMs: POLL_TIMEOUT_MS,
    orderToken: queryOrderToken,
  });

  const handleLookup = useCallback(
    (nextOrderId: string) => {
      navigate(`/track-order?id=${encodeURIComponent(nextOrderId)}`);
    },
    [navigate],
  );

  const handleSearchAnother = useCallback(() => {
    navigate('/track-order');
  }, [navigate]);

  const handleBack = useCallback(() => {
    navigate('/menu');
  }, [navigate]);

  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate]
  );

  if (!orderId) {
    return (
      <div className="min-h-screen bg-[var(--aura-bg-page,var(--aura-bg-surface))] font-body text-[var(--aura-text-primary,#e2e2e2)]">
        <TopBar onBack={handleBack} />
        <main className="mx-auto max-w-lg px-4 pt-24 pb-16">
          <OrderLookupForm onLookup={handleLookup} />
          <TrackOrderEmptyCard />
        </main>
      </div>
    );
  }

  if (!matchedOrder && error) {
    return (
      <div className="min-h-screen bg-[var(--aura-bg-page,var(--aura-bg-surface))] font-body text-[var(--aura-text-primary,#e2e2e2)]">
        <TopBar onBack={handleBack} />
        <main className="mx-auto max-w-lg px-4 pt-24 pb-16">
          <OrderLookupForm initialValue={orderId} onLookup={handleLookup} />
          <TrackOrderErrorCard error={error} onRetry={refresh} />
        </main>
      </div>
    );
  }

  if (!matchedOrder) {
    return (
      <div className="min-h-screen bg-[var(--aura-bg-page,var(--aura-bg-surface))] font-body text-[var(--aura-text-primary,#e2e2e2)]">
        <TopBar onBack={handleBack} />
        <main className="mx-auto max-w-lg px-4 pt-24 pb-16">
          {loading ? <TrackOrderLoadingCard /> : <OrderLookupForm initialValue={orderId} onLookup={handleLookup} />}
        </main>
      </div>
    );
  }

  const trackOrderItems = (matchedOrder.items ?? []).map((item, index) => ({
    id: `${matchedOrder.id}-${index}`,
    name: item.name,
    quantity: item.quantity,
    price: item.unitPriceCents,
  }));

  const normalizedStatus = (matchedOrder.status ?? '').trim().toLowerCase();
  const estimatedMinutes = TERMINAL_OR_READY_STATUSES.has(normalizedStatus)
    ? null
    : (matchedOrder.estimatedMinutes ?? 8);

  return (
    <StitchTrackOrderNew
      orderId={matchedOrder.orderNumber || matchedOrder.id}
      estimatedMinutes={estimatedMinutes}
      items={trackOrderItems}
      total={matchedOrder.totalAmount}
      status={matchedOrder.status}
      orderType={matchedOrder.channel}
      onSearchAnother={handleSearchAnother}
      onBack={handleBack}
      onNavigate={handleNavigate}
    />
  );
}
