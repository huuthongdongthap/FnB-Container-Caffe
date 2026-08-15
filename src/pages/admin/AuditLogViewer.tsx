import { useEffect, useCallback } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useAuditStore } from '@/tree/audit/use-audit-store';
import { useTranslation } from 'react-i18next';
import { buildCsv } from './AuditLogViewer-types';
import { FilterPanel } from './AuditLogViewer-filter-panel';
import { AuditTable } from './AuditLogViewer-table';
import { Pagination } from './AuditLogViewer-pagination';

export default function AuditLogViewerPage() {
  const { t } = useTranslation();
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
    const csv = buildCsv(entries, t);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entries, t]);

  /* ── Date range validation ── */
  const dateRangeInvalid = !!(
    filters.dateFrom &&
    filters.dateTo &&
    filters.dateFrom > filters.dateTo
  );

  return (
    <>
      <HelmetHead
        title="Nhật ký kiểm tra — Audit Log — AURA CAFE"
        description="Xem nhật ký hoạt động và thay đổi hệ thống tại AURA CAFE. Audit log, activity tracking & system change history."
      />
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl">
          {/* ── Header ── */}
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-display font-bold">{t('audit.title')}</h1>
              <p className="text-sm text-muted/60">{t('audit.subtitle')}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => fetchLogs()} disabled={loading}>
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                {t('audit.refresh')}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleExport} disabled={entries.length === 0}>
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

          <FilterPanel
            filters={filters}
            setFilter={setFilter}
            fetchLogs={fetchLogs}
            resetFilters={resetFilters}
            loading={loading}
            dateRangeInvalid={dateRangeInvalid}
            t={t}
          />

          <AuditTable
            entries={entries}
            loading={loading}
            error={error}
            t={t}
            onRetry={() => fetchLogs()}
            onReset={resetFilters}
          />

          {!loading && !error && entries.length > 0 && (
            <Pagination
              page={filters.page}
              totalPages={totalPages}
              total={total}
              hasPrev={hasPrev}
              hasNext={hasNext}
              onPrev={goPrev}
              onNext={goNext}
              t={t}
            />
          )}
        </div>
      </div>
    </>
  );
}
