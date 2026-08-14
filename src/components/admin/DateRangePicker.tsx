import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  className,
}: DateRangePickerProps) {
  const { t } = useTranslation();
  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`}>
      <div className="flex-1">
        <Input
          label={t('adminChart.fromDate')}
          type="date"
          id="date-start"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
        />
      </div>
      <span className="text-gray-400 mt-6">-</span>
      <div className="flex-1">
        <Input
          label={t('adminChart.toDate')}
          type="date"
          id="date-end"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
        />
      </div>
    </div>
  );
}
