import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  minDate?: string;
  maxDate?: string;
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  minDate,
  maxDate,
  className,
}: DateRangePickerProps) {
  const { t } = useTranslation();
  const baseId = useId();
  const startId = `${baseId}-start`;
  const endId = `${baseId}-end`;

  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`}>
      <div className="flex-1">
        <Input
          label={t('adminChart.fromDate')}
          type="date"
          id={startId}
          value={startDate}
          min={minDate}
          max={endDate || maxDate}
          onChange={(e) => onStartDateChange(e.target.value)}
        />
      </div>
      <span className="text-gray-400 self-center" aria-hidden="true">-</span>
      <div className="flex-1">
        <Input
          label={t('adminChart.toDate')}
          type="date"
          id={endId}
          value={endDate}
          min={startDate || minDate}
          max={maxDate}
          onChange={(e) => onEndDateChange(e.target.value)}
        />
      </div>
    </div>
  );
}
