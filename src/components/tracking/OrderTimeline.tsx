import { cn } from '@/lib/cn';

interface TimelineStep {
  status: string;
  label: string;
  time?: string;
}

interface OrderTimelineProps {
  currentStatus: string;
  steps: TimelineStep[];
}

const STATUS_ORDER = ['pending', 'confirmed', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled'];

function getStepIndex(status: string): number {
  const idx = STATUS_ORDER.indexOf(status);
  return idx >= 0 ? idx : -1;
}

export function OrderTimeline({ currentStatus, steps }: OrderTimelineProps) {
  const currentIdx = getStepIndex(currentStatus);

  return (
    <div className="timeline" role="list" aria-label="Trạng thái đơn hàng">
      {steps.map((step) => {
        const stepIdx = getStepIndex(step.status);
        const isCompleted = currentIdx >= 0 && stepIdx >= 0 && stepIdx <= currentIdx;
        const isCurrent = step.status === currentStatus;
        const isCancelled = step.status === 'cancelled';
        const showStep = currentStatus !== 'cancelled' || isCancelled || stepIdx < currentIdx;
        const isFuture = !isCompleted && !isCurrent;

        if (currentStatus !== 'cancelled' && isCancelled) return null;
        if (currentStatus === 'cancelled' && !isCancelled && !isCompleted) return null;
        if (!showStep) return null;

        const formatTime = (t?: string) => {
          if (!t) return null;
          const d = new Date(t);
          return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        };

        return (
          <div
            key={step.status}
            className={cn(
              'timeline-item flex gap-4 py-3',
              isCurrent && 'timeline-item-current',
              isCancelled && 'timeline-item-cancelled'
            )}
            data-status={step.status}
            data-completed={isCompleted ? 'true' : 'false'}
            aria-current={isCurrent ? 'step' : undefined}
            role="listitem"
          >
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'h-4 w-4 rounded-full border-2',
                  isCancelled
                    ? 'border-red-500 bg-red-100'
                    : isCompleted
                      ? 'border-green-500 bg-green-500'
                      : isCurrent
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300 bg-white'
                )}
              />
              {step !== steps[steps.length - 1] && (
                <div
                  className={cn(
                    'mt-0.5 h-full w-0.5',
                    isCompleted && !isCancelled ? 'bg-green-500' : 'bg-gray-200'
                  )}
                />
              )}
            </div>
            <div className={cn('flex-1 pb-4', isFuture && 'opacity-50')}>
              <h4 className="font-medium text-sm">
                {isCurrent && !isCancelled && <span className="mr-1">&#9654;</span>}
                {isCompleted && !isCurrent && !isCancelled && <span className="mr-1">&#10003;</span>}
                {step.label}
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                {step.status === 'pending' && 'Đơn hàng đã được tiếp nhận'}
                {step.status === 'confirmed' && 'Đơn hàng đang được xác nhận'}
                {step.status === 'preparing' && 'Bếp đang chuẩn bị đồ ăn'}
                {step.status === 'ready' && 'Đơn hàng sẵn sàng giao/nhận'}
                {step.status === 'delivering' && 'Đơn hàng đang được giao'}
                {step.status === 'delivered' && 'Đơn hàng đã được giao thành công'}
                {step.status === 'cancelled' && 'Đơn hàng đã bị hủy'}
              </p>
              {step.time && (
                <span className="text-xs text-gray-400 mt-1 block">
                  {formatTime(step.time)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
