import { useEffect, useState } from 'react';
import type { ConfigStatus } from './analytics-config-types';
import { TrackerCard } from './analytics-tracker-card';
import { ConfigGuide } from './analytics-config-guide';
import { AnalyticsLoadingSkeleton } from './analytics-loading-skeleton';

/* ═══════════════════════════════════════════════════════════════════
   AnalyticsConfig — /admin/analytics
   Shows GA4 and Facebook Pixel configuration status.
   Informative-only: IDs are set via environment vars at build time.
   ═══════════════════════════════════════════════════════════════════ */

export default function AnalyticsConfig() {
  const [status, setStatus] = useState<ConfigStatus>({
    gaMeasurementId: null,
    gaActive: false,
    fbPixelId: null,
    fbActive: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const gaId = (import.meta.env.VITE_GA_MEASUREMENT_ID as string) || null;
    const fbId = (import.meta.env.VITE_FB_PIXEL_ID as string) || null;

    setStatus({
      gaMeasurementId: gaId,
      gaActive: Boolean(gaId) && typeof window.gtag === 'function',
      fbPixelId: fbId,
      fbActive: Boolean(fbId) && typeof window.fbq === 'function',
    });
    setLoading(false);
  }, []);

  if (loading) {
    return <AnalyticsLoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl font-bold">
          Analytics Configuration
        </h1>
        <p className="mt-1 text-sm text-chrome-light/60">
          Current analytics tracking configuration. Set these via environment
          variables (VITE_GA_MEASUREMENT_ID, VITE_FB_PIXEL_ID) at build time.
        </p>

        <div className="mt-8 space-y-6">
          <TrackerCard
            title="Google Analytics 4"
            description="Track page views, events, and conversions via GA4."
            active={status.gaActive}
            idValue={status.gaMeasurementId}
            idLabel="Measurement ID"
            envVarName="VITE_GA_MEASUREMENT_ID"
            trackedEvents="page_view, add_to_cart, begin_checkout, purchase"
          />
          <TrackerCard
            title="Facebook Pixel"
            description="Track conversions and build retargeting audiences."
            active={status.fbActive}
            idValue={status.fbPixelId}
            idLabel="Pixel ID"
            envVarName="VITE_FB_PIXEL_ID"
            trackedEvents="PageView, AddToCart, InitiateCheckout, Purchase"
          />
          <ConfigGuide />
        </div>
      </div>
    </div>
  );
}
