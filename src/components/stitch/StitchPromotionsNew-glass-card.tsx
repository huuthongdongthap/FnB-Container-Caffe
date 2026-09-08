/**
 * Reusable glass-morphism card wrapper used across all promo cards.
 */
import type { ReactNode } from 'react';

const glassStyle: React.CSSProperties = {
  background: 'color-mix(in srgb, var(--aura-chrome-light, #c6c6c7) 10%, transparent)',
  backdropFilter: 'blur(8px)',
  borderTop: '1px solid color-mix(in srgb, var(--aura-chrome-light, #c6c6c7) 30%, transparent)',
  borderLeft: '1px solid color-mix(in srgb, var(--aura-chrome-light, #c6c6c7) 30%, transparent)',
  borderBottom: '1px solid color-mix(in srgb, var(--aura-glass-border, #bbC7de) 10%, transparent)',
  borderRight: '1px solid color-mix(in srgb, var(--aura-glass-border, #bbC7de) 10%, transparent)',
};

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function GlassCard({ children, className, style }: GlassCardProps) {
  return (
    <div className={className} style={{ ...glassStyle, ...style }}>
      {children}
    </div>
  );
}

/** Hero-specific glass card with a bronze shimmer box-shadow. */
export function HeroGlassCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        ...glassStyle,
        boxShadow: '0 0 20px 0 color-mix(in srgb, var(--aura-chrome-light, #d4a574) 15%, transparent)',
      }}
    >
      {children}
    </div>
  );
}
