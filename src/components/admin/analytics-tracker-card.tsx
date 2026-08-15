import { StatusBadge } from './analytics-status-badge';

interface TrackerCardProps {
  title: string;
  description: string;
  active: boolean;
  idValue: string | null;
  idLabel: string;
  envVarName: string;
  trackedEvents: string;
}

export function TrackerCard({
  title,
  description,
  active,
  idValue,
  idLabel,
  envVarName,
  trackedEvents,
}: TrackerCardProps) {
  return (
    <div className="rounded-xl border border-chrome-light/10 bg-[#0A1A2E]/50 p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-chrome-light/60">{description}</p>
        </div>
        <StatusBadge active={active} hasId={Boolean(idValue)} />
      </div>

      {idValue ? (
        <div className="mt-4 rounded-lg bg-chrome-light/5 px-4 py-3 font-mono text-sm text-chrome-light/80">
          {idLabel}:{' '}
          <span className="text-chrome-bright">{idValue}</span>
        </div>
      ) : (
        <div className="mt-4 rounded-lg bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {title} is not configured. Set{' '}
          <code className="rounded bg-chrome-light/10 px-1.5 py-0.5 font-mono text-xs">
            {envVarName}
          </code>{' '}
          in your environment to enable.
        </div>
      )}

      <p className="mt-3 text-xs text-chrome-light/40">
        Events tracked: {trackedEvents}
      </p>
    </div>
  );
}
