import { cn } from '@/lib/cn';
import type { TimeSlot } from '@/hooks/use-reservations';

interface TimeSlotPickerProps {
  slots: TimeSlot[];
  selectedTime: string;
  onSelect: (time: string) => void;
  className?: string;
}

export function TimeSlotPicker({ slots, selectedTime, onSelect, className }: TimeSlotPickerProps) {
  return (
    <div className={cn('grid grid-cols-4 gap-2', className)}>
      {slots.map((slot) => {
        const isPast = isPastTime(slot.time);
        const isDisabled = !slot.available || isPast;
        const isSelected = selectedTime === slot.time;

        return (
          <button
            key={slot.time}
            disabled={isDisabled}
            aria-pressed={isSelected}
            onClick={() => onSelect(slot.time)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium border transition-all',
              isDisabled && !isSelected && 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through',
              isSelected && 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-300',
              !isDisabled && !isSelected && 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:border-blue-300 cursor-pointer'
            )}
          >
            {slot.time}
          </button>
        );
      })}
    </div>
  );
}

function isPastTime(time: string): boolean {
  const now = new Date();
  const [hours, minutes] = time.split(':').map(Number);
  if (hours === undefined || minutes === undefined) return false;
  const slotDate = new Date();
  slotDate.setHours(hours, minutes, 0, 0);
  return slotDate <= now;
}
