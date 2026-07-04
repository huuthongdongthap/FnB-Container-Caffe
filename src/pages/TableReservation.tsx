import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { TableMap } from '@/components/reservation/TableMap';
import { TimeSlotPicker } from '@/components/reservation/TimeSlotPicker';
import { IdentityVerification } from '@/components/reservation/IdentityVerification';
import { useReservationStore } from '@/hooks/stores/use-reservation-store';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { Calendar, Circle, Zap } from 'lucide-react';

const TIME_SLOTS = [
  { time: '07:00' }, { time: '08:00' }, { time: '09:00' }, { time: '10:00' },
  { time: '11:00' }, { time: '14:00' }, { time: '15:00' }, { time: '16:00' },
  { time: '17:00' }, { time: '19:00' }, { time: '20:00' }, { time: '21:00' },
];

const ZONE_TAB_MAP: Record<string, string> = {
  rooftop: 'VIP',
  cafe: 'Indoor',
  courtyard: 'Outdoor',
};

function getNextSaturday(): string {
  const d = new Date();
  const diff = 6 - d.getDay();
  d.setDate(d.getDate() + (diff <= 0 ? diff + 7 : diff));
  return d.toISOString().split('T')[0]!;
}

export default function TableReservationPage() {
  const { t } = useTranslation('reservations');

  const ZONE_LABELS: Record<string, string> = {
    rooftop: t('zoneRooftop'),
    cafe: t('zoneCafe'),
    courtyard: t('zoneCourtyard'),
  };

  const successLabels: Record<string, string> = {
    table: t('successTable'),
    zone: t('successZone'),
    date: t('successDate'),
    time: t('successTime'),
    guests: t('successGuests'),
  };

  const [zone, setZone] = useState('rooftop');
  const [selectedTime, setSelectedTime] = useState('19:00');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [date, setDate] = useState(getNextSaturday);
  const [guests, setGuests] = useState(2);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successDetails, setSuccessDetails] = useState<Record<string, string>>({});

  const {
    availableSlots,
    tables,
    loading,
    fetchSlots,
    createReservation,
  } = useReservationStore();

  // Fetch availability on date/time change
  useEffect(() => {
    fetchSlots(date, selectedTime);
  }, [date, selectedTime, fetchSlots]);

  // Derive available slots from API data, falling back to static list
  const displaySlots = availableSlots.length > 0
    ? availableSlots
    : TIME_SLOTS.map((slot) => ({
        time: slot.time,
        available: true,
      }));

  const handleTableSelect = (tableId: string) => {
    setSelectedTable((prev) => (prev === tableId ? null : tableId));
  };

  const handleConfirm = useCallback(() => {
    if (!selectedTable || !date || !selectedTime) return;
    setShowIdentityModal(true);
  }, [selectedTable, date, selectedTime]);

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

    // For the success modal, show optimistic data
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
    <div className="min-h-screen bg-[#0A1A2E] py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">
            {t('title')}
          </h1>
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
            <Circle size={8} className="inline text-accent align-middle" /> {t('realTime')}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Controls */}
          <div className="space-y-6">
            {/* Cal.com Quick Book */}
            <div className="bg-white/[0.03] backdrop-blur-md rounded-xl border border-white/[0.08] p-6 shadow-sm">
              <h3 className="font-display font-semibold text-lg mb-1">
                <Zap size={16} className="inline" /> {t('quickBook')}
              </h3>
              <p className="text-sm text-[#b8c7e2] mb-4">
                {t('quickBookDesc')}
              </p>
              <button
                data-cal-namespace="aura-booking"
                data-cal-link="aura-cafe/dat-ban"
                data-cal-config='{"layout":"month_view","theme":"dark"}'
                className="w-full px-6 py-3 bg-[#0A1A2E] text-[#e4e2e4] rounded-lg font-medium hover:bg-secondary transition-colors"
              >
                <Calendar size={16} className="inline" /> {t('bookNow')}
              </button>
            </div>

            <div className="text-center text-sm text-[#b8c7e2]">
              <span className="bg-border px-4 py-1 rounded-full">{t('orManual')}</span>
            </div>

            {/* Date & Guests */}
            <div>
              <label className="block text-sm font-medium mb-2">{t('dateAndGuests')}</label>
              <div className="flex gap-3">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setSelectedTable(null);
                  }}
                  className="flex-1 rounded-lg border border-white/[0.08] px-4 py-2.5 text-sm bg-white/[0.05] focus:outline-none focus:border-[#b8c7e2] focus:ring-0"
                />
                <select
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}
                  className="rounded-lg border border-white/[0.08] px-4 py-2.5 text-sm bg-white/[0.05] focus:outline-none focus:border-[#b8c7e2] focus:ring-0"
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{t('guestCount', { n })}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Time Slots */}
            <div>
              <label className="block text-sm font-medium mb-2">{t('timeSlot')}</label>
              <TimeSlotPicker
                slots={displaySlots}
                selectedTime={selectedTime}
                onSelect={(time) => {
                  setSelectedTime(time);
                  setSelectedTable(null);
                }}
              />
            </div>

            {/* Zone Selector */}
            <div>
              <label className="block text-sm font-medium mb-2">{t('zone')}</label>
              <div className="flex gap-2">
                {Object.entries(ZONE_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setZone(key); setSelectedTable(null); }}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      zone === key
                        ? 'bg-[#0A1A2E] text-[#e4e2e4]'
                        : 'bg-white/[0.03] backdrop-blur-md border border-white/[0.08] text-[#e4e2e4] hover:bg-[#b8c7e2]/20'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Floor Plan */}
          <div className="lg:col-span-2">
            <div className="bg-white/[0.03] backdrop-blur-md rounded-xl border border-white/[0.08] p-6 shadow-sm">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-white/[0.08] border-t-transparent rounded-full animate-spin" />
                  <span className="ml-3 text-sm text-[#b8c7e2]">{t('loadingMap')}</span>
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

        {/* Booking bar */}
        {selectedTable && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/[0.03] backdrop-blur-md border-t border-white/[0.08] shadow-lg p-4 z-40">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <div className="text-sm">
                {t('table')} <span className="font-bold">#{tables.find((tbl) => tbl.id === selectedTable)?.table_number || selectedTable}</span>
                {' · '}{ZONE_LABELS[zone] || zone}
                {' · '}{selectedTime}
                {' · '}{t('guestCountLabel', { n: guests })}
                {' · '}{formatDateVi(date, t)}
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setSelectedTable(null)}>
                  {t('cancel')}
                </Button>
                <Button onClick={handleConfirm} loading={loading}>
                  {t('confirmBooking')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Identity Verification Modal */}
        <IdentityVerification
          open={showIdentityModal}
          onClose={() => setShowIdentityModal(false)}
          onVerify={handleIdentityVerify}
        />

        {/* Success Modal */}
        <Modal
          open={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          title={t('successTitle')}
        >
          <div className="text-center mb-4">
            <div className="w-16 h-16 mx-auto mb-2 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="none">
                <polyline points="4 12 10 18 20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            {Object.entries(successDetails).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-[#b8c7e2]">{successLabels[key] || key}:</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Button className="w-full" onClick={() => setShowSuccessModal(false)}>
              {t('goHome')}
            </Button>
          </div>
        </Modal>
      </div>
    </div>
    </>
  );
}

function formatDateVi(iso: string, t: (key: string) => string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  const days = [
    t('day0'), t('day1'), t('day2'), t('day3'),
    t('day4'), t('day5'), t('day6'),
  ];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${days[d.getDay()]!}, ${dd}/${mm}/${d.getFullYear()}`;
}
