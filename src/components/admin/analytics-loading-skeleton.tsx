export function AnalyticsLoadingSkeleton() {
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
