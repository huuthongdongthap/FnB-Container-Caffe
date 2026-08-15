import { CheckCircle } from 'lucide-react';
import type { ZoneData } from './StitchReservationNew-types';
import { partySizes } from './StitchReservationNew-data';

/* ─── Party Size Selector ──────────────────────────────────────────── */

interface PartySizeSelectorProps {
  selectedParty: number | string;
  onSelect: (size: number | string) => void;
}

export function PartySizeSelector({ selectedParty, onSelect }: PartySizeSelectorProps) {
  return (
    <section>
      <label className="mb-4 block font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)]">
        Guests
      </label>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
        {partySizes.map((size) => {
          const isActive = selectedParty === size;
          return (
            <button
              key={String(size)}
              type="button"
              onClick={() => onSelect(size)}
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl font-[family-name:var(--aura-body-font)] text-sm transition-all ${
                isActive
                  ? 'bg-[var(--aura-bronze-shimmer)] text-[var(--aura-surface-dim)] shadow-[0_0_15px_rgba(212,165,116,0.3)]'
                  : 'text-[var(--aura-chrome-soft)] hover:border-[var(--aura-bronze-shimmer)]/50'
              }`}
              style={
                isActive
                  ? undefined
                  : {
                      background: 'rgba(26, 38, 53, 0.7)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(239, 189, 138, 0.1)',
                    }
              }
            >
              {size}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Zone Selector ────────────────────────────────────────────────── */

interface ZoneSelectorProps {
  zones: ZoneData[];
  selectedZone: string;
  onSelect: (zoneId: string) => void;
}

export function ZoneSelector({ zones, selectedZone, onSelect }: ZoneSelectorProps) {
  return (
    <section>
      <label className="mb-4 block font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)]">
        Preferred Zone
      </label>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {zones.map((zone) => {
          const isActive = selectedZone === zone.id;
          return (
            <button
              key={zone.id}
              type="button"
              onClick={() => onSelect(zone.id)}
              className={`group relative cursor-pointer overflow-hidden rounded-2xl border-2 text-left transition-all ${
                isActive
                  ? 'border-[var(--aura-bronze-shimmer)]'
                  : 'border-transparent hover:border-[var(--aura-bronze-shimmer)]/30'
              }`}
              style={{
                background: 'rgba(26, 38, 53, 0.7)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div
                className="h-40 bg-cover bg-center"
                style={{ backgroundImage: `url('${zone.imageUrl}')` }}
                aria-label={zone.imageAlt}
              />
              <div className="p-4">
                <h4 className="mb-1 font-[family-name:var(--aura-display-font)] text-sm uppercase text-[var(--aura-bronze-shimmer)]">
                  {zone.name}
                </h4>
                <p className="font-[family-name:var(--aura-body-font)] text-xs text-[var(--aura-chrome-soft)]">
                  {zone.description}
                </p>
              </div>
              <div
                className={`absolute right-2 top-2 transition-opacity ${
                  isActive ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <CheckCircle
                  className="text-[var(--aura-bronze-shimmer)]"
                  size={24}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
