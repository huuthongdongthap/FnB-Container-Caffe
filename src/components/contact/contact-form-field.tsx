import { cn } from '@/lib/cn';

interface ContactFormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  touched?: boolean;
  as?: 'input' | 'textarea';
  type?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  placeholder?: string;
  rows?: number;
  ariaDescribedBy?: string;
}

const inputClasses = cn(
  'w-full rounded-xl border bg-background px-4 py-3 text-sm text-foreground',
  'placeholder:text-muted/50 transition-colors duration-200',
  'focus:outline-none focus:ring-2 focus:ring-accent/40',
);

export function ContactFormField({
  id,
  label,
  required = false,
  error,
  touched = false,
  as = 'input',
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  rows,
}: ContactFormFieldProps) {
  const hasError = !!error && touched;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-foreground"
      >
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {as === 'textarea' ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          rows={rows}
          className={cn(inputClasses, 'resize-y', hasError ? 'border-destructive' : 'border-border')}
          aria-invalid={hasError}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className={cn(inputClasses, hasError ? 'border-destructive' : 'border-border')}
          aria-invalid={hasError}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      )}
      {hasError && (
        <p id={`${id}-error`} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
