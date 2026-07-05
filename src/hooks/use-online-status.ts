import { useState, useEffect } from 'react';

/* ═══════════════════════════════════════════════════════════════════
Online Status — tracks navigator.onLine + online/offline events.
Returns:
  isOnline   – current connectivity state (default: navigator.onLine)
  wasOffline – flips true once when reconnecting, resets after first render online
═══════════════════════════════════════════════════════════════════ */

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    () => typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true); // signal the reconnect event one time
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}
