import { useState, useEffect, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════════
useSWRegistration — global Service Worker registration.
Registers /sw.js on mount, listens for controllerchange to detect SW updates.
Use with <SWUpdatePrompt /> in main.tsx.
═══════════════════════════════════════════════════════════════════ */

export function useSWRegistration() {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const serviceWorker = navigator.serviceWorker;

    // Never register SW in Vite dev mode: stale cache-first .js/index.html entries
    // cause blank screens across dev server restarts or branch switches.
    // Actively unregister any previously installed dev SW so local tabs self-heal.
    if (import.meta.env.MODE === 'development') {
      if (typeof serviceWorker.getRegistrations === 'function') {
        serviceWorker
          .getRegistrations()
          .then((regs) => Promise.all(regs.map((r) => r.unregister())))
          .catch(() => {});
      }
      if (typeof caches !== 'undefined') {
        caches
          .keys()
          .then((keys) =>
            Promise.all(keys.filter((k) => k.startsWith('aura-')).map((k) => caches.delete(k)))
          )
          .catch(() => {});
      }
      return;
    }

    let disposed = false;
    let observedRegistration: ServiceWorkerRegistration | null = null;
    let releaseRegistration = () => {};

    const attachUpdateListener = (reg: ServiceWorkerRegistration) => {
      // Both promises may resolve to the same registration, including after cleanup.
      if (disposed || observedRegistration === reg) return;
      releaseRegistration();
      observedRegistration = reg;
      setRegistration(reg);
      if (reg.waiting) {
        setIsUpdateAvailable(true);
      }

      let installing: ServiceWorker | null = null;
      const handleStateChange = () => {
        if (!disposed && observedRegistration === reg && installing?.state === 'installed' && serviceWorker.controller) {
          setIsUpdateAvailable(true);
        }
      };
      const handleUpdateFound = () => {
        if (disposed || observedRegistration !== reg || installing === reg.installing) return;
        installing?.removeEventListener('statechange', handleStateChange);
        installing = reg.installing;
        installing?.addEventListener('statechange', handleStateChange);
        handleStateChange();
      };
      reg.addEventListener?.('updatefound', handleUpdateFound);
      handleUpdateFound();
      releaseRegistration = () => {
        reg.removeEventListener?.('updatefound', handleUpdateFound);
        installing?.removeEventListener('statechange', handleStateChange);
        installing = null;
      };
    };

    if (typeof serviceWorker.register === 'function') {
      serviceWorker
        .register('/sw.js')
        .then(attachUpdateListener)
        .catch(() => {
          // non-fatal: SW may not be available in dev
        });
    }

    if (serviceWorker.ready) {
      serviceWorker.ready
        .then(attachUpdateListener)
        .catch(() => {
          // non-fatal: SW may not be available in dev
        });
    }

    const handler = () => { if (!disposed) setIsUpdateAvailable(true); };
    serviceWorker.addEventListener('controllerchange', handler);
    return () => {
      disposed = true;
      serviceWorker.removeEventListener('controllerchange', handler);
      releaseRegistration();
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
