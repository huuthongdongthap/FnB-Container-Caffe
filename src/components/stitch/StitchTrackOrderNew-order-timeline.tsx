/**
 * OrderTimeline — vertical progress timeline with 4 steps
 */

import { useTranslation } from 'react-i18next';
import { TimelineStep } from './StitchTrackOrderNew-timeline-step';

export function OrderTimeline() {
  const { t } = useTranslation();

  return (
    <section className="py-4 relative">
      {/* Connecting line */}
      <div
        className="absolute left-[21px] top-0 bottom-0 w-px"
        style={{ background: 'rgba(198, 198, 199, 0.1)' }}
      />

      <div className="space-y-12">
        <TimelineStep
          label={t('trackOrder.stepConfirmed', 'Confirmed')}
          time="10:42 AM"
          isActive={false}
          isCompleted={true}
          isLast={false}
        />
        <TimelineStep
          label={t('trackOrder.stepPreparing', 'Preparing')}
          time={t('trackOrder.inProgress', 'IN PROGRESS')}
          isActive={true}
          isCompleted={false}
          isLast={false}
        />
        <TimelineStep
          label={t('trackOrder.stepOutForDelivery', 'Out for Delivery')}
          isActive={false}
          isCompleted={false}
          isLast={false}
        />
        <TimelineStep
          label={t('trackOrder.stepDelivered', 'Delivered')}
          isActive={false}
          isCompleted={false}
          isLast={true}
        />
      </div>
    </section>
  );
}
