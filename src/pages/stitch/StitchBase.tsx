import React from 'react';

interface StitchShellProps {
  children: React.ReactNode;
}

export function StitchShell({ children }: StitchShellProps) {
  return <>{children}</>;
}

export function StitchNav() {
  return null;
}
