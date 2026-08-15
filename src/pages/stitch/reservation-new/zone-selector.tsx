import { ZONES, type Zone } from './reservation-new-constants';

interface ZoneSelectorProps {
  selectedZone: number;
  onSelect: (zoneId: number) => void;
}

export function ZoneSelector({ selectedZone, onSelect }: ZoneSelectorProps) {
  return (
    <section>
      <label className="block font-label-sm text-label-sm uppercase mb-4 text-secondary">Preferred Zone</label>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {ZONES.map(z => (
          <ZoneCard
            key={z.id}
            zone={z}
            isSelected={selectedZone === z.id}
            onSelect={() => onSelect(z.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ZoneCard({ zone, isSelected, onSelect }: { zone: Zone; isSelected: boolean; onSelect: () => void }) {
  return (
    <div
      onClick={onSelect}
      className={`group cursor-pointer glass-panel rounded-2xl overflow-hidden transition-all border-2 relative ${
        isSelected ? 'border-[var(--aura-tertiary)] selected' : 'border-transparent hover:border-secondary/30'
      }`}
    >
      <div
        className="h-40 bg-cover bg-center"
        role="img"
        aria-label={zone.alt}
        style={{ backgroundImage: `url('${zone.image}')` }}
      />
      <div className="p-4">
        <h4 className="font-headline-md text-label-md text-secondary uppercase mb-1">{zone.name}</h4>
        <p className="font-body-md text-label-sm text-on-surface-variant">{zone.desc}</p>
      </div>
      <div className={`absolute top-2 right-2 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
        <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
          check_circle
        </span>
      </div>
    </div>
  );
}
