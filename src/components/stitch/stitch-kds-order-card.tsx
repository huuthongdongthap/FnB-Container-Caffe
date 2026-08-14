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
  if (status === 'ready') return 'bg-[#adc8f5]';
  if (status === 'preparing') return 'bg-[var(--aura-chrome-bright)]';
  return 'bg-[#dfaf7e]';
}

/** Compute timer text color based on ticket status */
function getTimerColorClass(status: Ticket['status']): string {
  if (status === 'overdue') return 'text-[var(--aura-error)]';
  if (status === 'ready') return 'text-[#adc8f5]';
  if (status === 'preparing') return 'text-[var(--aura-chrome-bright)]';
  return 'text-[#d4e4fa]';
}

export function TicketCard({
  ticket,
  onComplete,
  onStart,
  onPickup,
}: {
  ticket: Ticket;
  onComplete?: (id: string) => void;
  onStart?: (id: string) => void;
  onPickup?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(ticket.elapsedSeconds);

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

  const isReady = ticket.status === 'ready';
  const isOverdue = ticket.status === 'overdue';
  const isPreparing = ticket.status === 'preparing';
  const isPending = ticket.status === 'pending';

  const accentColorClass = getAccentColorClass(ticket.status);
  const timerColorClass = getTimerColorClass(ticket.status);

  return (
    <article
      className={cn(
        'relative flex min-h-[400px] flex-col overflow-hidden rounded-lg',
        'bg-[rgba(10,26,46,0.6)] backdrop-blur-[20px]',
        'border border-[rgba(255,255,255,0.1)]',
        'shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]',
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
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              {ticket.id}
            </h2>
            <p
              className="text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-chrome-soft)]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
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
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              aria-live="polite"
              aria-label={`${isOverdue ? t('kds.overdue') : isReady ? t('kds.totalTime') : t('kds.elapsed')}: ${formatTime(elapsed)}`}
            >
              {formatTime(elapsed)}
            </span>
            <p
              className="mt-1 text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-chrome-soft)]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
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
                  'min-w-[32px] shrink-0 text-[24px] leading-[1.2] font-bold text-[#d4e4fa]',
                  isReady && 'line-through opacity-50',
                )}
              >
                {item.quantity}x
              </span>
              <div className={cn(isReady && 'line-through opacity-50')}>
                <p
                  className="text-[18px] leading-[1.5] font-medium text-[#d4e4fa]"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {item.name}
                </p>
                {item.modifier && (
                  <span
                    className={cn(
                      'mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                      item.modifier.startsWith('EXTRA') || item.modifier.startsWith('ADD')
                        ? 'bg-[rgba(100,66,26,0.3)] text-[#dfaf7e] border border-[rgba(239,189,138,0.3)]'
                        : 'border border-[var(--aura-chrome-bright)] text-[var(--aura-chrome-bright)]',
                    )}
                  >
                    {item.modifier}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action footer */}
      <div className="border-t border-[var(--aura-chrome-dim)]/10 p-6">
        {isPreparing && onComplete && (
          <ActionButton onClick={() => onComplete(ticket.id)}>
            {t('kds.completeTicket', 'COMPLETE TICKET')}
          </ActionButton>
        )}
        {isPending && onStart && (
          <ActionButton onClick={() => onStart(ticket.id)}>
            {t('kds.startPrep', 'START PREP')}
          </ActionButton>
        )}
        {isReady && onPickup && (
          <ActionButton onClick={() => onPickup(ticket.id)} disabled>
            {t('kds.orderPickedUp', 'ORDER PICKED UP')}
          </ActionButton>
        )}
        {isOverdue && onStart && (
          <ActionButton onClick={() => onStart(ticket.id)} className="bg-error">
            {t('kds.priorityComplete', 'PRIORITY COMPLETE')}
          </ActionButton>
        )}
      </div>

      {/* Ready overlay */}
      {isReady && (
        <div className="pointer-events-none absolute inset-0 bg-[#adc8f5]/5" />
      )}
    </article>
  );
}
