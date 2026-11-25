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

/** Compute accent bar color based on SLA + workflow status */
function getAccentColorClass(
  workflowStatus: string,
  isOverdue: boolean,
  isWarning: boolean,
): string {
  if (workflowStatus === 'ready') return 'bg-[var(--aura-success,#34d399)]';
  if (isOverdue) return 'bg-[var(--aura-error,#ef4444)]';
  if (isWarning) return 'bg-amber-400';
  if (workflowStatus === 'preparing') return 'bg-sky-400';
  return 'bg-amber-400';
}

/** Compute timer text color based on SLA + workflow status */
function getTimerColorClass(
  workflowStatus: string,
  isOverdue: boolean,
  isWarning: boolean,
): string {
  if (workflowStatus === 'ready') return 'text-[var(--aura-success,#34d399)]';
  if (isOverdue) return 'text-[var(--aura-error,#ffb4ab)]';
  if (isWarning) return 'text-amber-300';
  if (workflowStatus === 'preparing') return 'text-sky-300';
  return 'text-amber-300';
}

/** Compute workflow status pill badge classes (never overwritten by overdue) */
function getWorkflowPillClass(workflowStatus: string): string {
  if (workflowStatus === 'ready') {
    return 'border border-[var(--aura-success,#34d399)]/40 bg-[var(--aura-success,#34d399)]/15 text-[var(--aura-success,#34d399)]';
  }
  if (workflowStatus === 'preparing') {
    return 'border border-sky-400/40 bg-sky-400/15 text-sky-300';
  }
  if (workflowStatus === 'confirmed') {
    return 'border border-cyan-400/40 bg-cyan-400/15 text-cyan-200';
  }
  return 'border border-amber-400/40 bg-amber-400/15 text-amber-300';
}

const HIGHLIGHT_MODIFIER_PREFIXES = ['EXTRA', 'ADD', 'THÊM', 'THEM', 'ÍT', 'IT ', 'KHÔNG', 'KHONG', 'ĐỔI', 'DOI'];

function isHighlightedModifier(modifier: string): boolean {
  const upper = modifier.trim().toUpperCase();
  return HIGHLIGHT_MODIFIER_PREFIXES.some((prefix) => upper.startsWith(prefix));
}

export function TicketCard({
  ticket,
  onComplete,
  onStart,
  onPickup,
  onToggleItemReady,
  pending = false,
  mutationError,
  compact = false,
}: {
  ticket: Ticket;
  pending?: boolean;
  mutationError?: string;
  compact?: boolean;
  onComplete?: (id: string) => void;
  onStart?: (id: string) => void;
  onPickup?: (id: string) => void;
  onToggleItemReady?: (ticketId: string, itemIndex: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const operationalStatus =
    ticket.rawStatus ?? (ticket.status === 'overdue' ? 'pending' : ticket.status);
  const isReady = operationalStatus === 'ready';
  const initialSeconds = isReady
    ? (ticket.readyWaitSeconds ?? ticket.totalTimeSeconds ?? ticket.elapsedSeconds)
    : ticket.elapsedSeconds;
  const [elapsed, setElapsed] = useState(initialSeconds);

  useEffect(() => {
    setElapsed(
      isReady
        ? (ticket.readyWaitSeconds ?? ticket.totalTimeSeconds ?? ticket.elapsedSeconds)
        : ticket.elapsedSeconds,
    );
  }, [isReady, ticket.elapsedSeconds, ticket.readyWaitSeconds, ticket.totalTimeSeconds]);

  useEffect(() => {
    if (isReady && ticket.readyWaitSeconds === undefined) {
      setElapsed(ticket.totalTimeSeconds ?? ticket.elapsedSeconds);
      return;
    }
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isReady, ticket.elapsedSeconds, ticket.readyWaitSeconds, ticket.totalTimeSeconds]);

  const isOverdue = !isReady && Boolean(ticket.isOverdue || ticket.status === 'overdue');
  const isWarning = !isReady && !isOverdue && Boolean(ticket.isWarning);
  const isPreparing = !isOverdue && operationalStatus === 'preparing';
  const isPending = !isOverdue && (operationalStatus === 'pending' || operationalStatus === 'confirmed');
  const isOverduePreparing = isOverdue && operationalStatus === 'preparing';
  const isCompactCard = compact || isReady;

  const workflowPillStatus =
    operationalStatus === 'confirmed'
      ? 'confirmed'
      : operationalStatus === 'preparing'
        ? 'preparing'
        : operationalStatus === 'ready'
          ? 'ready'
          : 'pending';
  const accentColorClass = getAccentColorClass(workflowPillStatus, isOverdue, isWarning);
  const timerColorClass = getTimerColorClass(workflowPillStatus, isOverdue, isWarning);
  const formattedTimer = formatTime(elapsed, i18n?.language);
  const retryAction = isReady
    ? onPickup
    : isPreparing || isOverduePreparing
      ? onComplete ?? onStart
      : onStart ?? onComplete;

  return (
    <article
      className={cn(
        'relative flex flex-col overflow-hidden rounded-lg',
        isCompactCard ? 'min-h-0' : 'min-h-[340px]',
        'bg-[color-mix(in srgb,var(--aura-glass-bg,rgba(var(--aura-glass-bg),1)) 60%,transparent)] backdrop-blur-[8px]',
        'border border-[color-mix(in srgb,var(--aura-glass-bg) 10%,transparent)]',
        'shadow-[inset_0_1px_1px_color-mix(in srgb,var(--aura-glass-bg) 5%,transparent)]',
        'transition-all duration-200',
        isOverdue && 'ring-2 ring-[var(--aura-error,#ef4444)]/60',
        isWarning && 'ring-1 ring-amber-400/50',
        isReady && 'opacity-90',
      )}
      aria-label={t('kds.ticketLabel', { id: ticket.id })}
    >
      {/* Accent bar */}
      <div className={cn('h-1 w-full shrink-0', accentColorClass)} />

      <div className={cn('flex flex-grow flex-col', isCompactCard ? 'p-4' : 'p-6')}>
        {/* Header row: queue rank + ticket ID + workflow pill + SLA timer */}
        <div className={cn('flex items-start justify-between gap-2', isCompactCard ? 'mb-3' : 'mb-4')}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {typeof ticket.queueRank === 'number' && ticket.queueRank > 0 && (
                <span
                  data-testid={`kds-queue-rank-${ticket.id}`}
                  className="inline-flex h-6 min-w-[28px] items-center justify-center rounded bg-amber-400/20 px-1.5 font-mono text-xs font-black text-amber-200 border border-amber-400/40"
                >
                  #{ticket.queueRank}
                </span>
              )}
              <h2
                className={cn(
                  'leading-[1.2] font-bold tracking-tighter',
                  isCompactCard ? 'text-[22px]' : 'text-[30px]',
                  timerColorClass,
                )}
                style={{ fontFamily: 'var(--aura-font-display)' }}
              >
                {ticket.id}
              </h2>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  getWorkflowPillClass(workflowPillStatus),
                )}
              >
                {t(`kds.${workflowPillStatus}`, workflowPillStatus.toUpperCase())}
              </span>
            </div>
            <p
              className="mt-1 text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-chrome-soft)]"
              style={{ fontFamily: "var(--aura-font-body)" }}
            >
              {(() => {
                const channelLabel = t(`kds.${ticket.type.toLowerCase().replace(' ', '')}`, ticket.type);
                const trimmedTable = (ticket.table ?? '').trim();
                if (!trimmedTable || trimmedTable.toLowerCase() === channelLabel.toLowerCase()) {
                  return channelLabel;
                }
                return `${trimmedTable} • ${channelLabel}`;
              })()}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <span
              className={cn(
                'block leading-none tracking-[-0.05em] font-bold tabular-nums',
                isCompactCard ? 'text-[26px]' : 'text-[36px]',
                timerColorClass,
                isOverdue && 'timer-pulse-red',
              )}
              style={{ fontFamily: "var(--aura-font-body)" }}
              aria-live="polite"
              aria-label={`${isOverdue ? t('kds.overdue') : isWarning ? t('kds.warningSoon', 'DUE SOON') : isReady ? t('kds.totalTime') : t('kds.elapsed')}: ${formattedTimer}`}
            >
              {formattedTimer}
            </span>
            <p
              className={cn(
                'mt-1 text-[11px] leading-none tracking-[0.1em] font-bold uppercase',
                isOverdue
                  ? 'text-[var(--aura-error,#ffb4ab)]'
                  : isWarning
                    ? 'text-amber-300'
                    : 'text-[var(--aura-chrome-soft)]',
              )}
              style={{ fontFamily: "var(--aura-font-body)" }}
            >
              {isReady
                ? (ticket.readyWaitSeconds !== undefined ? t('kds.waitingPickup', 'WAITING') : t('kds.totalTime', 'TOTAL TIME'))
                : isOverdue
                  ? t('kds.overdue', 'OVERDUE')
                  : isWarning
                    ? t('kds.warningSoon', 'SẮP TRỄ')
                    : t('kds.elapsed', 'ELAPSED')}
            </p>
          </div>
        </div>

        {/* Items list */}
        <div className={cn('flex-grow', isCompactCard ? 'space-y-2' : 'space-y-3.5')}>
          {ticket.items.map((item, idx) => {
            const itemChecked = Boolean(item.ready) || isReady;
            return (
              <div key={idx} className="flex items-start gap-3">
                {onToggleItemReady && !isReady && (
                  <button
                    type="button"
                    disabled={pending || Boolean(item.ready)}
                    onClick={() => onToggleItemReady(ticket.id, idx)}
                    aria-label={`${t('kds.markItemReady', 'Hoàn tất món')}: ${item.name}`}
                    className={cn(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border text-xs font-bold transition-colors',
                      item.ready
                        ? 'border-emerald-400/60 bg-emerald-500/25 text-emerald-300'
                        : 'border-white/25 bg-white/5 text-transparent hover:border-emerald-400/60 hover:text-emerald-300/60',
                    )}
                  >
                    ✓
                  </button>
                )}
                <span
                  className={cn(
                    'min-w-[28px] shrink-0 font-bold text-[var(--aura-chrome-bright,#d4e4fa)]',
                    isCompactCard ? 'text-[16px] leading-[1.3]' : 'text-[22px] leading-[1.2]',
                    itemChecked && 'line-through opacity-50',
                  )}
                >
                  {item.quantity}x
                </span>
                <div className={cn('min-w-0 flex-1', itemChecked && 'line-through opacity-50')}>
                  <p
                    className={cn(
                      'font-medium text-[var(--aura-chrome-bright,#d4e4fa)]',
                      isCompactCard ? 'text-[14px] leading-[1.35]' : 'text-[17px] leading-[1.45]',
                    )}
                    style={{ fontFamily: "var(--aura-font-body)" }}
                  >
                    {item.name}
                  </p>
                  {item.modifier && (
                    <span
                      className={cn(
                        'mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                        isHighlightedModifier(item.modifier)
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
                      {t('kds.itemNotes', 'Note')}: {item.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          {ticket.notes && (
            <div className="mt-2 rounded border border-[var(--aura-chrome-light,#dfaf7e)]/30 bg-[var(--aura-chrome-light,#dfaf7e)]/10 px-3 py-2 text-xs italic text-[var(--aura-chrome-light,#dfaf7e)]">
              {t('kds.orderNotes', 'Order note')}: {ticket.notes}
            </div>
          )}
        </div>
      </div>

      {mutationError && (
        <div
          role="alert"
          className="mx-4 mb-3 flex items-center justify-between gap-2 rounded-md border border-[var(--aura-error)]/40 bg-[var(--aura-error)]/10 px-3 py-2 text-xs text-[var(--aura-error)]"
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
        <p role="status" className="px-4 pb-2 text-xs text-[var(--aura-chrome-soft)]">
          {t('kds.updating', 'Đang cập nhật…')}
        </p>
      )}
      {/* Action footer */}
      <div className={cn('border-t border-[var(--aura-chrome-dim)]/10', isCompactCard ? 'p-4' : 'p-5')}>
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
        {isReady && ticket.type === 'DELIVERY' && (
          <div className="rounded-lg border border-[var(--aura-success,#34d399)]/40 bg-[var(--aura-success,#34d399)]/10 py-2.5 text-center text-[12px] font-black uppercase tracking-[0.1em] text-[var(--aura-success,#34d399)]">
            {t('kds.awaitingRider', 'AWAITING RIDER')}
          </div>
        )}
        {isReady && ticket.type !== 'DELIVERY' && onPickup && (
          <div title={ticket.blockPickupReason || undefined}>
            <ActionButton
              disabled={pending || Boolean(ticket.blockPickupReason)}
              onClick={() => !ticket.blockPickupReason && onPickup(ticket.id)}
            >
              {ticket.blockPickupReason
                ? t('orderMgmt.codUnpaidWarning', 'COD UNPAID')
                : t('kds.orderPickedUp', 'ORDER PICKED UP')}
            </ActionButton>
          </div>
        )}
        {isOverdue && (onComplete || onStart) && (
          <ActionButton
            disabled={pending}
            onClick={() =>
              isOverduePreparing
                ? (onComplete ? onComplete(ticket.id) : onStart?.(ticket.id))
                : (onStart ? onStart(ticket.id) : onComplete?.(ticket.id))
            }
            className="!bg-none bg-[var(--md-sys-color-error,#ef4444)] text-[var(--md-sys-color-on-error,#ffffff)]"
          >
            {isOverduePreparing
              ? t('kds.priorityComplete', 'PRIORITY COMPLETE')
              : onStart
                ? t('kds.priorityStart', 'START NOW — OVERDUE')
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
