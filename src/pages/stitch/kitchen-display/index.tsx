import { useState, useEffect } from 'react';
import { StitchShell } from '../StitchBase';
import { TICKETS } from './kitchen-display-constants';
import { buildCustomCSS } from './kitchen-display-styles';
import { KdsHeader } from './kitchen-display-header';
import { KdsSideNav } from './kitchen-display-sidenav';
import { KdsStatusBar } from './kitchen-display-status-bar';
import { TicketCard } from './kitchen-display-ticket-card';

/* ── Re-export all types for backward compatibility ─────────────── */
export type { TicketStatus, TicketItem, Ticket, NavItem } from './kitchen-display-types';

/* ── Component ──────────────────────────────────────────────────── */

export default function KitchenDisplaySystem() {
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [timers, setTimers] = useState<Record<string, string>>(
    () => Object.fromEntries(TICKETS.map((t) => [t.id, t.timerText]))
  );
  const [pressedButton, setPressedButton] = useState<string | null>(null);

  // Tick timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) => {
        const next: Record<string, string> = { ...prev };
        for (const ticket of TICKETS) {
          if (ticket.actionDisabled) continue;
          const timeStr = prev[ticket.id] ?? '00:00';
          const parts = timeStr.split(':');
          const min = parseInt(parts[0] ?? '0', 10);
          const sec = parseInt(parts[1] ?? '0', 10);
          const newSec = (sec + 1) % 60;
          const newMin = min + (sec + 1 >= 60 ? 1 : 0);
          next[ticket.id] = `${String(newMin).padStart(2, '0')}:${String(newSec).padStart(2, '0')}`;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeCount = TICKETS.filter((t) => !t.actionDisabled).length;

  return (
    <StitchShell>
      <style>{buildCustomCSS()}</style>

      <KdsHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeCount={activeCount}
      />

      <KdsSideNav />

      <main
        className="ml-64 pt-24 px-8 pb-8 h-screen overflow-y-auto"
        style={{ background: 'var(--aura-noir-void)' }}
      >
        <KdsStatusBar />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {TICKETS.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              timerText={timers[ticket.id] ?? ticket.timerText}
              isPressed={pressedButton === ticket.actionLabel}
              onPress={(id) => setPressedButton(id)}
              onRelease={() => setPressedButton(null)}
              onLeave={() => setPressedButton(null)}
            />
          ))}
        </div>
      </main>
    </StitchShell>
  );
}
