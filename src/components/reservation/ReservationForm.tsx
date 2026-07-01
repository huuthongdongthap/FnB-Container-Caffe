import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ReservationFormProps {
  date: string;
  guests: number;
  onDateChange: (date: string) => void;
  onGuestsChange: (guests: number) => void;
  onSubmit: () => void;
  className?: string;
}

export function ReservationForm({
  date,
  guests,
  onDateChange,
  onGuestsChange,
  onSubmit,
  className,
}: ReservationFormProps) {
  return (
    <div className={className}>
      <div className="mb-4">
        <Input
          label="Ngày"
          type="date"
          id="reservation-date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
        />
      </div>

      <div className="mb-4">
        <label
          htmlFor="reservation-guests"
          className="block text-sm font-medium text-foreground mb-1.5"
        >
          Số khách
        </label>
        <select
          id="reservation-guests"
          value={guests}
          onChange={(e) => onGuestsChange(Number(e.target.value))}
          className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} người
            </option>
          ))}
        </select>
      </div>

      <Button onClick={onSubmit} className="w-full" size="lg">
        Đặt bàn
      </Button>
    </div>
  );
}
