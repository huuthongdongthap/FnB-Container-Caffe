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

import type { ZoneData, StitchReservationNewProps } from './StitchReservationNew-types';
import { defaultZones } from './StitchReservationNew-data';
import {
  TopAppBar,
  PartySizeSelector,
  ZoneSelector,
  CTASection,
  BottomNav,
} from './StitchReservationNew-components';
import {
  DatePicker,
  TimePicker,
  ContactForm,
} from './StitchReservationNew-form';

export type { ZoneData, StitchReservationNewProps } from './StitchReservationNew-types';

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
  };

  return (
    <>
      <TopAppBar onBack={onBack} onClose={onClose} />
      <main className="mx-auto mt-20 max-w-5xl px-5 pb-32 lg:px-16">
        <section className="mb-12">
          <h2 className="mb-2 font-[family-name:var(--aura-display-font)] text-3xl text-[var(--aura-chrome-bright)] md:text-4xl">
            Reserve Your Table
          </h2>
          <p className="max-w-md font-[family-name:var(--aura-body-font)] text-base text-[var(--aura-chrome-soft)]">
            Experience industrial elegance and nocturnal sanctuary in the heart of the city.
          </p>
        </section>
        <form className="space-y-12" onSubmit={handleSubmit}>
          <PartySizeSelector selectedParty={selectedParty} onSelect={setSelectedParty} />
          <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DatePicker selectedDate={selectedDate} onSelect={setSelectedDate} />
            <TimePicker selectedTime={selectedTime} onSelect={setSelectedTime} />
          </section>
          <ZoneSelector zones={zones} selectedZone={selectedZone} onSelect={setSelectedZone} />
          <ContactForm
            fullName={fullName} onFullNameChange={setFullName}
            phone={phone} onPhoneChange={setPhone}
            email={email} onEmailChange={setEmail}
          />
          <CTASection />
        </form>
      </main>
      <BottomNav />
    </>
  );
}
