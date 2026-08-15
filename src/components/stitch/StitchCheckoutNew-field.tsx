import { cn } from '@/lib/cn';
import { inputClasses } from './StitchCheckoutNew-utils';

interface FieldProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  multiline?: boolean;
  rows?: number;
}

export function Field({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  multiline = false,
  rows = 3,
}: Readonly<FieldProps>) {
  const fieldId = `checkout-field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const sharedClasses = cn(
    inputClasses,
    value && 'border-[var(--aura-chrome-bright)]',
    'focus:outline-none focus:shadow-[0_4px_12px_-4px_color-mix(in_srgb,var(--aura-chrome-bright)_30%,transparent)]',
  );

  const handleFocus = (e: React.FocusEvent<HTMLElement>) => {
    const parent = (e.target as HTMLElement).parentElement;
    if (parent) parent.classList.add('scale-[1.01]');
  };

  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    const parent = (e.target as HTMLElement).parentElement;
    if (parent) parent.classList.remove('scale-[1.01]');
  };

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={fieldId}
        className="font-['Space_Grotesk'] text-[14px] leading-[1.2] font-medium tracking-[0.1em] uppercase text-[var(--aura-chrome-soft)]"
      >
        {label}
      </label>
      {multiline ? (
        <textarea
          id={fieldId}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          rows={rows}
          className={cn('resize-none', sharedClasses)}
          aria-label={label}
        />
      ) : (
        <input
          id={fieldId}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={sharedClasses}
          aria-label={label}
        />
      )}
    </div>
  );
}
