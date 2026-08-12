import React from 'react';

interface StitchShellProps {
  children: React.ReactNode;
}

export function StitchShell({ children }: StitchShellProps) {
  return <>{children}</>;
}

interface StitchNavProps {
  ctaLabel?: string;
}

export function StitchNav({ ctaLabel }: StitchNavProps) {
  return null;
}
