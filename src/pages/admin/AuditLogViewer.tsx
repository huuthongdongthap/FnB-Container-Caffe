import { useEffect, useCallback } from 'react';
import { Search, Filter, Download, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { useAuditStore, type AuditEntry, type AuditFilters } from '@/tree/audit/use-audit-store';
import { useTranslations } from 'next-intl';

/* ── Helpers ───────────────────────────────────────────────────────── */

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

// Build CSV content from audit entries
function buildCsv(entries: AuditEntry[], t: (key: string) => string): string {
  const header = [
    t('audit.csv.time'),
    t('audit.csv.actor'),
    t('audit.csv.action'),
    t('audit.csv.resourceType'),
    t('audit.csv.resourceId'),
    t('audit.csv.ip'),
  ];
  const rows = entries.map((e) =>
    [
      e.createdAt,
      `${e.actorName} (${e.actorId})`,
      e.action,
      e.resourceType,
      e.resourceId,
      e.ipAddress ?? '',
    ]
      .map((v) => `"${v.replace(/"/g, '""')}"`)
      .join(','),
  );
  return [header.join(','), ...rows].join('\n');
}

/* ── Skeleton rows ─────────────────────────────────────────────────── */

function SkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="border-b border-border/50">
          <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
          <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
        </tr>
      ))}
    </>
  );
}

/* ── Main Component ────────────────────────────────────────────────── */

export default function AuditLogViewerPage() {
  const t = useTranslations();
  const entries = useAuditStore((s) => s.entries);
  const total = useAuditStore((s) => s.total);
  const loading = useAuditStore((s) => s.loading);
  const error = useAuditStore((s) => s.error);
  const filters = useAuditStore((s) => s.filters);
  const fetchLogs = useAuditStore((s) => s.fetchLogs);
  const setFilter = useAuditStore((s) => s.setFilter);
  const resetFilters = useAuditStore((s) => s.resetFilters);

  /* ── Option arrays ── */
  const ACTION_OPTIONS = [
    { value: '', label: t('audit.actionFilter.all') },
    { value: 'CREATE', label: t('audit.actionFilter.create') },
    { value: 'UPDATE', label: t('audit.actionFilter.update') },
    { value: 'DELETE', label: t('audit.actionFilter.delete') },
    { value: 'LOGIN', label: t('audit.actionFilter.login') },
    { value: 'LOGOUT', label: t('audit.actionFilter.logout') },
    { value: 'EXPORT', label: t('audit.actionFilter.export') },
  ];

  const RESOURCE_OPTIONS = [
    { value: '', label: t('audit.resourceFilter.all') },
    { value: 'order', label: t('audit.resourceFilter.order') },
    { value: 'customer', label: t('audit.resourceFilter.customer') },
    { value: 'menu', label: t('audit.resourceFilter.menu') },
    { value: 'promotion', label: t('audit.resourceFilter.promotion') },
    { value: 'campaign', label: t('audit.resourceFilter.campaign') },
    { value: 'staff', label: t('audit.resourceFilter.staff') },
    { value: 'payment', label: t('audit.resourceFilter.payment') },
    { value: 'reservation', label: t('audit.resourceFilter.reservation') },
  ];

  /* ── Fetch on mount ── */
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  /* ── Pagination helpers ── */
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const hasPrev = filters.page > 1;
  const hasNext = filters.page < totalPages;

  const goPrev = useCallback(() => {
    if (hasPrev) setFilter('page', filters.page - 1);
  }, [hasPrev, setFilter, filters.page]);

  const goNext = useCallback(() => {
    if (hasNext) setFilter('page', filters.page + 1);
  }, [hasNext, setFilter, filters.page]);

  /* ── Export CSV ── */
  const handleExport = useCallback(() => {
    const csv = buildCsv(entries, t);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entries, t]);

  /* ── Reset handler ── */
  const handleReset = useCallback(() => {
    resetFilters();
  }, [resetFilters]);

  /* ── Validate date range ── */
  const dateRangeInvalid = !!(
    filters.dateFrom &&
    filters.dateTo &&
    filters.dateFrom > filters.dateTo
  );

  /* ── Render ── */

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        {/* ── Header ── */}
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">{t('audit.title')}</h1>
            <p className="text-sm text-muted/60">
              {t('audit.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchLogs()}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {t('audit.refresh')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={entries.length === 0}
            >
              <Download size={16} />
              {t('audit.exportCsv')}
            </Button>
          </div>
        </div>

        {/* ── Date range warning ── */}
        {dateRangeInvalid && (
          <div className="mb-4 rounded-xl border border-yellow-300/30 bg-yellow-500/10 p-3 text-sm text-yellow-700">
            {t('audit.dateRangeWarning')}
          </div>
        )}

        {/* ── Filter Panel ── */}
        <Card className="mb-6">
          <div className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted">
              <Filter size={16} />
              {t('audit.filterTitle')}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {/* Date From */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  {t('audit.dateFrom')}
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilter('dateFrom', e.target.value)}
                  className="w-full rounded-lg border border-[var(--aura-border-subtle)] bg-[var(--aura-bg-input)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--aura-border-focus)]"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  {t('audit.dateTo')}
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilter('dateTo', e.target.value)}
                  className="w-full rounded-lg border border-[var(--aura-border-subtle)] bg-[var(--aura-bg-input)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--aura-border-focus)]"
                />
              </div>

              {/* Action Filter */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  {t('audit.actionLabel')}
                </label>
                <select
                  value={filters.action}
                  onChange={(e) => setFilter('action', e.target.value)}
                  className="w-full rounded-lg border border-[var(--aura-border-subtle)] bg-[var(--aura-bg-input)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--aura-border-focus)]"
                >
                  {ACTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Resource Type Filter */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  {t('audit.resourceLabel')}
                </label>
                <select
                  value={filters.resourceType}
                  onChange={(e) => setFilter('resourceType', e.target.value)}
                  className="w-full rounded-lg border border-[var(--aura-border-subtle)] bg-[var(--aura-bg-input)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--aura-border-focus)]"
                >
                  {RESOURCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Actor ID Filter */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  {t('audit.actorLabel')}
                </label>
                <input
                  type="text"
                  placeholder={t('audit.actorPlaceholder')}
                  value={filters.actorId}
                  onChange={(e) => setFilter('actorId', e.target.value)}
                  className="w-full rounded-lg border border-[var(--aura-border-subtle)] bg-[var(--aura-bg-input)] px-3 py-2 text-sm text-foreground placeholder:text-[var(--aura-text-disabled)] focus:outline-none focus:ring-2 focus:ring-[var(--aura-border-focus)]"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-4 flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => fetchLogs()}
                disabled={loading || dateRangeInvalid}
              >
                <Search size={16} />
                {t('audit.search')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleReset}
                disabled={loading}
              >
                {t('audit.reset')}
              </Button>
            </div>
          </div>
        </Card>

        {/* ── Results Table ── */}
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
                        <Button size="sm" variant="secondary" onClick={() => fetchLogs()}>
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
                        <Button size="sm" variant="secondary" onClick={handleReset}>
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
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          entry.action === 'DELETE'
                            ? 'bg-red-500/10 text-red-600'
                            : entry.action === 'CREATE'
                              ? 'bg-green-500/10 text-green-600'
                              : entry.action === 'UPDATE'
                                ? 'bg-blue-500/10 text-blue-600'
                                : entry.action === 'LOGIN' || entry.action === 'LOGOUT'
                                  ? 'bg-purple-500/10 text-purple-600'
                                  : 'bg-muted/10 text-muted'
                        }`}
                      >
                        {entry.action}
                      </span>
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

        {/* ── Pagination ── */}
        {!loading && !error && entries.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted">
              {t('audit.pagination.info', { page: filters.page, totalPages, total })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={goPrev}
                disabled={!hasPrev}
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
                {t('audit.pagination.prev')}
              </Button>
              <span className="px-2 text-xs text-muted">
                {filters.page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={goNext}
                disabled={!hasNext}
                aria-label="Next page"
              >
                {t('audit.pagination.next')}
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
