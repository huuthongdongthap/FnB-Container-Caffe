import { useState, useEffect, useCallback } from 'react';
import { useOrderStoreWithOfflineFlush } from '@/hooks/stores/use-order-store';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { TrackOrderSearchCard } from '@/components/tracking/track-order-search-card';
import { TrackOrderLoadingCard } from '@/components/tracking/track-order-loading-card';
import { TrackOrderErrorCard } from '@/components/tracking/track-order-error-card';
import { TrackOrderStatusCard } from '@/components/tracking/track-order-status-card';
import { TrackOrderEmptyCard } from '@/components/tracking/track-order-empty-card';
import { getStatusTime } from '@/components/tracking/track-order-types';
import type { StatusStep } from '@/components/tracking/track-order-types';

export default function TrackOrderPage() {
  const { t } = useTranslation('trackOrder');
  const [orderId, setOrderId] = useState('');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const order = useOrderStoreWithOfflineFlush((s) => s.currentOrder);
  const loading = useOrderStoreWithOfflineFlush((s) => s.loading);
  const error = useOrderStoreWithOfflineFlush((s) => s.error);
  const fetchOrder = useOrderStoreWithOfflineFlush((s) => s.fetchOrder);
  const startPolling = useOrderStoreWithOfflineFlush((s) => s.startPolling);
  const stopPolling = useOrderStoreWithOfflineFlush((s) => s.stopPolling);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleTrack = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const id = orderId.trim();
    if (!id) return;
    setActiveOrderId(id);
    fetchOrder(id).then(() => startPolling(id));
  }, [orderId, fetchOrder, startPolling]);

  const handleRetry = useCallback(() => {
    setActiveOrderId(null);
    setOrderId('');
    stopPolling();
  }, [stopPolling]);

  const buildTimelineSteps = (): StatusStep[] => {
    if (!order) return [];
    const statusSteps = [
      { status: 'confirmed', label: t('confirmed') },
      { status: 'preparing', label: t('preparing') },
      { status: 'ready', label: t('ready') },
      { status: 'delivering', label: t('delivering') },
      { status: 'delivered', label: t('delivered') },
    ];
    return statusSteps.map((step) => ({
      ...step,
      time: getStatusTime(order, step.status),
    }));
  };

  return (
    <>
      <HelmetHead
        title={t('seoTitle', 'Track Order - AURA CAFE Sa Dec')}
        description={t('seoDescription', 'Track your order status at AURA CAFE Sa Dec. Real-time updates on delivery and preparation.')}
        canonical="/track-order"
      />
      <div className="min-h-screen bg-[color:var(--aura-noir-deep)] py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold mb-2">{t('title')}</h1>
            <p className="text-[color:var(--aura-chrome-bright)] text-sm">{t('subtitle')}</p>
          </div>

          <TrackOrderSearchCard
            orderId={orderId}
            loading={loading}
            onOrderIdChange={setOrderId}
            onSubmit={handleTrack}
          />

          {loading && activeOrderId && !order && <TrackOrderLoadingCard />}
          {error && activeOrderId && !order && <TrackOrderErrorCard error={error} onRetry={handleRetry} />}
          {order && !error && activeOrderId && <TrackOrderStatusCard order={order} steps={buildTimelineSteps()} />}
          {!activeOrderId && <TrackOrderEmptyCard />}
        </div>
      </div>
    </>
  );
}
