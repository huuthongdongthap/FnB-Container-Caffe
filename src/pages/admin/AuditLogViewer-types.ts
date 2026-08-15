import { type AuditEntry } from '@/tree/audit/use-audit-store';

export type { AuditEntry, AuditFilters } from '@/tree/audit/use-audit-store';

/* ── Helpers ───────────────────────────────────────────────────────── */

export function formatDateTime(iso: string): string {
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

export function buildCsv(entries: AuditEntry[], t: (key: string) => string): string {
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

/* ── Filter option factories ───────────────────────────────────────── */

export function buildActionOptions(t: (key: string) => string) {
  return [
    { value: '', label: t('audit.actionFilter.all') },
    { value: 'CREATE', label: t('audit.actionFilter.create') },
    { value: 'UPDATE', label: t('audit.actionFilter.update') },
    { value: 'DELETE', label: t('audit.actionFilter.delete') },
    { value: 'LOGIN', label: t('audit.actionFilter.login') },
    { value: 'LOGOUT', label: t('audit.actionFilter.logout') },
    { value: 'EXPORT', label: t('audit.actionFilter.export') },
  ];
}

export function buildResourceOptions(t: (key: string) => string) {
  return [
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
}
