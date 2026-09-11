/**
 * OrderTimeline — vertical progress timeline driven by live order status
 */

import { useTranslation } from 'react-i18next';
import { TimelineStep } from './StitchTrackOrderNew-timeline-step';

export interface OrderTimelineProps {
  /** Live order status; undefined renders the static demo timeline */
  status?: string;
}

/** Canonical status order for the timeline; anything before the current status is completed */
const STATUS_FLOW = ['confirmed', 'preparing', 'ready', 'served', 'delivered'] as const;

const STATUS_LABEL_KEYS: Record<(typeof STATUS_FLOW)[number], string> = {
  confirmed: 'trackOrder.stepConfirmed',
  preparing: 'trackOrder.stepPreparing',
  ready: 'trackOrder.stepReady',
  served: 'trackOrder.stepServed',
  delivered: 'trackOrder.stepDelivered',
};

export function OrderTimeline({ status }: OrderTimelineProps) {
  const { t } = useTranslation();

  const currentIndex = status ? STATUS_FLOW.indexOf(status as (typeof STATUS_FLOW)[number]) : -1;

  return (
    <section className="py-4 relative">
      {/* Connecting line */}
      <div
        className="absolute left-[21px] top-0 bottom-0 w-px"
        style={{ background: 'rgba(var(--aura-chrome-light), 0.1)' }}
      />

      <div className="space-y-12">
        {STATUS_FLOW.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isActive = index === currentIndex;
          return (
            <TimelineStep
              key={step}
              label={t(STATUS_LABEL_KEYS[step], STATUS_LABEL_KEYS[step])}
              time={isActive ? t('trackOrder.inProgress', 'IN PROGRESS') : undefined}
              isActive={isActive}
              isCompleted={isCompleted}
              isLast={index === STATUS_FLOW.length - 1}
            />
          );
        })}
      </div>
    </section>
  );
}
