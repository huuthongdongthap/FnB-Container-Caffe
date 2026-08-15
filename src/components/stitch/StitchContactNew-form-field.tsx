/**
 * StitchContactNew — FormField sub-component
 */
'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

const inputClasses =
  "w-full bg-transparent border-0 border-b py-2 text-[var(--aura-chrome-bright)] outline-none transition-colors placeholder:text-[var(--aura-chrome-soft)]/40 font-['Space_Grotesk']";

export function FormField({
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
  multiline,
}: {
  label: string;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const hasValue = value.length > 0;
  const showBronze = focused || hasValue;

  return (
    <div className="group">
      <label
        className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase block mb-1 transition-colors"
        style={{ color: showBronze ? 'var(--aura-bronze-shimmer)' : 'var(--aura-chrome-soft)' }}
      >
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          rows={4}
          className={cn(inputClasses, 'resize-none')}
          style={{ borderBottomColor: showBronze ? 'var(--aura-bronze-shimmer)' : 'var(--aura-chrome-bright)/30' }}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className={inputClasses}
          style={{ borderBottomColor: showBronze ? 'var(--aura-bronze-shimmer)' : 'var(--aura-chrome-bright)/30' }}
        />
      )}
    </div>
  );
}
