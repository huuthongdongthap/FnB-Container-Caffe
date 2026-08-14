import { useState } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

const GUEST_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10+'] as const;
const TIMES = ['6:00 PM', '7:30 PM', '8:00 PM', '9:30 PM', '10:00 PM', '11:30 PM'] as const;
const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

interface Zone {
  id: number;
  name: string;
  desc: string;
  image: string;
  alt: string;
}

const ZONES: Zone[] = [
  {
    id: 1,
    name: 'Indoor',
    desc: 'Lush velvet & industrial vibes.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBszs99tbK7fqZ7HnmelulFYenGNCV7_dslfT03Yt6L7M6NnGiW_90PbeKkp1e7XB7l9XElwVfcAllaFbMxQmCIKYjgqRhA-kXNO4kZ7kSAC6s_sU0hJb414vr0S2YTuDY2-u6aUFFRrkdt97_PFKsDi1oMsedxg14Zw6o2j3vhfsRTIoKkaT1h3xLKlgA5VwjebVZ3NjyqrlcNBdPbsUK62rC67byLwxsmw2a4Y7MbSds-WdEfQGyI_iWJbax2yWRVZZS_k1-kvHY',
    alt: 'A moody, high-end indoor cafe interior with industrial exposed piping, warm Edison bulb lighting, and dark velvet seating.',
  },
  {
    id: 2,
    name: 'Outdoor',
    desc: 'Garden breeze & fire pits.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAg8_hRBmi1lfY0mHVxF7GBPEThuDkSmjkyLi-lhKYI0um0WM0pi38bGpNuouwKE6AcpTxp1pe8L0y3-NzC1dJo0ZvJkXG_2G238Kcn8PIgw_59Bv4nMij3zXdmV-ow6IdpP4RGMfpbL8CqCg-Yi4KDr3F0obMjKWeNRy0o4IboNUl1mM9evxrnHlTjf1cnEarKg0MtlBrpHyoEaOCQbACbBnZciRkb_Nd8yMRrJhe9AIoIhDHVwQgBpBQ8IYdWNnPcy20k_FZJkVA',
    alt: 'An elegant outdoor dining terrace at night with minimalist architectural lines, scattered fire pits, and warm golden lighting.',
  },
  {
    id: 3,
    name: 'Rooftop',
    desc: 'City views & night breeze.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCzR8JSSqjy5uuVxcUbh3KpRQ_9AvzmU6-bl2Xu7Hat7PINhwHSMuZqJItpmd8ZCB61i8ZwHfZ7FNP4bMXqayTiy41YmhlHxkTDdRNs1Pusx7CRY-SY_mODLoRdWlwgn_IJ1bccEVJyLANDSHrJSXu_ez6GvrsuxtYr-xdSWcicKCcbcADqeJlhfpDvTpTTDaaxzFn74v3lqWta3UdxQ2G10TK5JO2QU4dpRAR5Nw47YTNK36xK4ev0f1aC0L_ZwudpEgbedy9joJk',
    alt: 'A stunning rooftop bar view overlooking a metropolitan skyline at night with glass railings, bronze metallic finishes, and soft ambient glowing lights.',
  },
  {
    id: 4,
    name: 'VIP Lounge',
    desc: 'Private booths & top service.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDsdSwKBQ0_Axy1FxGSHQE9a7Ty-l2SoOrOYSH2yqLzR2vEmEZ3VkPnJ5wbYon4864M6PNgiSna9eg0CY-pI9vW4rU9p68R-JTIbUBhQQzn9WhnpB1R6OGPXbgzxisVtcaWhG06kDsa3ALwCO5QyMm2FyuwmiWAm2X1l8xfJCf-FXIN3u12E0RBORYncLdtTOeu-dZPcmNqNByAMOcKcFmqkC5BqUebKQ_5UIQY9CXH5AIQoGwaAPSU_99PrjlaFTSNAxV0nGkE9mM',
    alt: 'A private VIP dining booth with a dramatic dark navy color palette and a bronze metallic chamfered table edge with focused theatrical lighting.',
  },
] as const;

export default function ReservationNew() {
  const [selectedParty, setSelectedParty] = useState('1');
  const [selectedTime, setSelectedTime] = useState('7:30 PM');
  const [selectedZone, setSelectedZone] = useState(3); // Rooftop default

  const handleSelectParty = (guest: string) => setSelectedParty(guest);
  const handleSelectTime = (time: string) => setSelectedTime(time);
  const handleSelectZone = (zoneId: number) => setSelectedZone(zoneId);
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Reservation submission handler — no console.log
    void 0;
  };

  return (
    <StitchShell>
      {/* TopAppBar */}
<PageHeader brand="AURA CAFE" scrollEffect />

      <main className="mt-20 mb-32 max-w-container-max mx-auto px-5 lg:px-16">
        <form onSubmit={handleSubmit} className="space-y-12">
          {/* Header */}
          <section className="mb-12">
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
              Reserve Your Table
            </h2>
            <p className="text-on-surface-variant font-body-md max-w-md">
              Experience industrial elegance and nocturnal sanctuary in the heart of the city.
            </p>
          </section>

          {/* Party Size */}
          <section>
            <label className="block font-label-sm text-label-sm uppercase mb-4 text-secondary">Guests</label>
            <div className="flex space-x-3 overflow-x-auto no-scrollbar pb-2">
              {GUEST_OPTIONS.map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => handleSelectParty(g)}
                  className={`flex-shrink-0 w-12 h-12 rounded-xl glass-panel flex items-center justify-center font-label-md text-label-md transition-all ${
                    selectedParty === g
                      ? 'active-pill bronze-glow'
                      : 'text-on-surface-variant hover:border-secondary/50'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </section>

          {/* Date & Time */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block font-label-sm text-label-sm uppercase mb-4 text-secondary">Date</label>
              <div className="glass-panel rounded-xl p-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-label-md text-label-md text-on-surface">September 2024</span>
                  <div className="flex space-x-2">
                    <span className="material-symbols-outlined text-on-surface-variant cursor-pointer">chevron_left</span>
                    <span className="material-symbols-outlined text-on-surface-variant cursor-pointer">chevron_right</span>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center">
                  {WEEK_DAYS.map(d => (
                    <span key={d} className="font-label-sm text-label-sm text-outline">{d}</span>
                  ))}
                  {['12', '13', '14', '15', '16', '17', '18'].map((day, i) => (
                    <button
                      key={day}
                      type="button"
                      className={`py-2 ${
                        i === 2
                          ? 'active-pill bronze-glow rounded-lg'
                          : 'text-on-surface-variant hover:text-secondary'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block font-label-sm text-label-sm uppercase mb-4 text-secondary">Time</label>
              <div className="grid grid-cols-2 gap-3">
                {TIMES.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleSelectTime(t)}
                    className={`glass-panel py-4 rounded-xl text-center font-label-md text-label-md transition-all ${
                      selectedTime === t ? 'active-pill bronze-glow' : 'text-on-surface-variant hover:border-secondary'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Zone Selection */}
          <section>
            <label className="block font-label-sm text-label-sm uppercase mb-4 text-secondary">Preferred Zone</label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {ZONES.map(z => (
                <div
                  key={z.id}
                  onClick={() => handleSelectZone(z.id)}
                  className={`group cursor-pointer glass-panel rounded-2xl overflow-hidden transition-all border-2 relative ${
                    selectedZone === z.id ? 'border-[var(--aura-tertiary)] selected' : 'border-transparent hover:border-secondary/30'
                  }`}
                >
                  <div
                    className="h-40 bg-cover bg-center"
                    role="img"
                    aria-label={z.alt}
                    style={{ backgroundImage: `url('${z.image}')` }}
                  />
                  <div className="p-4">
                    <h4 className="font-headline-md text-label-md text-secondary uppercase mb-1">{z.name}</h4>
                    <p className="font-body-md text-label-sm text-on-surface-variant">{z.desc}</p>
                  </div>
                  <div className={`absolute top-2 right-2 transition-opacity ${selectedZone === z.id ? 'opacity-100' : 'opacity-0'}`}>
                    <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Contact Info */}
          <section className="max-w-2xl">
            <label className="block font-label-sm text-label-sm uppercase mb-6 text-secondary">Contact Information</label>
            <div className="space-y-6">
              <div className="relative">
                <label className="font-label-sm text-label-sm uppercase text-on-surface-variant absolute -top-2.5 left-4 px-2 bg-[#081425] z-10" htmlFor="fullname">
                  Full Name
                </label>
                <input
                  id="fullname"
                  className="w-full bg-[#1A2635] border border-outline-variant/30 rounded-xl px-6 py-4 text-on-surface focus:border-[var(--aura-tertiary)] focus:ring-1 focus:ring-[var(--aura-tertiary)] outline-none transition-all placeholder:text-outline/50"
                  placeholder="John Doe"
                  type="text"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative">
                  <label className="font-label-sm text-label-sm uppercase text-on-surface-variant absolute -top-2.5 left-4 px-2 bg-[#081425] z-10" htmlFor="phone">
                    Phone
                  </label>
                  <input
                    id="phone"
                    className="w-full bg-[#1A2635] border border-outline-variant/30 rounded-xl px-6 py-4 text-on-surface focus:border-[var(--aura-tertiary)] focus:ring-1 focus:ring-[var(--aura-tertiary)] outline-none transition-all placeholder:text-outline/50"
                    placeholder="+1 (555) 000-0000"
                    type="tel"
                  />
                </div>
                <div className="relative">
                  <label className="font-label-sm text-label-sm uppercase text-on-surface-variant absolute -top-2.5 left-4 px-2 bg-[#081425] z-10" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    className="w-full bg-[#1A2635] border border-outline-variant/30 rounded-xl px-6 py-4 text-on-surface focus:border-[var(--aura-tertiary)] focus:ring-1 focus:ring-[var(--aura-tertiary)] outline-none transition-all placeholder:text-outline/50"
                    placeholder="john@example.com"
                    type="email"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="pt-8">
            <button
              type="submit"
              className="w-full md:w-auto md:min-w-[300px] bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-headline-md text-label-md uppercase py-5 px-12 rounded-full hover:opacity-90 active:scale-95 transition-all bronze-glow flex items-center justify-center gap-3 mx-auto"
            >
              Confirm Reservation
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
            <p className="text-center mt-6 text-on-surface-variant text-label-sm font-label-sm">
              No cancellation fee up to 2 hours before the booking.
            </p>
          </section>
        </form>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-3 pb-safe bg-[var(--aura-surface-container)] border-t border-outline-variant/10 shadow-lg rounded-t-xl">
        <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant hover:text-secondary transition-colors active:scale-90 transition-transform">
          <span className="material-symbols-outlined mb-1">restaurant_menu</span>
          <span className="font-label-sm text-label-sm uppercase">Menu</span>
        </a>
        <a href="#" className="flex flex-col items-center justify-center text-secondary bg-secondary-container/20 rounded-xl px-4 py-1 active:scale-90 transition-transform">
          <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: "'FILL' 1" }}>
            event_seat
          </span>
          <span className="font-label-sm text-label-sm uppercase">Reservations</span>
        </a>
        <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant hover:text-secondary transition-colors active:scale-90 transition-transform">
          <span className="material-symbols-outlined mb-1">person</span>
          <span className="font-label-sm text-label-sm uppercase">Profile</span>
        </a>
      </nav>

      <style>{`
        .active-pill {
          background: #efbd8a;
          color: #081425;
        }
        .bronze-glow {
          box-shadow: 0 0 15px rgba(212, 165, 116, 0.3);
        }
        .metallic-divider {
          height: 1px;
          width: 100%;
          background: linear-gradient(90deg, transparent 0%, #c6c6c7 50%, transparent 100%);
          opacity: 0.2;
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </StitchShell>
  );
}
