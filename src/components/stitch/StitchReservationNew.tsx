/**
 * StitchReservationNew — AURA CAFE Table Reservation (Stitch design, regenerated to exact HTML match)
 *
 * Dark navy reservation form with party size selector, date/time picker,
 * zone selection (Indoor/Outdoor/Rooftop/VIP), contact info, and CTA.
 * Mobile-first responsive. Named export.
 * Source: stitch-exports/new-screens/table-reservation.html
 */
'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, X, ArrowRight, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';

/* ─── Types ────────────────────────────────────────────────────────── */

export interface ZoneData {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
}

export interface StitchReservationNewProps {
  zones?: ZoneData[];
  onBack?: () => void;
  onClose?: () => void;
}

/* ─── Default zone data ────────────────────────────────────────────── */

const defaultZones: ZoneData[] = [
  {
    id: 'indoor',
    name: 'Indoor',
    description: 'Lush velvet & industrial vibes.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBszs99tbK7fqZ7HnmelulFYenGNCV7_dslfT03Yt6L7M6NnGiW_90PbeKkp1e7XB7l9XElwVfcAllaFbMxQmCIKYjgqRhA-kXNO4kZ7kSAC6s_sU0hJb414vr0S2YTuDY2-u6aUFFRrkdt97_PFKsDi1oMsedxg14Zw6o2j3vhfsRTIoKkaT1h3xLKlgA5VwjebVZ3NjyqrlcNBdPbsUK62rC67byLwxsmw2a4Y7MbSds-WdEfQGyI_iWJbax2yWRVZZS_k1-kvHY',
    imageAlt: 'A moody, high-end indoor cafe interior with industrial exposed piping and warm Edison bulb lighting',
  },
  {
    id: 'outdoor',
    name: 'Outdoor',
    description: 'Garden breeze & fire pits.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAg8_hRBmi1lfY0mHVxF7GBPEThuDkSmjkyLi-lhKYI0um0WM0pi38bGpNuouwKE6AcpTxp1pe8L0y3-NzC1dJo0ZvJkXG_2G238Kcn8PIgw_59Bv4nMij3zXdmV-ow6IdpP4RGMfpbL8CqCg-Yi4KDr3F0obMjKWeNRy0o4IboNUl1mM9evxrnHlTjf1cnEarKg0MtlBrpHyoEaOCQbACbBnZciRkb_Nd8yMRrJhe9AIoIhDHVwQgBpBQ8IYdWNnPcy20k_FZJkVA',
    imageAlt: 'An elegant outdoor dining terrace at night with minimalist architectural lines and fire pits',
  },
  {
    id: 'rooftop',
    name: 'Rooftop',
    description: 'City views & night breeze.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCzR8JSSqjy5uuVxcUbh3KpRQ_9AvzmU6-bl2Xu7Hat7PINhwHSMuZqJItpmd8ZCB61i8ZwHfZ7FNP4bMXqayTiy41YmhlHxkTDdRNs1Pusx7CRY-SY_mODLoRdWlwgn_IJ1bccEVJyLANDSHrJSXu_ez6GvrsuxtYr-xdSWcicKCcbcADqeJlhfpDvTpTTDaaxzFn74v3lqWta3UdxQ2G10TK5JO2QU4dpRAR5Nw47YTNK36xK4ev0f1aC0L_ZwudpEgbedy9joJk',
    imageAlt: 'A stunning rooftop bar view overlooking a metropolitan skyline at night',
  },
  {
    id: 'vip',
    name: 'VIP Lounge',
    description: 'Private booths & top service.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDsdSwKBQ0_Axy1FxGSHQE9a7Ty-l2SoOrOYSH2yqLzR2vEmEZ3VkPnJ5wbYon4864M6PNgiSna9eg0CY-pI9vW4rU9p68R-JTIbUBhQQzn9WhnpB1R6OGPXbgzxisVtcaWhG06kDsa3ALwCO5QyMm2FyuwmiWAm2X1l8xfJCf-FXIN3u12E0RBORYncLdtTOeu-dZPcmNqNByAMOcKcFmqkC5BqUebKQ_5UIQY9CXH5AIQoGwaAPSU_99PrjlaFTSNAxV0nGkE9mM',
    imageAlt: 'A private VIP dining booth with dark navy palette and bronze metallic chamfered table edge',
  },
];

const partySizes = [1, 2, 3, 4, 5, 6, 7, 8, 9, '10+'];
const timeSlots = ['6:00 PM', '7:30 PM', '8:00 PM', '9:30 PM', '10:00 PM', '11:30 PM'];
const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 12).filter((d) => d <= 31);

/* ─── Component ────────────────────────────────────────────────────── */

export function StitchReservationNew({
  zones = defaultZones,
  onBack,
  onClose,
}: Readonly<StitchReservationNewProps>) {
  const { t } = useTranslation();
  const [selectedParty, setSelectedParty] = useState<number | string>(1);
  const [selectedDate, setSelectedDate] = useState(14);
  const [selectedTime, setSelectedTime] = useState('7:30 PM');
  const [selectedZone, setSelectedZone] = useState('rooftop');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Reservation logic placeholder
  };

  return (
    <>
      {/* Top App Bar */}
      <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-[var(--aura-chrome-soft)]/20 bg-[var(--aura-surface-dim)] px-5">
        <button
          type="button"
          className="flex items-center text-[var(--aura-bronze-shimmer)] transition-opacity hover:opacity-80 active:scale-95"
          onClick={onBack}
        >
          <ArrowLeft className="text-[var(--aura-bronze-shimmer)]" />
        </button>
        <h1 className="font-[family-name:var(--aura-display-font)] text-xl uppercase tracking-widest text-[var(--aura-bronze-shimmer)]">
          AURA CAFE
        </h1>
        <button
          type="button"
          className="flex items-center text-[var(--aura-bronze-shimmer)] transition-opacity hover:opacity-80 active:scale-95"
          onClick={onClose}
        >
          <X className="text-[var(--aura-bronze-shimmer)]" />
        </button>
      </header>

      <main className="mx-auto mt-20 max-w-5xl px-5 pb-32 lg:px-16">
        {/* Header Section */}
        <section className="mb-12">
          <h2 className="mb-2 font-[family-name:var(--aura-display-font)] text-3xl text-[var(--aura-chrome-bright)] md:text-4xl">
            Reserve Your Table
          </h2>
          <p className="max-w-md font-[family-name:var(--aura-body-font)] text-base text-[var(--aura-chrome-soft)]">
            Experience industrial elegance and nocturnal sanctuary in the heart of the city.
          </p>
        </section>

        <form className="space-y-12" onSubmit={handleSubmit}>
          {/* Party Size Selector */}
          <section>
            <label className="mb-4 block font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)]">
              Guests
            </label>
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
              {partySizes.map((size) => {
                const isActive = selectedParty === size;
                return (
                  <button
                    key={String(size)}
                    type="button"
                    onClick={() => setSelectedParty(size)}
                    className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl font-[family-name:var(--aura-body-font)] text-sm transition-all ${
                      isActive
                        ? 'bg-[var(--aura-bronze-shimmer)] text-[var(--aura-surface-dim)] shadow-[0_0_15px_rgba(212,165,116,0.3)]'
                        : 'text-[var(--aura-chrome-soft)] hover:border-[var(--aura-bronze-shimmer)]/50'
                    }`}
                    style={
                      isActive
                        ? undefined
                        : {
                            background: 'rgba(26, 38, 53, 0.7)',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(239, 189, 138, 0.1)',
                          }
                    }
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Date & Time Picker */}
          <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="mb-4 block font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)]">
                Date
              </label>
              <div
                className="rounded-xl p-4"
                style={{
                  background: 'rgba(26, 38, 53, 0.7)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(239, 189, 138, 0.1)',
                }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-[family-name:var(--aura-body-font)] text-sm text-[var(--aura-chrome-bright)]">
                    September 2024
                  </span>
                  <div className="flex gap-2">
                    <ChevronLeft className="cursor-pointer text-[var(--aura-chrome-soft)]" size={20} />
                    <ChevronRight className="cursor-pointer text-[var(--aura-chrome-soft)]" size={20} />
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center">
                  {dayLabels.map((day) => (
                    <span
                      key={day}
                      className="font-[family-name:var(--aura-body-font)] text-xs text-[var(--aura-chrome-soft)]/60"
                    >
                      {day}
                    </span>
                  ))}
                  {daysInMonth.map((d) => {
                    const isActive = selectedDate === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setSelectedDate(d)}
                        className={`py-2 font-[family-name:var(--aura-body-font)] text-sm transition-all ${
                          isActive
                            ? 'rounded-lg bg-[var(--aura-bronze-shimmer)] text-[var(--aura-surface-dim)] shadow-[0_0_15px_rgba(212,165,116,0.3)]'
                            : 'text-[var(--aura-chrome-soft)] hover:text-[var(--aura-bronze-shimmer)]'
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div>
              <label className="mb-4 block font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)]">
                Time
              </label>
              <div className="grid grid-cols-2 gap-3">
                {timeSlots.map((time) => {
                  const isActive = selectedTime === time;
                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setSelectedTime(time)}
                      className={`rounded-xl py-4 text-center font-[family-name:var(--aura-body-font)] text-sm transition-all ${
                        isActive
                          ? 'bg-[var(--aura-bronze-shimmer)] text-[var(--aura-surface-dim)] shadow-[0_0_15px_rgba(212,165,116,0.3)]'
                          : 'text-[var(--aura-chrome-soft)] hover:border-[var(--aura-bronze-shimmer)]'
                      }`}
                      style={
                        !isActive
                          ? {
                              background: 'rgba(26, 38, 53, 0.7)',
                              backdropFilter: 'blur(12px)',
                              border: '1px solid rgba(239, 189, 138, 0.1)',
                            }
                          : undefined
                      }
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Zone Selection */}
          <section>
            <label className="mb-4 block font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)]">
              Preferred Zone
            </label>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {zones.map((zone) => {
                const isActive = selectedZone === zone.id;
                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => setSelectedZone(zone.id)}
                    className={`group relative cursor-pointer overflow-hidden rounded-2xl border-2 text-left transition-all ${
                      isActive
                        ? 'border-[var(--aura-bronze-shimmer)]'
                        : 'border-transparent hover:border-[var(--aura-bronze-shimmer)]/30'
                    }`}
                    style={{
                      background: 'rgba(26, 38, 53, 0.7)',
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    <div
                      className="h-40 bg-cover bg-center"
                      style={{ backgroundImage: `url('${zone.imageUrl}')` }}
                      aria-label={zone.imageAlt}
                    />
                    <div className="p-4">
                      <h4 className="mb-1 font-[family-name:var(--aura-display-font)] text-sm uppercase text-[var(--aura-bronze-shimmer)]">
                        {zone.name}
                      </h4>
                      <p className="font-[family-name:var(--aura-body-font)] text-xs text-[var(--aura-chrome-soft)]">
                        {zone.description}
                      </p>
                    </div>
                    <div
                      className={`absolute right-2 top-2 transition-opacity ${
                        isActive ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      <CheckCircle
                        className="text-[var(--aura-bronze-shimmer)]"
                        size={24}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Contact Information */}
          <section className="max-w-2xl">
            <label className="mb-6 block font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)]">
              Contact Information
            </label>
            <div className="space-y-6">
              <div className="relative">
                <label className="absolute -top-2.5 left-4 z-10 bg-[var(--aura-surface-dim)] px-2 font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-chrome-soft)]">
                  Full Name
                </label>
                <input
                  className="w-full rounded-xl border border-[var(--aura-chrome-soft)]/30 bg-[var(--aura-surface-container)] px-6 py-4 font-[family-name:var(--aura-body-font)] text-base text-[var(--aura-chrome-bright)] outline-none transition-all placeholder:text-[var(--aura-chrome-soft)]/50 focus:border-[var(--aura-bronze-shimmer)] focus:ring-1 focus:ring-[var(--aura-bronze-shimmer)]"
                  placeholder="John Doe"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="relative">
                  <label className="absolute -top-2.5 left-4 z-10 bg-[var(--aura-surface-dim)] px-2 font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-chrome-soft)]">
                    Phone
                  </label>
                  <input
                    className="w-full rounded-xl border border-[var(--aura-chrome-soft)]/30 bg-[var(--aura-surface-container)] px-6 py-4 font-[family-name:var(--aura-body-font)] text-base text-[var(--aura-chrome-bright)] outline-none transition-all placeholder:text-[var(--aura-chrome-soft)]/50 focus:border-[var(--aura-bronze-shimmer)] focus:ring-1 focus:ring-[var(--aura-bronze-shimmer)]"
                    placeholder="+1 (555) 000-0000"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <label className="absolute -top-2.5 left-4 z-10 bg-[var(--aura-surface-dim)] px-2 font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-chrome-soft)]">
                    Email
                  </label>
                  <input
                    className="w-full rounded-xl border border-[var(--aura-chrome-soft)]/30 bg-[var(--aura-surface-container)] px-6 py-4 font-[family-name:var(--aura-body-font)] text-base text-[var(--aura-chrome-bright)] outline-none transition-all placeholder:text-[var(--aura-chrome-soft)]/50 focus:border-[var(--aura-bronze-shimmer)] focus:ring-1 focus:ring-[var(--aura-bronze-shimmer)]"
                    placeholder="john@example.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* CTA Button */}
          <section className="pt-8">
            <button
              type="submit"
              className="mx-auto flex w-full items-center justify-center gap-3 rounded-full bg-[var(--aura-bronze-shimmer)] px-12 py-5 font-[family-name:var(--aura-display-font)] text-sm uppercase tracking-wider text-[var(--aura-surface-dim)] shadow-[0_0_15px_rgba(212,165,116,0.3)] transition-all hover:opacity-90 active:scale-95 md:w-auto md:min-w-[300px]"
            >
              Confirm Reservation
              <ArrowRight size={20} />
            </button>
            <p className="mt-6 text-center font-[family-name:var(--aura-body-font)] text-xs text-[var(--aura-chrome-soft)]">
              No cancellation fee up to 2 hours before the booking.
            </p>
          </section>
        </form>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-xl border-t border-[var(--aura-chrome-soft)]/10 bg-[var(--aura-surface-container)] px-4 pb-6 pt-3 shadow-lg">
        <button
          type="button"
          className="flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] transition-colors hover:text-[var(--aura-bronze-shimmer)] active:scale-90"
        >
          <span className="material-symbols-outlined mb-1">restaurant_menu</span>
          <span className="font-[family-name:var(--aura-body-font)] text-xs uppercase">Menu</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center justify-center rounded-xl bg-[var(--aura-bronze-shimmer)]/20 px-4 py-1 text-[var(--aura-bronze-shimmer)] active:scale-90"
        >
          <span
            className="material-symbols-outlined mb-1"
            style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}
          >
            event_seat
          </span>
          <span className="font-[family-name:var(--aura-body-font)] text-xs uppercase">Reservations</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] transition-colors hover:text-[var(--aura-bronze-shimmer)] active:scale-90"
        >
          <span className="material-symbols-outlined mb-1">person</span>
          <span className="font-[family-name:var(--aura-body-font)] text-xs uppercase">Profile</span>
        </button>
      </nav>
    </>
  );
}
