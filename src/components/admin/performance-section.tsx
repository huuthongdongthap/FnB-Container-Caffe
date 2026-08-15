import { useEffect } from 'react';
import { usePerformanceStore } from '@/hooks/stores/admin/use-performance-store';
import { WebVitalsSection } from './performance-section-web-vitals';
import { APILatencySection } from './performance-section-api-latency';

// Re-export extracted modules for backward compatibility
export { WebVitalsSection } from './performance-section-web-vitals';
export { APILatencySection } from './performance-section-api-latency';
export { ErrorCard, EmptyCard, WebVitalsSkeleton, LatencySkeleton } from './performance-section-shared';
export { VITAL_DISPLAY_NAMES, VITAL_TARGETS } from './performance-section-constants';
export type { WebVitalData, WebVitalCardProps, PercentileCardProps, ErrorCardProps } from './performance-section-types';

/* ═══════════════════════════════════════════════════════════════════
   PerformanceSection — Web Vitals + API Latency metrics for admin.
   Fetches two independent endpoints on mount. Each subsection has
   its own loading / empty / error state.
   ═══════════════════════════════════════════════════════════════════ */

export function PerformanceSection() {
  const fetchWebVitals = usePerformanceStore((s) => s.fetchWebVitals);
  const fetchAPILatency = usePerformanceStore((s) => s.fetchAPILatency);

  useEffect(() => {
    fetchWebVitals();
    fetchAPILatency();
  }, [fetchWebVitals, fetchAPILatency]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-bold">Performance</h2>
      <WebVitalsSection />
      <APILatencySection />
    </div>
  );
}
