'use client';

import { useEffect, useRef } from 'react';

export function useKdsAudio(
  orderIds: readonly string[],
  enabled: boolean,
  isLoading = false,
  resetKey?: string,
): void {
  const seenIdsRef = useRef<Set<string> | null>(null);
  const prevResetKeyRef = useRef(resetKey);

  useEffect(() => {
    if (prevResetKeyRef.current !== resetKey) {
      prevResetKeyRef.current = resetKey;
      seenIdsRef.current = null;
    }

    if (isLoading) return;

    const currentIds = new Set(orderIds);

    // Initial non-loading snapshot (or first snapshot after station switch):
    // record existing orders without triggering a false beep.
    if (seenIdsRef.current === null) {
      seenIdsRef.current = currentIds;
      return;
    }

    let hasNewOrder = false;
    for (const id of currentIds) {
      if (!seenIdsRef.current.has(id)) {
        hasNewOrder = true;
        break;
      }
    }

    let adminSoundAllowed = true;
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('aura_admin_sound_alerts');
        if (stored === '0') {
          adminSoundAllowed = false;
        }
      }
    } catch {
      // Ignore storage access errors
    }

    if (enabled && adminSoundAllowed && hasNewOrder) {
      playBeep();
    }

    seenIdsRef.current = currentIds;
  }, [orderIds, enabled, isLoading, resetKey]);
}

function playBeep(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);

    osc.onended = () => {
      ctx.close().catch(() => {});
    };
  } catch {
    // Web Audio API not available in this environment
  }
}
