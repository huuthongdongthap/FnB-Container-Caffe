import { useState, useMemo, useEffect } from 'react';
import { PartySizeSelector } from './party-size-selector';
import { DateTimePicker } from './date-time-picker';
import { ZoneSelector } from './zone-selector';
import { ContactInfoForm } from './contact-info-form';
import { ZONES } from './reservation-new-constants';
import { LandingNav } from '@/components/stitch/StitchLandingNew-nav';
import { LandingFooter } from '@/components/stitch/StitchLandingNew-footer';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { CheckCircle2, ArrowRight, Utensils, RotateCcw, Loader2 } from 'lucide-react';
import { useReservations } from '@/hooks/use-reservations';

// Re-exports for backward compatibility
export type { Zone } from './reservation-new-constants';
export { GUEST_OPTIONS, TIMES, WEEK_DAYS, ZONES } from './reservation-new-constants';

/** Parse "2 khách" → 2 */
function parseGuestCount(label: string): number {
  const n = parseInt(label, 10);
  return Number.isFinite(n) ? n : 2;
}

/** Parse "DD/MM" + current year → ISO date "YYYY-MM-DD" */
function parseDateToISO(ddmm: string): string {
  const [dd, mm] = ddmm.split('/');
  const year = new Date().getFullYear();
  return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export default function ReservationNew() {
  const todayStr = useMemo(() => {
    const d = new Date();
    const day = d.getDate();
    const m = d.getMonth() + 1;
    return `${day < 10 ? '0' + day : day}/${m < 10 ? '0' + m : m}`;
  }, []);

  const [selectedParty, setSelectedParty] = useState('2 khách');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedTime, setSelectedTime] = useState('19:30');
  const [selectedZone, setSelectedZone] = useState(2);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [bookingCode, setBookingCode] = useState('');
  const [apiOffline, setApiOffline] = useState(false);

  const currentZoneObj = ZONES.find((z) => z.id === selectedZone) ?? ZONES[0]!;

  // Real API hook — fetches available tables for selected date/time
  const { tables, createReservation, isCreating, createError } = useReservations(
    parseDateToISO(selectedDate),
    selectedTime,
  );

  // Show success when API returns a booking id
  // We track submission ourselves via isSubmitted flag
  useEffect(() => {
    if (createError) {
      // API error — set offline flag so user knows it's a demo code
      setApiOffline(true);
    }
  }, [createError]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fullName || !phone) return;

    // Find a table matching the selected zone (prefer available ones)
    const zoneLabel = currentZoneObj.name.toLowerCase();
    const matchedTable = tables.find(
      (t) => t.available && t.zone?.toLowerCase().includes(zoneLabel),
    ) ?? tables.find((t) => t.available) ?? null;

    if (matchedTable) {
      // Call real API
      createReservation({
        table_id: matchedTable.id,
        customer_name: fullName,
        customer_phone: phone,
        guest_count: parseGuestCount(selectedParty),
        date: parseDateToISO(selectedDate),
        time: selectedTime,
      });
      setBookingCode(matchedTable.table_number
        ? `AURA-${matchedTable.table_number}`
        : `AURA-${matchedTable.id.slice(-4).toUpperCase()}`);
    } else {
      // No tables from API (offline / no availability) — graceful fallback
      setApiOffline(true);
      setBookingCode(`DEMO-${Math.floor(1000 + Math.random() * 9000)}`);
    }

    setIsSubmitted(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setApiOffline(false);
    setFullName('');
    setPhone('');
    setNote('');
  };

  return (
    <div className="relative min-h-screen bg-[#0A1A2E] text-[var(--aura-chrome-bright)] font-body selection:bg-[var(--aura-chrome-mid)] selection:text-[#0A1A2E] overflow-x-hidden">
      <HelmetHead
        title="Đặt Bàn Trực Tuyến — AURA CAFE"
        description="Đặt bàn trước tại AURA CAFE Sa Đéc. Chọn vị trí yêu thích: Quầy Bar, Lounge Thủy Mộc, Sân Thượng Rooftop hoặc Cabin Yên Tĩnh."
        canonical="/table-reservation"
      />
      <LandingNav />

      <div role="region" aria-label="Đặt Bàn Trải Nghiệm" className="pt-28 pb-24 px-4 sm:px-8 lg:px-16 max-w-6xl mx-auto w-full">
        {isSubmitted ? (
          /* Confirmation State */
          <div className="max-w-2xl mx-auto py-12 px-6 sm:px-10 bg-white/5 backdrop-blur-[12px] border border-white/10 rounded-[32px] border-t border-[var(--aura-chrome-mid)]/40 text-center shadow-2xl animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-[#4A7C59]/20 border border-[#4A7C59] flex items-center justify-center mx-auto mb-6 text-[#4A7C59]">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#4A7C59] block mb-2">
              ĐẶT BÀN THÀNH CÔNG
            </span>
            <h1 className="font-display text-3xl sm:text-4xl text-white font-semibold mb-3">
              Cảm Ơn Quý Khách!
            </h1>
            <p className="text-[var(--aura-chrome-soft)] text-sm max-w-md mx-auto mb-4 font-light leading-relaxed">
              Yêu cầu đặt bàn của quý khách đã được ghi nhận. Đội ngũ AURA CAFE sẽ liên hệ qua điện thoại để xác nhận trong ít phút.
            </p>
            {apiOffline && (
              <p className="text-amber-400/80 text-xs max-w-sm mx-auto mb-6 font-light">
                ⚠ Hệ thống đặt bàn tự động tạm thời không khả dụng. Nhân viên sẽ xác nhận thủ công khi liên hệ quý khách.
              </p>
            )}

            {/* Booking Details Card */}
            <div className="bg-black/30 border border-white/10 rounded-2xl p-6 text-left space-y-3 mb-8">
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <span className="text-xs text-[var(--aura-chrome-mid)] font-semibold uppercase tracking-wider">Mã đặt bàn</span>
                <span className="font-mono text-base font-bold text-white tracking-widest">{bookingCode}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--aura-chrome-soft)]">Họ tên:</span>
                <span className="text-white font-medium">{fullName}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--aura-chrome-soft)]">Số điện thoại:</span>
                <span className="text-white font-medium">{phone}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--aura-chrome-soft)]">Thời gian:</span>
                <span className="text-white font-medium">{selectedTime} • {selectedDate}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--aura-chrome-soft)]">Số lượng khách:</span>
                <span className="text-white font-medium">{selectedParty}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--aura-chrome-soft)]">Khu vực:</span>
                <span className="text-[#4A7C59] font-medium">{currentZoneObj.name}</span>
              </div>
              {note && (
                <div className="pt-2 text-xs text-[var(--aura-chrome-soft)] italic border-t border-white/5">
                  Ghi chú: &ldquo;{note}&rdquo;
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="/menu"
                className="px-6 py-3.5 min-h-[44px] rounded-full bg-[var(--aura-chrome-bright)] text-[#0A1A2E] text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-lg"
              >
                <Utensils className="w-4 h-4" /> Xem Thực Đơn & Đặt Món Trước
              </a>
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-3.5 min-h-[44px] rounded-full bg-white/5 border border-white/10 text-white text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> Đặt Thêm Bàn Khác
              </button>
            </div>
          </div>
        ) : (
          /* Form State */
          <>
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-[var(--aura-chrome-mid)] text-xs uppercase tracking-[0.3em] font-semibold block mb-3">
                TRẢI NGHIỆM KHÔNG GIAN BẢN ĐỊA • SA ĐÉC
              </span>
              <h1 className="font-display text-4xl sm:text-5xl text-white font-medium mb-4">
                Đặt Bàn Trước
              </h1>
              <p className="font-body text-sm sm:text-base text-[var(--aura-chrome-soft)] font-light leading-relaxed">
                Giữ chỗ vị trí view đẹp nhất tại 3 khối container kiến trúc và thưởng thức những ly cà phê trọn vị cùng bạn bè, gia đình.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-12">
              <PartySizeSelector
                selectedParty={selectedParty}
                onSelect={setSelectedParty}
              />

              <DateTimePicker
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                selectedTime={selectedTime}
                onSelectTime={setSelectedTime}
              />

              <ZoneSelector
                selectedZone={selectedZone}
                onSelect={setSelectedZone}
              />

              <ContactInfoForm
                fullName={fullName}
                onFullNameChange={setFullName}
                phone={phone}
                onPhoneChange={setPhone}
                note={note}
                onNoteChange={setNote}
              />

              <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div>
                  <p className="font-display text-lg text-white font-medium mb-1">
                    {currentZoneObj.name} • {selectedParty}
                  </p>
                  <p className="text-xs text-[var(--aura-chrome-soft)]">
                    Thời gian: {selectedTime} ngày {selectedDate} • Miễn phí giữ bàn
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full sm:w-auto px-10 py-4 min-h-[44px] rounded-full bg-[var(--aura-chrome-bright)] text-[#0A1A2E] text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isCreating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Đang xử lý...</>
                  ) : (
                    <>Xác Nhận Đặt Bàn Ngay <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      <LandingFooter />
    </div>
  );
}

