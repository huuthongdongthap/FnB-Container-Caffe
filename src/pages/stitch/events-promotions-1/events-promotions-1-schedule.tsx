import type { RefObject } from 'react';
import { EVENTS, actionIcon } from './events-promotions-1-data';

interface ScheduleProps {
  scheduleRef: RefObject<HTMLElement | null>;
  isVisible: boolean;
}

export function EventsSchedule({ scheduleRef, isVisible }: ScheduleProps) {
  return (
    <section
      ref={scheduleRef}
      id="schedule"
      className={`py-20 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
      style={{ backgroundColor: 'var(--aura-noir-deep)' }}
    >
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          {/* Left Column */}
          <div className="lg:col-span-4">
            <h2 className="font-display text-2xl md:text-3xl mb-6 italic">
              The Social
              <br />
              Manifesto
            </h2>
            <p className="font-body text-base text-[var(--aura-chrome-mid)] mb-8">
              AURA CAFE is more than a destination; it is a ritual. Our
              events are engineered to provide a sanctuary from the digital
              noise.
            </p>
            <div className="flex items-center gap-4 py-4 border-y" style={{ borderColor: 'var(--aura-border-chrome)' }}>
              <span style={{ color: 'var(--aura-neon-bronze)' }}>📍</span>
              <span className="font-body text-sm tracking-wider">
                Industrial District, Pier 14
              </span>
            </div>
          </div>

          {/* Right Column — Event Rows */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            {EVENTS.map((event) => (
              <div
                key={event.day}
                className="group flex flex-col md:flex-row md:items-center justify-between p-6 border-b transition-colors hover:bg-white/5"
                style={{ borderColor: 'var(--aura-border-chrome)' }}
              >
                <div className="flex gap-8 items-center">
                  <div className="text-center min-w-[60px]">
                    <p className="font-body text-xs text-[var(--aura-chrome-mid)] tracking-wider">
                      {event.month}
                    </p>
                    <p
                      className="font-display text-2xl"
                      style={{ color: 'var(--aura-neon-bronze)' }}
                    >
                      {event.day}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-display text-lg mb-1">{event.title}</h4>
                    <p className="font-body text-sm text-[var(--aura-chrome-mid)]">
                      {event.time}
                    </p>
                  </div>
                </div>

                <div className="mt-4 md:mt-0 flex items-center gap-4">
                  <span
                    className={`font-body text-xs px-3 py-1 border rounded-full uppercase tracking-wider ${
                      event.status === 'Sold Out'
                        ? 'cursor-not-allowed opacity-50'
                        : ''
                    }`}
                    style={{ borderColor: 'var(--aura-border-chrome)' }}
                  >
                    {event.status}
                  </span>
                  <button
                    className={`p-2 border rounded-full transition-all ${
                      event.disabled
                        ? 'border-[var(--aura-border-chrome)] text-[var(--aura-chrome-mid)] cursor-not-allowed opacity-50'
                        : 'border-[var(--aura-tertiary)] text-[var(--aura-tertiary)] hover:bg-[var(--aura-tertiary)] hover:text-[var(--aura-noir-deep)]'
                    }`}
                    disabled={event.disabled}
                  >
                    <span>{actionIcon(event.action)}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
