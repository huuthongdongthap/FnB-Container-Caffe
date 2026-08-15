import { Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { buildActionOptions, buildResourceOptions } from './AuditLogViewer-types';
import type { AuditFilters } from '@/hooks/stores/admin/use-audit-store';

type SetFilterFn = <K extends keyof AuditFilters>(field: K, value: AuditFilters[K]) => Promise<void>;

interface FilterPanelProps {
  filters: AuditFilters;
  setFilter: SetFilterFn;
  fetchLogs: () => void;
  resetFilters: () => void;
  loading: boolean;
  dateRangeInvalid: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export function FilterPanel({
  filters,
  setFilter,
  fetchLogs,
  resetFilters,
  loading,
  dateRangeInvalid,
  t,
}: FilterPanelProps) {
  const ACTION_OPTIONS = buildActionOptions(t);
  const RESOURCE_OPTIONS = buildResourceOptions(t);

  return (
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
            onClick={resetFilters}
            disabled={loading}
          >
            {t('audit.reset')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
