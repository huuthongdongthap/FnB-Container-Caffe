/**
 * Reusable glass-morphism card wrapper used across all promo cards.
 */
import type { ReactNode } from 'react';

const glassStyle: React.CSSProperties = {
  background: 'rgba(198, 198, 199, 0.1)',
  backdropFilter: 'blur(24px)',
  borderTop: '1px solid rgba(198, 198, 199, 0.3)',
  borderLeft: '1px solid rgba(198, 198, 199, 0.3)',
  borderBottom: '1px solid rgba(187, 199, 222, 0.1)',
  borderRight: '1px solid rgba(187, 199, 222, 0.1)',
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
        boxShadow: '0 0 20px 0 rgba(212, 165, 116, 0.15)',
      }}
    >
      {children}
    </div>
  );
}
