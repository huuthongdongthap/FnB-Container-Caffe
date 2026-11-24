import { useState, useMemo } from 'react';
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

/** Parse "2 khách" → 2, "3 - 4 khách" → 4, "5 - 8 khách" → 8, "Nhóm 10+" → 10 */
export function parseGuestCount(label: string): number {
  const nums = label.match(/\d+/g);
  if (!nums || nums.length === 0) return 2;
  const maxNum = Math.max(...nums.map((v) => parseInt(v, 10)).filter((n) => Number.isFinite(n) && n > 0));
  return Number.isFinite(maxNum) && maxNum > 0 ? maxNum : 2;
}

/** Normalize DB/template table zone names (EN/VI variants) to reservation zone categories. */
export function normalizeTableZone(rawZone?: string | null): 'indoor' | 'outdoor' | 'vip' | null {
  const raw = String(rawZone ?? '').trim().toLowerCase();
  if (!raw) return null;
  const ascii = raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd');
  if (
    ascii === 'vip' ||
    ascii.includes('vip') ||
    ascii.includes('cabin') ||
    ascii.includes('phong rieng') ||
    ascii.includes('private')
  ) {
    return 'vip';
  }
  if (
    ascii === 'outdoor' ||
    ascii.includes('outdoor') ||
    ascii.includes('san vuon') ||
    ascii.includes('san thuong') ||
    ascii.includes('ngoai troi') ||
    ascii.includes('garden') ||
    ascii.includes('rooftop') ||
    ascii.includes('patio') ||
    ascii.includes('terrace') ||
    ascii.includes('balcony')
  ) {
    return 'outdoor';
  }
  if (
    ascii === 'indoor' ||
    ascii.includes('indoor') ||
    ascii.includes('trong nha') ||
    ascii.includes('lounge') ||
    ascii.includes('quay bar') ||
    ascii === 'bar' ||
    ascii === 'main' ||
    ascii.includes('main hall') ||
    ascii.includes('san khau') ||
    ascii.includes('container') ||
    ascii.includes('tang tret') ||
    ascii.includes('may lanh')
  ) {
    return 'indoor';
  }
  return null;
}

/** Parse "YYYY-MM-DD" or "DD/MM" → ISO date "YYYY-MM-DD" in Asia/Ho_Chi_Minh (handles year rollover) */
export function parseDateToISO(dateInput: string, nowMs = Date.now()): string {
  const trimmed = dateInput.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const [dd, mm, yyyy] = trimmed.split('/');
  if (yyyy && /^\d{4}$/.test(yyyy.trim())) {
    return `${yyyy.trim()}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }
  const vnNow = new Date(nowMs + 7 * 3600_000);
  const currentYear = vnNow.getUTCFullYear();
  const currentMonth = vnNow.getUTCMonth() + 1;
  const targetMonth = parseInt(mm || '1', 10);
  const year = currentMonth === 12 && targetMonth === 1 ? currentYear + 1 : currentYear;
  return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export default function ReservationNew() {
  const todayStr = useMemo(() => {
    const vnNow = new Date(Date.now() + 7 * 3600_000);
    return vnNow.toISOString().slice(0, 10);
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
  const [savedBooking, setSavedBooking] = useState<{ reservationId: string; tableId: string; tableNumber: string; zone: string } | null>(null);
  const [submissionError, setSubmissionError] = useState('');

  const currentZoneObj = ZONES.find((z) => z.id === selectedZone) ?? ZONES[0]!;

  // Real API hook — fetches available tables for selected date/time
  const { tables, isLoadingTables, availabilityError, createReservationAsync, isCreating } = useReservations(
    parseDateToISO(selectedDate),
    selectedTime,
  );


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || isCreating || isLoadingTables) return;

    // Availability or submission failures must fail closed: never present an unlinked demo booking.
    if (availabilityError) {
      setSubmissionError('Không thể tải bàn trống. Vui lòng thử lại sau.');
      return;
    }

    const guestCount = parseGuestCount(selectedParty);
    const fitsCapacity = (t: { capacity?: number }) =>
      t.capacity === undefined || t.capacity === null || Number(t.capacity) <= 0 || Number(t.capacity) >= guestCount;
    const bySmallestCapacity = (a: { capacity?: number }, b: { capacity?: number }) =>
      (Number(a.capacity) || 999) - (Number(b.capacity) || 999);

    const targetDbZone = currentZoneObj.dbZone.toLowerCase();
    const targetCardName = currentZoneObj.name.trim().toLowerCase();
    const matchesTargetZone = (rawZone?: string | null) => {
      const trimmed = String(rawZone ?? '').trim().toLowerCase();
      if (!trimmed) return false;
      if (trimmed === targetDbZone || trimmed === targetCardName) return true;
      return normalizeTableZone(rawZone) === targetDbZone;
    };
    const zoneMatches = tables
      .filter((t) => t.available && fitsCapacity(t) && matchesTargetZone(t.zone))
      .sort(bySmallestCapacity);

    const anyCapacityMatches = tables
      .filter((t) => t.available && fitsCapacity(t))
      .sort(bySmallestCapacity);

    const hasConfiguredTargetZone = tables.some((t) => matchesTargetZone(t.zone));
    const unmappedZoneMatches = anyCapacityMatches.filter((t) => normalizeTableZone(t.zone) === null);
    const matchedTable = zoneMatches[0] ?? (!hasConfiguredTargetZone ? (unmappedZoneMatches[0] ?? null) : null);

    if (!matchedTable) {
      if (anyCapacityMatches.length > 0) {
        setSubmissionError(`Khu vực "${currentZoneObj.name}" hiện không còn bàn phù hợp cho ${guestCount} khách vào khung giờ này. Vui lòng chọn khu vực hoặc khung giờ khác.`);
      } else {
        setSubmissionError(`Không còn bàn đơn phù hợp cho ${guestCount} khách vào khung giờ này. Vui lòng chọn giờ khác hoặc liên hệ quán để ghép bàn.`);
      }
      return;
    }

    const reservationPayload = {
      table_id: matchedTable.id,
      customer_name: fullName,
      customer_phone: phone,
      guest_count: guestCount,
      date: parseDateToISO(selectedDate),
      time: selectedTime,
      notes: note.trim() || undefined,
    };
    try {
      const result = await createReservationAsync(reservationPayload);
      if (result?.success !== true || typeof result.data?.id !== 'string' || !result.data.id.trim()) {
        throw new Error(result?.error || 'Không thể xác nhận đặt bàn. Vui lòng thử lại.');
      }
      const tableNumber = String(result.data.table_number ?? matchedTable.table_number);
      const assignedZone = String(result.data.zone || matchedTable.zone || currentZoneObj.name);
      setSavedBooking({ reservationId: result.data.id, tableId: matchedTable.id, tableNumber, zone: assignedZone });
      setBookingCode(result.data.id);
      setSubmissionError('');
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Lỗi kết nối. Vui lòng thử lại.');
      return;
    }

    setIsSubmitted(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setSubmissionError('');
    setSavedBooking(null);
    setFullName('');
    setPhone('');
    setNote('');
  };

  return (
    <div className="relative min-h-screen bg-[#0A1A2E] text-[var(--aura-chrome-bright)] font-body selection:bg-[var(--aura-chrome-mid)] selection:text-[#0A1A2E] overflow-x-hidden">
      <HelmetHead
        title="Đặt Bàn Trực Tuyến"
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
              Đặt bàn của quý khách đã được xác nhận. Quý khách có thể đặt món trước hoặc đến trực tiếp đúng giờ đã chọn.
            </p>


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
                <span className="text-[var(--aura-chrome-soft)]">Bàn & Khu vực:</span>
                <span className="text-[#4A7C59] font-medium">
                  {savedBooking?.tableNumber ? `Bàn ${savedBooking.tableNumber} • ` : ''}{savedBooking?.zone || currentZoneObj.name}
                </span>
              </div>
              {note && (
                <div className="pt-2 text-xs text-[var(--aura-chrome-soft)] italic border-t border-white/5">
                  Ghi chú: &ldquo;{note}&rdquo;
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => {
                  if (!savedBooking) return;
                  const physicalTable = savedBooking.tableNumber || savedBooking.tableId;
                  const bookingData = {
                    reservationId: savedBooking.reservationId,
                    reservationCode: savedBooking.reservationId,
                    tableId: savedBooking.tableId,
                    fullName,
                    phone,
                    tableNumber: physicalTable,
                    zone: savedBooking.zone || currentZoneObj.name,
                    time: `${selectedTime} • ${selectedDate}`,
                    guestCount: selectedParty,
                    timestamp: Date.now(),
                  };
                  try {
                    localStorage.setItem('aura_active_booking', JSON.stringify(bookingData));
                    localStorage.setItem('aura_saved_customer', JSON.stringify({ fullName, phone }));
                  } catch {
                    /* ignore storage errors */
                  }
                  window.location.href = `/menu?table=${encodeURIComponent(physicalTable)}`;
                }}
                className="px-6 py-3.5 min-h-[44px] rounded-full bg-[var(--aura-chrome-bright)] text-[#0A1A2E] text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-lg"
              >
                <Utensils className="w-4 h-4" /> Xem Thực Đơn & Đặt Món Trước
              </button>
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
              {submissionError && <p role="alert" className="text-amber-400">{submissionError}</p>}
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
                  disabled={isCreating || isLoadingTables}
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

