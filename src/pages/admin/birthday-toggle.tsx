export function Toggle({
  checked,
  onChange,
  label,
  hint,
  id,
  t,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  id: string;
  t: (key: string) => string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex-1">
        <label htmlFor={id} className="text-sm font-medium text-[var(--aura-text-primary)] cursor-pointer">
          {label}
        </label>
        {hint && <p className="text-xs text-[var(--aura-chrome-dark)] mt-0.5">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aura-chrome-light)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--aura-noir-deep)] ${checked ? 'bg-[var(--aura-forest-primary)]' : 'bg-[var(--aura-noir-steel)]'}`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
      <span className="text-xs font-medium text-[var(--aura-chrome-mid)] min-w-[2rem] text-right self-center">
        {checked ? t('adminBirthday.enabledLabel') : t('adminLogin.cancelButton') || 'Tắt'}
      </span>
    </div>
  );
}
