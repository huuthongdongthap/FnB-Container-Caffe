import { useEffect, useState } from 'react';
import { darkTokens, lightTokens, type ThemeTokens } from './aura-tokens';

export function useAuraTheme(): ThemeTokens {
  const [prefersDark, setPrefersDark] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setPrefersDark(mq.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersDark(e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // AURA is dark-only; always return darkTokens regardless of system preference.
  void prefersDark;
  void lightTokens;
  return darkTokens;
}
