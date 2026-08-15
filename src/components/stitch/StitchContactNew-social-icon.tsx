/**
 * StitchContactNew — SocialIconButton sub-component
 */

export function SocialIconButton({
  icon: Icon,
  onClick,
  label,
}: {
  icon: React.ElementType;
  onClick?: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 border border-[var(--aura-chrome-bright)]/20 flex items-center justify-center hover:bg-[var(--aura-bronze-shimmer)] hover:text-white/90 transition-all"
      aria-label={label}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
