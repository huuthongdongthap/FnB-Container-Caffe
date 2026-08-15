/**
 * Form sub-sections: DatePicker, TimePicker, ContactForm.
 * Extracted from StitchReservationNew-components.tsx to stay under 200 LOC.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { timeSlots, dayLabels, daysInMonth } from './StitchReservationNew-data';

/* ─── Date Picker ──────────────────────────────────────────────────── */

interface DatePickerProps {
  selectedDate: number;
  onSelect: (date: number) => void;
}

export function DatePicker({ selectedDate, onSelect }: DatePickerProps) {
  return (
    <div>
      <label className="mb-4 block font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)]">
        Date
      </label>
      <div
        className="rounded-xl p-4"
        style={{
          background: 'rgba(26, 38, 53, 0.7)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(239, 189, 138, 0.1)',
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="font-[family-name:var(--aura-body-font)] text-sm text-[var(--aura-chrome-bright)]">
            September 2024
          </span>
          <div className="flex gap-2">
            <ChevronLeft className="cursor-pointer text-[var(--aura-chrome-soft)]" size={20} />
            <ChevronRight className="cursor-pointer text-[var(--aura-chrome-soft)]" size={20} />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2 text-center">
          {dayLabels.map((day) => (
            <span
              key={day}
              className="font-[family-name:var(--aura-body-font)] text-xs text-[var(--aura-chrome-soft)]/60"
            >
              {day}
            </span>
          ))}
          {daysInMonth.map((d) => {
            const isActive = selectedDate === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onSelect(d)}
                className={`py-2 font-[family-name:var(--aura-body-font)] text-sm transition-all ${
                  isActive
                    ? 'rounded-lg bg-[var(--aura-bronze-shimmer)] text-[var(--aura-surface-dim)] shadow-[0_0_15px_rgba(212,165,116,0.3)]'
                    : 'text-[var(--aura-chrome-soft)] hover:text-[var(--aura-bronze-shimmer)]'
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Time Picker ──────────────────────────────────────────────────── */

interface TimePickerProps {
  selectedTime: string;
  onSelect: (time: string) => void;
}

export function TimePicker({ selectedTime, onSelect }: TimePickerProps) {
  return (
    <div>
      <label className="mb-4 block font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)]">
        Time
      </label>
      <div className="grid grid-cols-2 gap-3">
        {timeSlots.map((time) => {
          const isActive = selectedTime === time;
          return (
            <button
              key={time}
              type="button"
              onClick={() => onSelect(time)}
              className={`rounded-xl py-4 text-center font-[family-name:var(--aura-body-font)] text-sm transition-all ${
                isActive
                  ? 'bg-[var(--aura-bronze-shimmer)] text-[var(--aura-surface-dim)] shadow-[0_0_15px_rgba(212,165,116,0.3)]'
                  : 'text-[var(--aura-chrome-soft)] hover:border-[var(--aura-bronze-shimmer)]'
              }`}
              style={
                !isActive
                  ? {
                      background: 'rgba(26, 38, 53, 0.7)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(239, 189, 138, 0.1)',
                    }
                  : undefined
              }
            >
              {time}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Contact Form ─────────────────────────────────────────────────── */

interface ContactFormProps {
  fullName: string;
  onFullNameChange: (v: string) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
  email: string;
  onEmailChange: (v: string) => void;
}

export function ContactForm({
  fullName,
  onFullNameChange,
  phone,
  onPhoneChange,
  email,
  onEmailChange,
}: ContactFormProps) {
  const inputClass =
    'w-full rounded-xl border border-[var(--aura-chrome-soft)]/30 bg-[var(--aura-surface-container)] px-6 py-4 font-[family-name:var(--aura-body-font)] text-base text-[var(--aura-chrome-bright)] outline-none transition-all placeholder:text-[var(--aura-chrome-soft)]/50 focus:border-[var(--aura-bronze-shimmer)] focus:ring-1 focus:ring-[var(--aura-bronze-shimmer)]';
  const labelClass =
    'absolute -top-2.5 left-4 z-10 bg-[var(--aura-surface-dim)] px-2 font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-chrome-soft)]';

  return (
    <section className="max-w-2xl">
      <label className="mb-6 block font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)]">
        Contact Information
      </label>
      <div className="space-y-6">
        <div className="relative">
          <label className={labelClass}>Full Name</label>
          <input
            className={inputClass}
            placeholder="John Doe"
            type="text"
            value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="relative">
            <label className={labelClass}>Phone</label>
            <input
              className={inputClass}
              placeholder="+1 (555) 000-0000"
              type="tel"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
            />
          </div>
          <div className="relative">
            <label className={labelClass}>Email</label>
            <input
              className={inputClass}
              placeholder="john@example.com"
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
