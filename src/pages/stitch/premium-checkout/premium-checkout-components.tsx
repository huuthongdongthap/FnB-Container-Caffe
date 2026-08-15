import { useState } from 'react';
import type { FieldProps } from './premium-checkout-types';

export function Field({ label, type, placeholder, rows = 3 }: FieldProps) {
  const [focused, setFocused] = useState(false);

  const inputClass = [
    'w-full bg-[#111c2d] border-b border-outline/30 px-4 py-3 text-[var(--aura-chrome-bright)] transition-all rounded-t-sm',
    focused ? 'border-[var(--aura-tertiary)] scale-[1.01]' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-2">
      <label className="font-body text-xs uppercase tracking-widest text-[var(--aura-chrome-dark)]">
        {label}
      </label>
      {type === 'textarea' ? (
        <textarea
          className={inputClass}
          placeholder={placeholder}
          rows={rows}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      ) : (
        <input
          className={inputClass}
          placeholder={placeholder}
          type={type}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      )}
    </div>
  );
}

export function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[var(--aura-chrome-dark)]">
      <span className="font-body text-xs uppercase tracking-wider">{label}</span>
      <span className="font-body text-xs uppercase tracking-wider">{value}</span>
    </div>
  );
}
