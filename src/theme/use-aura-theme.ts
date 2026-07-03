import { useEffect, useState } from 'react';
import { darkTokens, type ThemeTokens } from './aura-tokens';

export function useAuraTheme(): ThemeTokens {
  const [prefersDark] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    void mq;
  }, []);

  // AURA is dark-only; always return darkTokens regardless of system preference.
  void prefersDark;
  return darkTokens;
}
