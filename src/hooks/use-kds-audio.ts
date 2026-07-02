'use client';

import { useEffect, useRef } from 'react';

export function useKdsAudio(orderCount: number, enabled: boolean): void {
  const prevCountRef = useRef(orderCount);

  useEffect(() => {
    if (!enabled) {
      prevCountRef.current = orderCount;
      return;
    }

    if (orderCount > prevCountRef.current) {
      playBeep();
    }
    prevCountRef.current = orderCount;
  }, [orderCount, enabled]);
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
