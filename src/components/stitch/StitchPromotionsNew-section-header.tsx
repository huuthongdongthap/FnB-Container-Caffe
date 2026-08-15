/**
 * Reusable section header with a bronze left-border accent.
 */

interface SectionHeaderProps {
  title: string;
}

export function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <h3 className="border-l-2 border-[var(--aura-bronze-shimmer)] pl-4 font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.3em] text-[var(--aura-chrome-soft)]">
      {title}
    </h3>
  );
}
