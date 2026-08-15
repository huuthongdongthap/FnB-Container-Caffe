export function ConfigGuide() {
  return (
    <div className="rounded-xl border border-chrome-light/10 bg-[#0A1A2E]/50 p-6 backdrop-blur-sm">
      <h2 className="font-display text-lg font-semibold">Configuration</h2>
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
  );
}
