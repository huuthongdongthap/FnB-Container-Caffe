import { useMemo } from 'react';
import { TIMES } from './reservation-new-constants';
import { Calendar, Clock } from 'lucide-react';

interface DateTimePickerProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  selectedTime: string;
  onSelectTime: (time: string) => void;
}

export function DateTimePicker({
  selectedDate,
  onSelectDate,
  selectedTime,
  onSelectTime,
}: DateTimePickerProps) {
  // Generate next 7 days from today
  const upcomingDays = useMemo(() => {
    const days = [];
    const now = new Date();
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);

      const dayNum = d.getDate();
      const monthNum = d.getMonth() + 1;
      const dateStr = `${dayNum < 10 ? '0' + dayNum : dayNum}/${monthNum < 10 ? '0' + monthNum : monthNum}`;
      const weekday = i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : dayNames[d.getDay()];

      days.push({
        id: dateStr,
        dayNum: String(dayNum),
        weekday,
        fullLabel: `${weekday}, ${dateStr}`,
      });
    }
    return days;
  }, []);

  return (
    <section className="grid grid-cols-1 md:grid-cols-12 gap-8">
      {/* Date Picker (7 cols on md) */}
      <div className="md:col-span-7">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-[#4A7C59]" />
          <label className="font-body text-xs font-bold uppercase tracking-widest text-[var(--aura-chrome-mid)]">
            2. CHỌN NGÀY
          </label>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2.5">
          {upcomingDays.map((day) => {
            const isSelected = selectedDate === day.id;
            return (
              <button
                key={day.id}
                type="button"
                onClick={() => onSelectDate(day.id)}
                className={`py-3 px-2 min-h-[44px] rounded-xl text-center transition-all cursor-pointer border flex flex-col items-center justify-center gap-1 ${
                  isSelected
                    ? 'bg-[var(--aura-chrome-bright)] text-[#0A1A2E] font-bold border-[var(--aura-chrome-bright)] shadow-lg scale-105'
                    : 'bg-white/5 border-white/10 text-[var(--aura-chrome-soft)] hover:border-[var(--aura-chrome-mid)] hover:text-white'
                }`}
              >
                <span className="text-[11px] uppercase tracking-wider font-semibold opacity-90">
                  {day.weekday}
                </span>
                <span className="text-base font-bold font-display">
                  {day.dayNum}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Picker (5 cols on md) */}
      <div className="md:col-span-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-[#4A7C59]" />
          <label className="font-body text-xs font-bold uppercase tracking-widest text-[var(--aura-chrome-mid)]">
            3. KHUNG GIỜ ĐẾN
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {TIMES.map((t) => {
            const isSelected = selectedTime === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onSelectTime(t)}
                className={`py-3 min-h-[44px] inline-flex items-center justify-center rounded-xl text-center font-body text-xs font-bold tracking-wider transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-[var(--aura-chrome-bright)] text-[#0A1A2E] border-[var(--aura-chrome-bright)] shadow-lg scale-105'
                    : 'bg-white/5 border-white/10 text-[var(--aura-chrome-soft)] hover:border-[var(--aura-chrome-mid)] hover:text-white'
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

