import { useEffect, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════════
   AnalyticsConfig — /admin/analytics
   Shows GA4 and Facebook Pixel configuration status.
   Informative-only: IDs are set via environment vars at build time.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Types ─── */

interface ConfigStatus {
  gaMeasurementId: string | null;
  gaActive: boolean;
  fbPixelId: string | null;
  fbActive: boolean;
}

/* ─── Component ─── */

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
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-3xl">
          <div className="h-8 w-64 animate-pulse rounded bg-chrome-light/10" />
          <div className="mt-6 space-y-4">
            <div className="h-24 animate-pulse rounded-xl bg-chrome-light/10" />
            <div className="h-24 animate-pulse rounded-xl bg-chrome-light/10" />
          </div>
        </div>
      </div>
    );
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
          {/* GA4 Card */}
          <div className="rounded-xl border border-chrome-light/10 bg-[#0A1A2E]/50 p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold">
                  Google Analytics 4
                </h2>
                <p className="mt-1 text-sm text-chrome-light/60">
                  Track page views, events, and conversions via GA4.
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  status.gaActive
                    ? 'bg-green-900/50 text-green-400'
                    : status.gaMeasurementId
                      ? 'bg-yellow-900/50 text-yellow-400'
                      : 'bg-red-900/50 text-red-400'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    status.gaActive
                      ? 'bg-green-400'
                      : status.gaMeasurementId
                        ? 'bg-yellow-400'
                        : 'bg-red-400'
                  }`}
                />
                {status.gaActive
                  ? 'Active'
                  : status.gaMeasurementId
                    ? 'Script Loading'
                    : 'Not Configured'}
              </span>
            </div>

            {status.gaMeasurementId ? (
              <div className="mt-4 rounded-lg bg-chrome-light/5 px-4 py-3 font-mono text-sm text-chrome-light/80">
                Measurement ID:{' '}
                <span className="text-chrome-bright">
                  {status.gaMeasurementId}
                </span>
              </div>
            ) : (
              <div className="mt-4 rounded-lg bg-red-900/20 px-4 py-3 text-sm text-red-400">
                GA4 is not configured. Set{' '}
                <code className="rounded bg-chrome-light/10 px-1.5 py-0.5 font-mono text-xs">
                  VITE_GA_MEASUREMENT_ID
                </code>{' '}
                in your environment to enable.
              </div>
            )}

            <p className="mt-3 text-xs text-chrome-light/40">
              Events tracked: page_view, add_to_cart, begin_checkout, purchase
            </p>
          </div>

          {/* Facebook Pixel Card */}
          <div className="rounded-xl border border-chrome-light/10 bg-[#0A1A2E]/50 p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold">
                  Facebook Pixel
                </h2>
                <p className="mt-1 text-sm text-chrome-light/60">
                  Track conversions and build retargeting audiences.
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  status.fbActive
                    ? 'bg-green-900/50 text-green-400'
                    : status.fbPixelId
                      ? 'bg-yellow-900/50 text-yellow-400'
                      : 'bg-red-900/50 text-red-400'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    status.fbActive
                      ? 'bg-green-400'
                      : status.fbPixelId
                        ? 'bg-yellow-400'
                        : 'bg-red-400'
                  }`}
                />
                {status.fbActive
                  ? 'Active'
                  : status.fbPixelId
                    ? 'Script Loading'
                    : 'Not Configured'}
              </span>
            </div>

            {status.fbPixelId ? (
              <div className="mt-4 rounded-lg bg-chrome-light/5 px-4 py-3 font-mono text-sm text-chrome-light/80">
                Pixel ID:{' '}
                <span className="text-chrome-bright">
                  {status.fbPixelId}
                </span>
              </div>
            ) : (
              <div className="mt-4 rounded-lg bg-red-900/20 px-4 py-3 text-sm text-red-400">
                Facebook Pixel is not configured. Set{' '}
                <code className="rounded bg-chrome-light/10 px-1.5 py-0.5 font-mono text-xs">
                  VITE_FB_PIXEL_ID
                </code>{' '}
                in your environment to enable.
              </div>
            )}

            <p className="mt-3 text-xs text-chrome-light/40">
              Events tracked: PageView, AddToCart, InitiateCheckout, Purchase
            </p>
          </div>

          {/* How to configure */}
          <div className="rounded-xl border border-chrome-light/10 bg-[#0A1A2E]/50 p-6 backdrop-blur-sm">
            <h2 className="font-display text-lg font-semibold">
              Configuration
            </h2>
            <p className="mt-1 text-sm text-chrome-light/60">
              Add these variables to your environment (e.g.,{' '}
              <code className="rounded bg-chrome-light/10 px-1.5 py-0.5 font-mono text-xs">
                .env
              </code>
              ):
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-chrome-light/5 p-4 font-mono text-sm text-chrome-light/80">
              {`VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_FB_PIXEL_ID=1234567890`}
            </pre>
            <p className="mt-3 text-xs text-chrome-light/40">
              Restart the dev server after changing these values.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
