/**
 * Displays test send results for push notification subscriptions.
 */

import { CheckCircle2, XCircle } from 'lucide-react';

type Props = {
  results: Record<string, { ok: boolean; msg: string }>;
};

export function SubscriptionTestResults({ results }: Props) {
  const entries = Object.entries(results);
  if (entries.length === 0) return null;

  return (
    <div className="mt-3 space-y-1">
      {entries.map(([name, res]) => (
        <div
          key={name}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${
            res.ok
              ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'
              : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
          }`}
        >
          {res.ok ? (
            <CheckCircle2 size={14} aria-hidden="true" />
          ) : (
            <XCircle size={14} aria-hidden="true" />
          )}
          <span className="font-medium">{name}</span>
          <span>— {res.msg}</span>
        </div>
      ))}
    </div>
  );
}
