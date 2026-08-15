/**
 * StitchCheckinNew — Custom hooks
 */

import { useState } from 'react';
import type { StitchCheckinNewProps } from './StitchCheckinNew-types';

/** Format phone number as (XXX) XXX-XXXX */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  const match = digits.match(/(\d{0,3})(\d{0,3})(\d{0,4})/);
  if (!match) return digits;
  const p1 = match[1] ?? '';
  const p2 = match[2] ?? '';
  const p3 = match[3] ?? '';
  if (!p2) return p1;
  return `(${p1}) ${p2}${p3 ? `-${p3}` : ''}`;
}

/** Encapsulates phone input state and submit logic */
export function useCheckinForm(onCheckin?: StitchCheckinNewProps['onCheckin']) {
  const [phone, setPhone] = useState('');

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleSubmit = () => {
    const raw = phone.replace(/\D/g, '');
    if (raw.length >= 10) {
      onCheckin?.(raw);
    }
  };

  return { phone, handlePhoneChange, handleSubmit };
}
