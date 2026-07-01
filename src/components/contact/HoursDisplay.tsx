import { useMemo } from 'react';
import { cn } from '@/lib/cn';

interface HoursDisplayProps {
  className?: string;
}

interface DaySchedule {
  day: string;
  label: string;
  open: number;
  close: number;
}

const SCHEDULES: DaySchedule[] = [
  { day: 'monday', label: 'Thứ 2', open: 6, close: 22 },
  { day: 'tuesday', label: 'Thứ 3', open: 6, close: 22 },
  { day: 'wednesday', label: 'Thứ 4', open: 6, close: 22 },
  { day: 'thursday', label: 'Thứ 5', open: 6, close: 22 },
  { day: 'friday', label: 'Thứ 6', open: 6, close: 22 },
  { day: 'saturday', label: 'Thứ 7', open: 6, close: 23 },
  { day: 'sunday', label: 'Chủ Nhật', open: 6, close: 23 },
];

const WEEKDAYS: string[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getCurrentDay(): string {
  return WEEKDAYS[new Date().getDay()] ?? 'monday';
}

function getOpenStatus(): { isOpen: boolean; label: string } {
  const now = new Date();
  const hour = now.getHours();
  const dayName = getCurrentDay();
  const schedule = SCHEDULES.find((s) => s.day === dayName);
  if (!schedule) return { isOpen: false, label: 'Đã đóng cửa' };

  const isOpen = hour >= schedule.open && hour < schedule.close;
  return {
    isOpen,
    label: isOpen ? 'Đang mở cửa' : 'Đã đóng cửa',
  };
}

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}

export function HoursDisplay({ className }: HoursDisplayProps) {
  const currentDay = useMemo(() => getCurrentDay(), []);
  const status = useMemo(() => getOpenStatus(), []);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Open/Closed status badge */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-1 text-2xl" aria-hidden="true">&#128338;</div>
        <h3 className="font-display text-lg font-semibold text-foreground">
          Giờ Mở Cửa
        </h3>

        <div className="mt-4 space-y-2">
          {SCHEDULES.map((schedule) => {
            const isToday = schedule.day === currentDay;
            return (
              <div
                key={schedule.day}
                className={cn(
                  'flex justify-between rounded-lg px-3 py-1.5 text-sm',
                  isToday && 'bg-accent/10 font-medium text-foreground',
                  !isToday && 'text-muted',
                )}
              >
                <span>{schedule.label}</span>
                <span>
                  {formatHour(schedule.open)} &mdash; {formatHour(schedule.close)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl bg-accent/5 px-4 py-3">
          <span
            className={cn(
              'h-2.5 w-2.5 rounded-full',
              status.isOpen ? 'bg-green-500' : 'bg-destructive',
            )}
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-foreground">
            {status.label}
          </span>
        </div>
      </div>
    </div>
  );
}
