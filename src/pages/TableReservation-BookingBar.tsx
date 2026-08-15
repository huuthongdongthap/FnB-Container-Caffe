import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { formatDateVi } from './TableReservation-constants';

interface BookingBarProps {
  selectedTable: string;
  tables: Array<{ id: string; table_number: string }>;
  zoneLabel: string;
  selectedTime: string;
  guests: number;
  date: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function BookingBar({
  selectedTable, tables, zoneLabel, selectedTime, guests, date, loading, onConfirm, onCancel,
}: BookingBarProps) {
  const { t } = useTranslation('reservations');
  const tableNumber = tables.find((tbl) => tbl.id === selectedTable)?.table_number || selectedTable;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/[0.03] backdrop-blur-md border-t border-white/[0.08] shadow-lg p-4 z-40">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="text-sm">
          {t('table')} <span className="font-bold">#{tableNumber}</span>
          {' · '}{zoneLabel}
          {' · '}{selectedTime}
          {' · '}{t('guestCountLabel', { n: guests })}
          {' · '}{formatDateVi(date, t)}
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button onClick={onConfirm} loading={loading}>
            {t('confirmBooking')}
          </Button>
        </div>
      </div>
    </div>
  );
}
