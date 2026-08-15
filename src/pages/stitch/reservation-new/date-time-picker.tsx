import { TIMES, WEEK_DAYS } from './reservation-new-constants';

interface DateTimePickerProps {
  selectedTime: string;
  onSelectTime: (time: string) => void;
}

export function DateTimePicker({ selectedTime, onSelectTime }: DateTimePickerProps) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label className="block font-label-sm text-label-sm uppercase mb-4 text-secondary">Date</label>
        <div className="glass-panel rounded-xl p-4">
          <div className="flex justify-between items-center mb-4">
            <span className="font-label-md text-label-md text-on-surface">September 2024</span>
            <div className="flex space-x-2">
              <span className="material-symbols-outlined text-on-surface-variant cursor-pointer">chevron_left</span>
              <span className="material-symbols-outlined text-on-surface-variant cursor-pointer">chevron_right</span>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center">
            {WEEK_DAYS.map(d => (
              <span key={d} className="font-label-sm text-label-sm text-outline">{d}</span>
            ))}
            {['12', '13', '14', '15', '16', '17', '18'].map((day, i) => (
              <button
                key={day}
                type="button"
                className={`py-2 ${
                  i === 2
                    ? 'active-pill bronze-glow rounded-lg'
                    : 'text-on-surface-variant hover:text-secondary'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block font-label-sm text-label-sm uppercase mb-4 text-secondary">Time</label>
        <div className="grid grid-cols-2 gap-3">
          {TIMES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => onSelectTime(t)}
              className={`glass-panel py-4 rounded-xl text-center font-label-md text-label-md transition-all ${
                selectedTime === t ? 'active-pill bronze-glow' : 'text-on-surface-variant hover:border-secondary'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
