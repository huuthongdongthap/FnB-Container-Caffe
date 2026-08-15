import { useTranslation } from 'react-i18next';
import { Calendar, Zap } from 'lucide-react';
import { TimeSlotPicker } from '@/components/reservation/TimeSlotPicker';
import type { ZoneKey } from './TableReservation-types';

interface ReservationSidebarProps {
  zone: string;
  selectedTime: string;
  date: string;
  guests: number;
  displaySlots: Array<{ time: string; available: boolean }>;
  zoneLabels: Record<string, string>;
  onZoneChange: (zone: ZoneKey) => void;
  onTimeChange: (time: string) => void;
  onDateChange: (date: string) => void;
  onGuestsChange: (guests: number) => void;
}

export function ReservationSidebar({
  zone, selectedTime, date, guests, displaySlots, zoneLabels,
  onZoneChange, onTimeChange, onDateChange, onGuestsChange,
}: ReservationSidebarProps) {
  const { t } = useTranslation('reservations');

  return (
    <div className="space-y-6">
      <div className="bg-white/[0.03] backdrop-blur-md rounded-xl border border-white/[0.08] p-6 shadow-sm">
        <h3 className="font-display font-semibold text-lg mb-1">
          <Zap size={16} className="inline" /> {t('quickBook')}
        </h3>
        <p className="text-sm text-[color:var(--aura-chrome-bright)] mb-4">
          {t('quickBookDesc')}
        </p>
        <button
          data-cal-namespace="aura-booking"
          data-cal-link="aura-cafe/dat-ban"
          data-cal-config='{"layout":"month_view","theme":"dark"}'
          className="w-full px-6 py-3 bg-[color:var(--aura-noir-deep)] text-[color:var(--aura-chrome-bright)] rounded-lg font-medium hover:bg-secondary transition-colors"
        >
          <Calendar size={16} className="inline" /> {t('bookNow')}
        </button>
      </div>

      <div className="text-center text-sm text-[color:var(--aura-chrome-bright)]">
        <span className="bg-border px-4 py-1 rounded-full">{t('orManual')}</span>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">{t('dateAndGuests')}</label>
        <div className="flex gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="flex-1 rounded-lg border border-white/[0.08] px-4 py-2.5 text-sm bg-white/[0.05] focus:outline-none focus:border-[color:var(--aura-chrome-bright)] focus:ring-0"
          />
          <select
            value={guests}
            onChange={(e) => onGuestsChange(Number(e.target.value))}
            className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-sm bg-white/[0.05] focus:outline-none focus:border-[color:var(--aura-chrome-bright)] focus:ring-0"
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{t('guestCount', { n })}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">{t('timeSlot')}</label>
        <TimeSlotPicker
          slots={displaySlots}
          selectedTime={selectedTime}
          onSelect={onTimeChange}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">{t('zone')}</label>
        <div className="flex gap-2">
          {Object.entries(zoneLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => onZoneChange(key as ZoneKey)}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                zone === key
                  ? 'bg-[color:var(--aura-noir-deep)] text-[color:var(--aura-chrome-bright)]'
                  : 'bg-white/[0.03] backdrop-blur-md border border-white/[0.08] text-[color:var(--aura-chrome-bright)] hover:bg-[color:var(--aura-chrome-bright)]/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
