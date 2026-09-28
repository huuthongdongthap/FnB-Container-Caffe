import { ZONES, type Zone } from './reservation-new-constants';
import { MapPin, CheckCircle2 } from 'lucide-react';

interface ZoneSelectorProps {
  selectedZone: number;
  onSelect: (zoneId: number) => void;
}

export function ZoneSelector({ selectedZone, onSelect }: ZoneSelectorProps) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-4 h-4 text-[#4A7C59]" />
        <label className="font-body text-xs font-bold uppercase tracking-widest text-[var(--aura-chrome-mid)]">
          4. CHỌN KHÔNG GIAN (3 KHỐI CONTAINER • 5 PHÂN KHU)
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {ZONES.map((z) => (
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

function ZoneCard({
  zone,
  isSelected,
  onSelect,
}: {
  zone: Zone;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`group cursor-pointer rounded-2xl overflow-hidden transition-all duration-300 border flex flex-col justify-between relative bg-white/5 backdrop-blur-[8px] ${
        isSelected
          ? 'border-[var(--aura-chrome-bright)] ring-2 ring-[var(--aura-chrome-bright)]/40 shadow-xl scale-[1.02]'
          : 'border-white/10 hover:border-[var(--aura-chrome-mid)]/50'
      }`}
    >
      <div className="h-36 overflow-hidden relative">
        <img
          src={zone.image}
          alt={zone.alt}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A1A2E] via-transparent to-transparent opacity-80" />
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <span className="text-[10px] font-bold text-[#4A7C59] uppercase tracking-wider block mb-1">
            {zone.subtitle}
          </span>
          <h4 className="font-display text-base font-semibold text-white mb-1.5">
            {zone.name}
          </h4>
          <p className="font-body text-xs text-[var(--aura-chrome-soft)] line-clamp-2 leading-relaxed">
            {zone.desc}
          </p>
        </div>
      </div>

      {isSelected && (
        <div className="absolute top-2.5 right-2.5 bg-[#0A1A2E]/80 backdrop-blur-sm rounded-full p-1 border border-[var(--aura-chrome-bright)] text-[#4A7C59]">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}

