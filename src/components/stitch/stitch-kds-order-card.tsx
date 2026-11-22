/**
 * StitchKDSNew — Order ticket card component
 *
 * Individual order card with live elapsed timer, item list, status-based styling,
 * and contextual action button (Complete / Start Prep / Priority Complete).
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import type { Ticket } from './stitch-kds-types';
import { formatTime } from './stitch-kds-utils';
import { ActionButton } from './stitch-kds-action-button';

/** Compute accent bar color based on ticket status */
function getAccentColorClass(status: Ticket['status']): string {
  if (status === 'overdue') return 'bg-[var(--aura-error)]';
  if (status === 'ready') return 'bg-[var(--aura-chrome-bright,#adc8f5)]';
  if (status === 'preparing') return 'bg-[var(--aura-chrome-bright)]';
  return 'bg-[var(--aura-chrome-light,#dfaf7e)]';
}

/** Compute timer text color based on ticket status */
function getTimerColorClass(status: Ticket['status']): string {
  if (status === 'overdue') return 'text-[var(--aura-error)]';
  if (status === 'ready') return 'text-[var(--aura-chrome-bright,#adc8f5)]';
  if (status === 'preparing') return 'text-[var(--aura-chrome-bright)]';
  return 'text-[var(--aura-chrome-bright,#d4e4fa)]';
}

export function TicketCard({
  ticket,
  onComplete,
  onStart,
  onPickup,
  pending = false,
  mutationError,
}: {
  ticket: Ticket;
  pending?: boolean;
  mutationError?: string;
  onComplete?: (id: string) => void;
  onStart?: (id: string) => void;
  onPickup?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(ticket.elapsedSeconds);

  useEffect(() => {
    setElapsed(ticket.elapsedSeconds);
  }, [ticket.elapsedSeconds]);

  useEffect(() => {
    if (ticket.status === 'ready') {
      setElapsed(ticket.totalTimeSeconds ?? ticket.elapsedSeconds);
      return;
    }
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [ticket.status, ticket.elapsedSeconds, ticket.totalTimeSeconds]);

  const operationalStatus = ticket.rawStatus ?? ticket.status;
  const isReady = operationalStatus === 'ready';
  const isOverdue = Boolean(ticket.isOverdue || ticket.status === 'overdue');
  const isPreparing = !isOverdue && operationalStatus === 'preparing';
  const isPending = !isOverdue && (operationalStatus === 'pending' || operationalStatus === 'confirmed');
  const isOverduePreparing = isOverdue && operationalStatus === 'preparing';

  const visualStatus: Ticket['status'] = isOverdue ? 'overdue' : ticket.status;
  const accentColorClass = getAccentColorClass(visualStatus);
  const timerColorClass = getTimerColorClass(visualStatus);
  const retryAction = isReady
    ? onPickup
    : isPreparing || isOverduePreparing
      ? onComplete ?? onStart
      : onStart ?? onComplete;

  return (
    <article
      className={cn(
        'relative flex min-h-[400px] flex-col overflow-hidden rounded-lg',
        'bg-[color-mix(in srgb,var(--aura-glass-bg,rgba(var(--aura-glass-bg),1)) 60%,transparent)] backdrop-blur-[8px]',
        'border border-[color-mix(in srgb,var(--aura-glass-bg) 10%,transparent)]',
        'shadow-[inset_0_1px_1px_color-mix(in srgb,var(--aura-glass-bg) 5%,transparent)]',
        'transition-all duration-200',
        isOverdue && 'ring-1 ring-[var(--aura-error)]/50',
        isReady && 'opacity-80',
      )}
      aria-label={t('kds.ticketLabel', { id: ticket.id })}
    >
      {/* Accent bar */}
      <div className={cn('h-1 w-full shrink-0', accentColorClass)} />

      <div className="flex flex-grow flex-col p-6">
        {/* Header row: ticket ID + timer */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2
              className={cn('text-[32px] leading-[1.2] font-bold tracking-tighter', timerColorClass)}
              style={{ fontFamily: 'var(--aura-font-display)' }}
            >
              {ticket.id}
            </h2>
            <p
              className="text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-chrome-soft)]"
              style={{ fontFamily: "var(--aura-font-body)" }}
            >
              {ticket.table} &bull; {t(`kds.${ticket.type.toLowerCase().replace(' ', '')}`, ticket.type)}
            </p>
          </div>
          <div className="text-right">
            <span
              className={cn(
                'block text-[40px] leading-none tracking-[-0.05em] font-bold',
                timerColorClass,
                isOverdue && 'timer-pulse-red',
              )}
              style={{ fontFamily: "var(--aura-font-body)" }}
              aria-live="polite"
              aria-label={`${isOverdue ? t('kds.overdue') : isReady ? t('kds.totalTime') : t('kds.elapsed')}: ${formatTime(elapsed)}`}
            >
              {formatTime(elapsed)}
            </span>
            <p
              className="mt-1 text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-chrome-soft)]"
              style={{ fontFamily: "var(--aura-font-body)" }}
            >
              {isReady ? t('kds.totalTime', 'TOTAL TIME') : isOverdue ? t('kds.overdue', 'OVERDUE') : t('kds.elapsed', 'ELAPSED')}
            </p>
          </div>
        </div>

        {/* Items list */}
        <div className="flex-grow space-y-4">
          {ticket.items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-4">
              <span
                className={cn(
                  'min-w-[32px] shrink-0 text-[24px] leading-[1.2] font-bold text-[var(--aura-chrome-bright,#d4e4fa)]',
                  isReady && 'line-through opacity-50',
                )}
              >
                {item.quantity}x
              </span>
              <div className={cn(isReady && 'line-through opacity-50')}>
                <p
                  className="text-[18px] leading-[1.5] font-medium text-[var(--aura-chrome-bright,#d4e4fa)]"
                  style={{ fontFamily: "var(--aura-font-body)" }}
                >
                  {item.name}
                </p>
                {item.modifier && (
                  <span
                    className={cn(
                      'mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                      item.modifier.startsWith('EXTRA') || item.modifier.startsWith('ADD')
                        ? 'bg-[color-mix(in srgb,var(--aura-chrome-mid,rgba(100,66,26,1)) 30%,transparent)] text-[var(--aura-chrome-light,#dfaf7e)] border border-[color-mix(in srgb,var(--aura-chrome-light,rgba(var(--aura-chrome-light),1)) 30%,transparent)]'
                        : 'border border-[var(--aura-chrome-bright)] text-[var(--aura-chrome-bright)]',
                    )}
                  >
                    {item.modifier}
                  </span>
                )}
                {item.notes && (
                  <p
                    className="mt-1 text-xs italic text-[var(--aura-chrome-light,#dfaf7e)]"
                    style={{ fontFamily: 'var(--aura-font-body)' }}
                  >
                    Ghi chú: {item.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
          {ticket.notes && (
            <div className="mt-2 rounded border border-[var(--aura-chrome-light,#dfaf7e)]/30 bg-[var(--aura-chrome-light,#dfaf7e)]/10 px-3 py-2 text-xs italic text-[var(--aura-chrome-light,#dfaf7e)]">
              Ghi chú đơn: {ticket.notes}
            </div>
          )}
        </div>
      </div>

      {mutationError && (
        <div
          role="alert"
          className="mx-6 mb-3 flex items-center justify-between gap-2 rounded-md border border-[var(--aura-error)]/40 bg-[var(--aura-error)]/10 px-3 py-2 text-xs text-[var(--aura-error)]"
        >
          <span>
            {t('kds.updateFailed', 'Không thể cập nhật')}: {mutationError}
          </span>
          {retryAction && (
            <button
              type="button"
              disabled={pending}
              onClick={() => retryAction(ticket.id)}
              className="shrink-0 rounded border border-[var(--aura-error)]/50 px-2 py-1 font-semibold uppercase tracking-wider transition-colors hover:bg-[var(--aura-error)]/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('common.retry', 'Thử lại')}
            </button>
          )}
        </div>
      )}
      {pending && (
        <p role="status" className="px-6 pb-2 text-xs text-[var(--aura-chrome-soft)]">
          {t('kds.updating', 'Đang cập nhật…')}
        </p>
      )}
      {/* Action footer */}
      <div className="border-t border-[var(--aura-chrome-dim)]/10 p-6">
        {isPreparing && onComplete && (
          <ActionButton disabled={pending} onClick={() => onComplete(ticket.id)}>
            {t('kds.completeTicket', 'COMPLETE TICKET')}
          </ActionButton>
        )}
        {isPending && onStart && (
          <ActionButton disabled={pending} onClick={() => onStart(ticket.id)}>
            {t('kds.startPrep', 'START PREP')}
          </ActionButton>
        )}
        {isReady && onPickup && (
          <ActionButton disabled={pending} onClick={() => onPickup(ticket.id)}>
            {t('kds.orderPickedUp', 'ORDER PICKED UP')}
          </ActionButton>
        )}
        {isOverdue && (onComplete || onStart) && (
          <ActionButton
            disabled={pending}
            onClick={() =>
              isOverduePreparing
                ? (onComplete ? onComplete(ticket.id) : onStart?.(ticket.id))
                : (onStart ? onStart(ticket.id) : onComplete?.(ticket.id))
            }
            className="bg-error"
          >
            {isOverduePreparing
              ? t('kds.priorityComplete', 'PRIORITY COMPLETE')
              : onStart
                ? t('kds.startPrep', 'START PREP')
                : t('kds.priorityComplete', 'PRIORITY COMPLETE')}
          </ActionButton>
        )}
      </div>

      {/* Ready overlay */}
      {isReady && (
        <div className="pointer-events-none absolute inset-0 bg-[var(--aura-chrome-bright,#adc8f5)]/5" />
      )}
    </article>
  );
}
