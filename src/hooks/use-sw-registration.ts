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

    const attachUpdateListener = (reg: ServiceWorkerRegistration) => {
      setRegistration(reg);
      if (reg.waiting) {
        setIsUpdateAvailable(true);
      }
      reg.addEventListener?.('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setIsUpdateAvailable(true);
          }
        });
      });
    };

    if (typeof navigator.serviceWorker.register === 'function') {
      navigator.serviceWorker
        .register('/sw.js')
        .then(attachUpdateListener)
        .catch(() => {
          // non-fatal: SW may not be available in dev
        });
    }

    if (navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready
        .then(attachUpdateListener)
        .catch(() => {
          // non-fatal: SW may not be available in dev
        });
    }

    const handler = () => setIsUpdateAvailable(true);
    navigator.serviceWorker.addEventListener('controllerchange', handler);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handler);
    };
  }, []);

  const skipWaiting = useCallback(() => {
    const target = registration?.waiting || registration?.active;
    if (target) {
      target.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [registration]);

  return { isUpdateAvailable, skipWaiting, registration };
}
