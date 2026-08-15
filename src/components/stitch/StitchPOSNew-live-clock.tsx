'use client';

import { useState, useEffect, useCallback } from 'react';

export function LiveClock() {
  const [time, setTime] = useState('');
  const updateClock = useCallback(() => {
    const now = new Date();
    setTime(
      now.toLocaleTimeString('en-US', {
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  }, []);

  useEffect(() => {
    updateClock();
    const id = setInterval(updateClock, 1000);
    return () => clearInterval(id);
  }, [updateClock]);

  return <span className="text-[13px] text-[#8a7a6a] font-body">{time}</span>;
}
