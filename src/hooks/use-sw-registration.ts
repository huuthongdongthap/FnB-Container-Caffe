import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/* ═══════════════════════════════════════════════════════════════════
useSWRegistration — global Service Worker registration.
Registers /sw.js on mount, listens for controllerchange to detect SW updates.
Use with <SWUpdatePrompt /> in main.tsx.
═══════════════════════════════════════════════════════════════════ */

export function useSWRegistration() {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const { t } = useTranslation('pwa');

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready
      .then((reg) => {
        setRegistration(reg);
      })
      .catch(() => {
        // non-fatal: SW may not be available in dev
      });

    const handler = () => setIsUpdateAvailable(true);
    navigator.serviceWorker.addEventListener('controllerchange', handler);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handler);
    };
  }, []);

  const skipWaiting = useCallback(() => {
    if (registration?.active) {
      registration.active.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [registration]);

  return { isUpdateAvailable, skipWaiting, registration };
}
