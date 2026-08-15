/**
 * DashSkeleton — loading skeleton for StitchAccountDashNew
 */
import type React from 'react';

export function DashSkeleton(): React.JSX.Element {
  return (
    <div
      className="min-h-screen bg-[var(--aura-surface-dim)] animate-pulse"
      aria-label="Account Dashboard"
    >
      <div className="px-5 pt-24 pb-32 mx-auto w-full space-y-6">
        {/* App bar skeleton */}
        <div className="flex items-center justify-between h-16 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[#1e3550]" />
          <div className="w-28 h-5 rounded bg-[#1e3550]" />
          <div className="w-10 h-10 rounded-full bg-[#1e3550]" />
        </div>
        {/* Profile card skeleton */}
        <div className="rounded-xl p-6 bg-[rgba(30,41,59,0.4)] backdrop-blur-xl border border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-[#1e3550]" />
            <div className="space-y-2">
              <div className="w-32 h-5 rounded bg-[#1e3550]" />
              <div className="w-20 h-3 rounded bg-[#1e3550]" />
            </div>
          </div>
        </div>
        {/* Loyalty skeleton */}
        <div className="rounded-xl p-6 bg-[rgba(30,41,59,0.4)] backdrop-blur-xl border border-white/10">
          <div className="w-full h-2 rounded-full bg-[var(--aura-bg-high)]" />
        </div>
        {/* Quick order skeleton */}
        <div className="h-14 rounded-xl bg-[#1e3550]" />
        {/* Orders skeleton */}
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-lg p-4 bg-[rgba(30,41,59,0.4)] backdrop-blur-xl border border-[rgba(148,163,184,0.3)]"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[var(--aura-bg-elevated)]" />
                <div className="space-y-2 flex-1">
                  <div className="w-36 h-4 rounded bg-[#1e3550]" />
                  <div className="w-24 h-3 rounded bg-[#1e3550]" />
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Membership card skeleton */}
        <div className="w-full rounded-2xl bg-[#1e3550]" style={{ aspectRatio: '1.6/1' }} />
      </div>
    </div>
  );
}
