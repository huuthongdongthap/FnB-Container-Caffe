/**
 * TrackOrderPage — Real-time order tracking page for AURA CAFE
 * Subscribes to SSE via useOrderStore; falls back to demo data without ?id=
 */
'use client';

import { useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { StitchTrackOrderNew } from '@/components/stitch/StitchTrackOrderNew';
import { useOrderStoreWithOfflineFlush } from '@/hooks/stores/use-order-store';

const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 min

export default function TrackOrderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('id');

  const { currentOrder, fetchOrder, subscribeToOrder, unsubscribeFromOrder } =
    useOrderStoreWithOfflineFlush();

  // Subscribe to SSE for real-time updates; unsubscribe on leave/timeout
  useEffect(() => {
    if (!orderId) return;

    fetchOrder(orderId);
    subscribeToOrder(orderId);

    const timeout = setTimeout(() => {
      unsubscribeFromOrder();
    }, POLL_TIMEOUT_MS);

    return () => {
      clearTimeout(timeout);
      unsubscribeFromOrder();
    };
  }, [orderId, fetchOrder, subscribeToOrder, unsubscribeFromOrder]);

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

  const trackOrderItems = currentOrder?.items?.map((item) => ({
    id: String(item.id),
    name: item.name,
    quantity: item.quantity,
    price: item.price,
  })) ?? [];

  return (
    <StitchTrackOrderNew
      orderId={currentOrder?.id || orderId || undefined}
      estimatedMinutes={currentOrder ? 8 : undefined}
      items={trackOrderItems.length ? trackOrderItems : undefined}
      total={currentOrder?.total}
      status={currentOrder?.status}
      onTrackMap={handleTrackMap}
      onBack={handleBack}
      onNavigate={handleNavigate}
    />
  );
}
