/**
 * OrderTimeline — vertical progress timeline driven by live order status
 */

import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { TimelineStep } from './StitchTrackOrderNew-timeline-step';

export interface OrderTimelineProps {
  /** Live order status; undefined renders the static demo timeline */
  status?: string;
  /** Order fulfillment type ('delivery' | 'dine_in' | 'takeaway' | ...) */
  orderType?: string;
}

const DELIVERY_FLOW = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'delivering',
  'delivered',
  'completed',
] as const;

const DINE_IN_FLOW = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'served',
  'completed',
] as const;

type TimelineStepKey =
  | (typeof DELIVERY_FLOW)[number]
  | (typeof DINE_IN_FLOW)[number];

const STATUS_META: Record<TimelineStepKey, { key: string; fallback: string }> = {
  pending: { key: 'trackOrder.stepPending', fallback: 'Đã tiếp nhận đơn' },
  confirmed: { key: 'trackOrder.stepConfirmed', fallback: 'Đã xác nhận' },
  preparing: { key: 'trackOrder.stepPreparing', fallback: 'Đang pha chế' },
  ready: { key: 'trackOrder.stepReady', fallback: 'Sẵn sàng nhận món' },
  delivering: { key: 'trackOrder.stepDelivering', fallback: 'Đang giao hàng' },
  served: { key: 'trackOrder.stepServed', fallback: 'Đã phục vụ' },
  delivered: { key: 'trackOrder.stepDelivered', fallback: 'Đã giao thành công' },
  completed: { key: 'trackOrder.stepCompleted', fallback: 'Hoàn tất' },
};

const TERMINAL_ERROR_STATUSES: Record<string, { titleKey: string; titleFallback: string }> = {
  cancelled: { titleKey: 'trackOrder.cancelledTitle', titleFallback: 'Đơn hàng đã bị hủy' },
  failed: { titleKey: 'trackOrder.failedTitle', titleFallback: 'Đơn hàng thất bại' },
  expired: { titleKey: 'trackOrder.expiredTitle', titleFallback: 'Đơn hàng đã hết hạn' },
};

export function OrderTimeline({ status, orderType }: OrderTimelineProps) {
  const { t } = useTranslation();
  const normalized = status?.trim().toLowerCase();

  if (normalized && normalized in TERMINAL_ERROR_STATUSES) {
    const meta = TERMINAL_ERROR_STATUSES[normalized]!;
    return (
      <section
        role="alert"
        className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-red-200"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 shrink-0 text-red-400" aria-hidden="true" />
          <div>
            <h3 className="font-display text-lg font-bold text-red-200">
              {t(meta.titleKey, meta.titleFallback)}
            </h3>
            <p className="mt-1 font-body text-sm text-red-200/80">
              {t('trackOrder.cancelledDesc', 'Đơn hàng này không còn được xử lý. Vui lòng liên hệ quầy nếu cần hỗ trợ.')}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const isDelivery =
    orderType?.trim().toLowerCase() === 'delivery' ||
    normalized === 'delivering' ||
    normalized === 'delivered';
  const flow: readonly TimelineStepKey[] = isDelivery ? DELIVERY_FLOW : DINE_IN_FLOW;
  const currentIndex = normalized ? flow.indexOf(normalized as TimelineStepKey) : -1;

  return (
    <section className="py-4 relative">
      {/* Connecting line */}
      <div
        className="absolute left-[21px] top-0 bottom-0 w-px"
        style={{ background: 'rgba(var(--aura-chrome-light), 0.1)' }}
      />

      <div className="space-y-12">
        {flow.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isActive = index === currentIndex;
          const meta = STATUS_META[step];
          return (
            <TimelineStep
              key={step}
              label={t(meta.key, meta.fallback)}
              time={isActive ? t('trackOrder.inProgress', 'ĐANG THỰC HIỆN') : undefined}
              isActive={isActive}
              isCompleted={isCompleted}
              isLast={index === flow.length - 1}
            />
          );
        })}
      </div>
    </section>
  );
}
