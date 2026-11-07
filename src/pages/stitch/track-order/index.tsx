/**
 * TrackOrderPage — Real-time order tracking page for AURA CAFE
 * Subscribes to SSE via useOrderStore; falls back to demo data without ?id=
 */
'use client';

import { useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { StitchTrackOrderNew } from '@/components/stitch/StitchTrackOrderNew';
import { TopBar } from '@/components/stitch/StitchTrackOrderNew-top-bar';
import { TrackOrderEmptyCard } from '@/components/tracking/track-order-empty-card';
import { TrackOrderLoadingCard } from '@/components/tracking/track-order-loading-card';
import { TrackOrderErrorCard } from '@/components/tracking/track-order-error-card';
import { useOrderObservation } from '@/hooks/use-order-observation';

const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 min

export default function TrackOrderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('id') || searchParams.get('order_id');

  const { matchedOrder, loading, error, refresh } = useOrderObservation(orderId, {
    timeoutMs: POLL_TIMEOUT_MS,
  });

  const handleTrackMap = useCallback(() => {
    // Map tracking not implemented yet — kept as no-op for the CTA button
  }, []);

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
          {loading ? <TrackOrderLoadingCard /> : <TrackOrderEmptyCard />}
        </main>
      </div>
    );
  }

  const trackOrderItems = (matchedOrder.items ?? []).map((item, index) => ({
    id: `${matchedOrder.id}-${index}`,
    name: item.name,
    quantity: item.quantity,
    price: item.unitPriceCents >= 1000 ? item.unitPriceCents : item.unitPriceCents / 100,
  }));

  const resolvedTotal =
    matchedOrder.totalAmount >= 1000
      ? matchedOrder.totalAmount
      : matchedOrder.totalAmount / 100;

  return (
    <StitchTrackOrderNew
      orderId={matchedOrder.orderNumber || matchedOrder.id}
      estimatedMinutes={matchedOrder.estimatedMinutes ?? 8}
      items={trackOrderItems}
      total={resolvedTotal}
      status={matchedOrder.status}
      onTrackMap={handleTrackMap}
      onBack={handleBack}
      onNavigate={handleNavigate}
    />
  );
}
