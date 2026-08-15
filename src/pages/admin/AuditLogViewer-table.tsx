import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SkeletonRows } from './AuditLogViewer-skeleton';
import { formatDateTime } from './AuditLogViewer-types';
import type { AuditEntry } from '@/tree/audit/use-audit-store';

interface AuditTableProps {
  entries: AuditEntry[];
  loading: boolean;
  error: string | null;
  t: (key: string, params?: Record<string, unknown>) => string;
  onRetry: () => void;
  onReset: () => void;
}

function ActionBadge({ action }: { action: string }) {
  const color =
    action === 'DELETE'
      ? 'bg-red-500/10 text-red-600'
      : action === 'CREATE'
        ? 'bg-green-500/10 text-green-600'
        : action === 'UPDATE'
          ? 'bg-blue-500/10 text-blue-600'
          : action === 'LOGIN' || action === 'LOGOUT'
            ? 'bg-purple-500/10 text-purple-600'
            : 'bg-muted/10 text-muted';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {action}
    </span>
  );
}

export function AuditTable({ entries, loading, error, t, onRetry, onReset }: AuditTableProps) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/5">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                {t('audit.tableHeader.time')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                {t('audit.tableHeader.actor')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                {t('audit.tableHeader.action')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                {t('audit.tableHeader.resourceType')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                {t('audit.tableHeader.resourceId')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                {t('audit.tableHeader.ip')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {/* Loading state */}
            {loading && <SkeletonRows count={8} />}

            {/* Error state */}
            {!loading && error && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <div className="mx-auto max-w-sm">
                    <p className="text-sm text-destructive mb-2">
                      {t('audit.error.loadFailed')}
                    </p>
                    <p className="text-xs text-muted/60 mb-4">{error}</p>
                    <Button size="sm" variant="secondary" onClick={onRetry}>
                      {t('audit.error.retry')}
                    </Button>
                  </div>
                </td>
              </tr>
            )}

            {/* Empty state */}
            {!loading && !error && entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <div className="mx-auto max-w-sm">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted/10">
                      <Search size={22} className="text-muted" aria-hidden="true" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">
                      {t('audit.empty.noLogs')}
                    </p>
                    <p className="text-xs text-muted/60 mb-4">
                      {t('audit.empty.noLogsDescription')}
                    </p>
                    <Button size="sm" variant="secondary" onClick={onReset}>
                      {t('audit.empty.resetFilters')}
                    </Button>
                  </div>
                </td>
              </tr>
            )}

            {/* Data rows */}
            {!loading && !error && entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-muted/5 transition-colors">
                <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground/80">
                  {formatDateTime(entry.createdAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {entry.actorName}
                    </span>
                    <span className="text-xs text-muted/60">{entry.actorId}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <ActionBadge action={entry.action} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground/80">
                  {entry.resourceType}
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 text-sm text-foreground/60 font-mono">
                  {entry.resourceId}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground/60 font-mono">
                  {entry.ipAddress || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
