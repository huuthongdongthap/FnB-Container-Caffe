import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { Circle } from 'lucide-react';
import { TableMap } from '@/components/reservation/TableMap';
import { IdentityVerification } from '@/components/reservation/IdentityVerification';
import { useReservationTable } from './TableReservation-hooks';
import { ZONE_TAB_MAP, formatDateVi } from './TableReservation-constants';
import { ReservationSidebar } from './TableReservation-ReservationSidebar';
import { BookingBar } from './TableReservation-BookingBar';
import { SuccessModal } from './TableReservation-SuccessModal';

// Re-exports for backward compatibility
export { TIME_SLOTS, ZONE_TAB_MAP, getNextSaturday, formatDateVi } from './TableReservation-constants';
export type { ZoneKey, SuccessField, SuccessDetails } from './TableReservation-types';
export { useReservationTable } from './TableReservation-hooks';
export { ReservationSidebar } from './TableReservation-ReservationSidebar';
export { BookingBar } from './TableReservation-BookingBar';
export { SuccessModal } from './TableReservation-SuccessModal';

export default function TableReservationPage() {
  const { t } = useTranslation('reservations');

  const ZONE_LABELS: Record<string, string> = {
    rooftop: t('zoneRooftop'),
    cafe: t('zoneCafe'),
    courtyard: t('zoneCourtyard'),
  };

  const {
    zone, setZone,
    selectedTime, setSelectedTime,
    selectedTable, setSelectedTable,
    date, setDate,
    guests, setGuests,
    showIdentityModal, setShowIdentityModal,
    showSuccessModal, setShowSuccessModal,
    successDetails, setSuccessDetails,
    tables, loading,
    displaySlots,
    handleTableSelect,
    handleConfirm,
    createReservation,
  } = useReservationTable();

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setSelectedTable(null);
  };

  const handleTimeChange = (time: string) => {
    setSelectedTime(time);
    setSelectedTable(null);
  };

  const handleZoneChange = (newZone: string) => {
    setZone(newZone);
    setSelectedTable(null);
  };

  const handleIdentityVerify = (data: { name: string; phone: string }) => {
    if (!selectedTable) return;
    const payload = {
      table_id: selectedTable,
      customer_name: data.name,
      customer_phone: data.phone,
      guest_count: guests,
      date,
      time: selectedTime,
    };
    createReservation(payload);
    const table = tables.find((t) => t.id === selectedTable);
    setSuccessDetails({
      table: `#${table?.table_number || selectedTable}`,
      zone: ZONE_LABELS[zone] || zone,
      date: formatDateVi(date, t),
      time: selectedTime,
      guests: `${guests}`,
    });
    setShowSuccessModal(true);
    setShowIdentityModal(false);
    setSelectedTable(null);
  };

  return (
    <>
      <HelmetHead
        title={t('seoTitle', 'Table Reservation - AURA CAFE Sa Dec')}
        description={t('seoDescription', 'Reserve a table at AURA CAFE Sa Dec. Choose your preferred zone, time slot, and date for a perfect dining experience.')}
        canonical="/table-reservation"
      />
      <div className="min-h-screen bg-[color:var(--aura-noir-deep)] py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold mb-2">{t('title')}</h1>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
              <Circle size={8} className="inline text-accent align-middle" /> {t('realTime')}
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div>
              <ReservationSidebar
                zone={zone}
                selectedTime={selectedTime}
                date={date}
                guests={guests}
                displaySlots={displaySlots}
                zoneLabels={ZONE_LABELS}
                onZoneChange={handleZoneChange}
                onTimeChange={handleTimeChange}
                onDateChange={handleDateChange}
                onGuestsChange={setGuests}
              />
            </div>
            <div className="lg:col-span-2">
              <div className="bg-white/[0.03] backdrop-blur-md rounded-xl border border-white/[0.08] p-6 shadow-sm">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-white/[0.08] border-t-transparent rounded-full animate-spin" />
                    <span className="ml-3 text-sm text-[color:var(--aura-chrome-bright)]">{t('loadingMap')}</span>
                  </div>
                ) : (
                  <TableMap
                    tables={tables}
                    zone={ZONE_TAB_MAP[zone] || 'VIP'}
                    selectedTable={selectedTable ?? ''}
                    onSelect={handleTableSelect}
                  />
                )}
              </div>
            </div>
          </div>
          {selectedTable && (
            <BookingBar
              selectedTable={selectedTable}
              tables={tables}
              zoneLabel={ZONE_LABELS[zone] || zone}
              selectedTime={selectedTime}
              guests={guests}
              date={date}
              loading={loading}
              onConfirm={handleConfirm}
              onCancel={() => setSelectedTable(null)}
            />
          )}
          <IdentityVerification
            open={showIdentityModal}
            onClose={() => setShowIdentityModal(false)}
            onVerify={handleIdentityVerify}
          />
          <SuccessModal
            open={showSuccessModal}
            onClose={() => setShowSuccessModal(false)}
            successDetails={successDetails}
          />
        </div>
      </div>
    </>
  );
}
