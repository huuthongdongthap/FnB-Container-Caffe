/**
 * Custom hook for StitchEventsNew2 state management.
 * Extracted from StitchEventsNew2.tsx to keep individual files under 200 LOC.
 * Handles month filter state with controlled/uncontrolled pattern.
 */

import { useState, useCallback } from 'react';

export interface UseStitchEventsOptions {
  /** External active month override (controlled mode) */
  activeMonth?: string;
  /** Callback when month changes in controlled mode */
  onMonthChange?: (month: string) => void;
}

export interface UseStitchEventsReturn {
  /** Current active month (resolved from external or internal state) */
  activeMonth: string;
  /** Handler to update the active month */
  handleMonthChange: (month: string) => void;
}

/**
 * Manages month filter state with controlled/uncontrolled pattern.
 * When onMonthChange is provided, operates in controlled mode;
 * otherwise manages internal state with default 'oct'.
 */
export function useStitchEvents({
  activeMonth: externalActiveMonth,
  onMonthChange,
}: UseStitchEventsOptions): UseStitchEventsReturn {
  const [internalActiveMonth, setInternalActiveMonth] = useState('oct');

  const activeMonth = externalActiveMonth ?? internalActiveMonth;

  const handleMonthChange = useCallback(
    (month: string) => {
      if (onMonthChange) {
        onMonthChange(month);
      } else {
        setInternalActiveMonth(month);
      }
    },
    [onMonthChange],
  );

  return { activeMonth, handleMonthChange };
}
