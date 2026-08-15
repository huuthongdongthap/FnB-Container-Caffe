import { useState } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader } from '@/components/stitch/StitchLayout';
import { PartySizeSelector } from './party-size-selector';
import { DateTimePicker } from './date-time-picker';
import { ZoneSelector } from './zone-selector';
import { ContactInfoForm } from './contact-info-form';
import { BottomNav } from './bottom-nav';
import { ReservationStyles } from './reservation-new-styles';

// Re-exports for backward compatibility
export type { Zone } from './reservation-new-constants';
export { GUEST_OPTIONS, TIMES, WEEK_DAYS, ZONES } from './reservation-new-constants';

export default function ReservationNew() {
  const [selectedParty, setSelectedParty] = useState('1');
  const [selectedTime, setSelectedTime] = useState('7:30 PM');
  const [selectedZone, setSelectedZone] = useState(3);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Reservation submission handler — no console.log
    void 0;
  };

  return (
    <StitchShell>
      <PageHeader brand="AURA CAFE" scrollEffect />

      <main className="mt-20 mb-32 max-w-container-max mx-auto px-5 lg:px-16">
        <form onSubmit={handleSubmit} className="space-y-12">
          <section className="mb-12">
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
              Reserve Your Table
            </h2>
            <p className="text-on-surface-variant font-body-md max-w-md">
              Experience industrial elegance and nocturnal sanctuary in the heart of the city.
            </p>
          </section>

          <PartySizeSelector selectedParty={selectedParty} onSelect={setSelectedParty} />
          <DateTimePicker selectedTime={selectedTime} onSelectTime={setSelectedTime} />
          <ZoneSelector selectedZone={selectedZone} onSelect={setSelectedZone} />
          <ContactInfoForm />

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

      <BottomNav />
      <ReservationStyles />
    </StitchShell>
  );
}
