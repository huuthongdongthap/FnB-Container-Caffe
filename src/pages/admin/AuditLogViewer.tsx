import { useEffect, useCallback } from 'react';
import { Search, Filter, Download, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { useAuditStore, type AuditEntry, type AuditFilters } from '@/tree/audit/use-audit-store';

/* ── Constants ─────────────────────────────────────────────────────── */

const ACTION_OPTIONS = [
  { value: '', label: 'Tat ca hanh dong / All Actions' },
  { value: 'CREATE', label: 'Tao / Create' },
  { value: 'UPDATE', label: 'Cap nhat / Update' },
  { value: 'DELETE', label: 'Xoa / Delete' },
  { value: 'LOGIN', label: 'Dang nhap / Login' },
  { value: 'LOGOUT', label: 'Dang xuat / Logout' },
  { value: 'EXPORT', label: 'Xuat / Export' },
];

const RESOURCE_OPTIONS = [
  { value: '', label: 'Tat ca loai / All Types' },
  { value: 'order', label: 'Don hang / Order' },
  { value: 'customer', label: 'Khach hang / Customer' },
  { value: 'menu', label: 'Thuc don / Menu' },
  { value: 'promotion', label: 'Khuyen mai / Promotion' },
  { value: 'campaign', label: 'Chien dich / Campaign' },
  { value: 'staff', label: 'Nhan vien / Staff' },
  { value: 'payment', label: 'Thanh toan / Payment' },
  { value: 'reservation', label: 'Dat ban / Reservation' },
];

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
function buildCsv(entries: AuditEntry[]): string {
  const header = ['Thoi gian', 'Nguoi thuc hien', 'Hanh dong', 'Loai tai nguyen', 'Ma tai nguyen', 'IP'];
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
  const entries = useAuditStore((s) => s.entries);
  const total = useAuditStore((s) => s.total);
  const loading = useAuditStore((s) => s.loading);
  const error = useAuditStore((s) => s.error);
  const filters = useAuditStore((s) => s.filters);
  const fetchLogs = useAuditStore((s) => s.fetchLogs);
  const setFilter = useAuditStore((s) => s.setFilter);
  const resetFilters = useAuditStore((s) => s.resetFilters);

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
    const csv = buildCsv(entries);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entries]);

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
            <h1 className="text-2xl font-display font-bold">Audit Log / Nhat Ky Kiem Toan</h1>
            <p className="text-sm text-muted/60">
              Xem lich su thao tac cua he thong va nguoi dung
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
              Lam moi
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={entries.length === 0}
            >
              <Download size={16} />
              Xuat CSV
            </Button>
          </div>
        </div>

        {/* ── Date range warning ── */}
        {dateRangeInvalid && (
          <div className="mb-4 rounded-xl border border-yellow-300/30 bg-yellow-500/10 p-3 text-sm text-yellow-700">
            Ngay bat dau khong duoc sau ngay ket thuc. / Start date cannot be after end date.
          </div>
        )}

        {/* ── Filter Panel ── */}
        <Card className="mb-6">
          <div className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted">
              <Filter size={16} />
              Bo loc / Filters
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {/* Date From */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Tu ngay / From
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
                  Den ngay / To
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
                  Hanh dong / Action
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
                  Loai tai nguyen / Resource
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
                  Nguoi thuc hien / Actor
                </label>
                <input
                  type="text"
                  placeholder="ID nguoi dung..."
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
                Tim kiem / Search
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleReset}
                disabled={loading}
              >
                Thiet lap lai / Reset
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
                    Thoi gian / Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                    Nguoi thuc hien / Actor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                    Hanh dong / Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                    Loai tai nguyen / Resource
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                    Ma tai nguyen / Resource ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                    IP / IP Address
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
                          Loi tai du lieu / Failed to load audit logs
                        </p>
                        <p className="text-xs text-muted/60 mb-4">{error}</p>
                        <Button size="sm" variant="secondary" onClick={() => fetchLogs()}>
                          Thu lai / Retry
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
                          Khong co nhat ky nao phu hop
                        </p>
                        <p className="text-xs text-muted/60 mb-4">
                          Khong tim thay nhat ky kiem toan nao phu hop voi bo loc hien tai.
                          <br />
                          No audit logs match the current filters.
                        </p>
                        <Button size="sm" variant="secondary" onClick={handleReset}>
                          Thiet lap lai bo loc / Reset Filters
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
              Trang {filters.page} / {totalPages} ({total} ban ghi / records)
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
                Truoc / Prev
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
                Sau / Next
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
