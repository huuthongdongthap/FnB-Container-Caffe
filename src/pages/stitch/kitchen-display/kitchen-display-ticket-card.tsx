import type { CSSProperties } from 'react';
import {
  headlineMd,
  labelCaps,
  bodyLg,
  timerDisplay,
  btnChrome,
} from './kitchen-display-styles';
import type { Ticket } from './kitchen-display-types';

interface TicketCardProps {
  ticket: Ticket;
  timerText: string;
  isPressed: boolean;
  onPress: (id: string) => void;
  onRelease: (id: string) => void;
  onLeave: () => void;
}

function getStatusBarColor(ticket: Ticket): string {
  if (ticket.isOverdue) return '#ffb4ab';
  if (ticket.status === 'ready') return '#adc8f5';
  if (ticket.status === 'preparing') return 'var(--aura-chrome-light)';
  return 'var(--aura-chrome-mid)';
}

function getTimerColor(ticket: Ticket): string {
  if (ticket.isOverdue) return '#ffb4ab';
  if (ticket.status === 'ready') return '#adc8f5';
  if (ticket.status === 'preparing') return 'var(--aura-chrome-light)';
  return 'var(--aura-chrome-bright)';
}

function getButtonStyle(ticket: Ticket): CSSProperties {
  const style: CSSProperties = { ...btnChrome };
  if (ticket.status === 'ready') {
    style.opacity = 0.5;
  }
  if (ticket.isOverdue) {
    style.background = '#93000a';
    style.color = '#ffdad6';
  }
  return style;
}

function getTicketIdColor(ticket: Ticket): string {
  if (ticket.isOverdue) return '#ffb4ab';
  if (ticket.status === 'ready') return '#adc8f5';
  if (ticket.status === 'preparing') return 'var(--aura-chrome-light)';
  return 'var(--aura-chrome-bright)';
}

export function TicketCard({
  ticket,
  timerText,
  isPressed,
  onPress,
  onRelease,
  onLeave,
}: TicketCardProps) {
  const isReady = ticket.status === 'ready';
  const isOverdue = ticket.isOverdue;
  const statusBarColor = getStatusBarColor(ticket);
  const timerColor = getTimerColor(ticket);
  const buttonStyle = getButtonStyle(ticket);
  const idColor = getTicketIdColor(ticket);

  return (
    <article
      className={
        'kds-glass-card flex flex-col relative overflow-hidden' +
        (isReady ? ' kds-ticket-ready' : '')
      }
      style={{
        minHeight: '400px',
        ...(isReady ? { opacity: '0.8' } : {}),
        ...(isOverdue ? { boxShadow: '0 0 0 1px rgba(255, 180, 171, 0.5)' } : {}),
      }}
    >
      <div style={{ height: '4px', width: '100%', background: statusBarColor }} />

      <div className="p-6 flex-grow">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 style={{ ...headlineMd, color: idColor }}>#{ticket.id}</h2>
            <p style={{ ...labelCaps, fontSize: 11, color: 'var(--aura-chrome-mid)' }}>
              {ticket.table} • {ticket.serviceType}
            </p>
          </div>
          <div className="text-right">
            <span
              className={isOverdue ? 'kds-timer-pulse' : ''}
              style={{
                ...timerDisplay,
                fontSize: '40px',
                color: timerColor,
                ...(isOverdue ? { textShadow: '0 0 10px rgba(255, 180, 171, 0.2)' } : {}),
              }}
            >
              {timerText}
            </span>
            <p
              style={{
                ...labelCaps,
                fontSize: 11,
                color: isOverdue ? '#ffb4ab' : 'var(--aura-chrome-mid)',
                marginTop: '4px',
              }}
            >
              {ticket.timerLabel}
            </p>
          </div>
        </div>

        <div className="space-y-4 mt-6">
          {ticket.items.map((item, idx) => (
            <div
              key={`${ticket.id}-${idx}`}
              className="flex items-start gap-4"
              style={item.isCompleted ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}
            >
              <span
                style={{
                  ...headlineMd,
                  color: 'var(--aura-chrome-bright)',
                  minWidth: '32px',
                }}
              >
                {item.qty}
              </span>
              <div className="flex-grow">
                <p style={{ ...bodyLg, color: 'var(--aura-chrome-bright)' }}>{item.name}</p>
                {item.modifier && (
                  <span
                    className="inline-block mt-1"
                    style={{
                      ...labelCaps,
                      fontSize: 10,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: `1px solid ${
                        isReady || ticket.status === 'pending'
                          ? 'rgba(107,159,184,0.3)'
                          : 'rgba(223,175,126,0.3)'
                      }`,
                      background:
                        isReady || ticket.status === 'pending'
                          ? 'rgba(0,26,56,0.5)'
                          : 'rgba(100,66,26,0.4)',
                      color: isReady || ticket.status === 'pending' ? '#6984ad' : '#dfaf7e',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                    }}
                  >
                    {item.modifier}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6" style={{ borderTop: '1px solid rgba(68,71,77,0.1)' }}>
        <button
          disabled={ticket.actionDisabled}
          data-pressed={isPressed}
          className="kds-btn-chrome w-full py-4 rounded-lg font-black tracking-widest"
          style={{
            ...labelCaps,
            fontSize: 12,
            background: buttonStyle.background,
            color: buttonStyle.color,
            opacity: ticket.actionDisabled ? 0.5 : 1,
            boxShadow: buttonStyle.boxShadow,
          }}
          onMouseDown={() => onPress(ticket.actionLabel)}
          onMouseUp={() => onRelease(ticket.actionLabel)}
          onMouseLeave={onLeave}
        >
          {ticket.actionLabel}
        </button>
      </div>
    </article>
  );
}
