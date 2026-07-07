import { cn } from '@/lib/cn';

interface SwitchProps {
  label?: string;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (e: { target: { checked: boolean }; currentTarget: { checked: boolean } }) => void;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}

export function Switch({
  className,
  label,
  checked,
  onChange,
  onCheckedChange,
  ...rest
}: SwitchProps) {
  const handleClick = () => {
    const next = !checked;
    if (typeof onCheckedChange === 'function') onCheckedChange(next);
    if (typeof onChange === 'function') {
      onChange({ target: { checked: next }, currentTarget: { checked: next } } as {
        target: { checked: boolean };
        currentTarget: { checked: boolean };
      });
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      onClick={handleClick}
      disabled={rest.disabled}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        checked ? 'bg-accent' : 'bg-muted',
        className
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}

Switch.displayName = 'Switch';
