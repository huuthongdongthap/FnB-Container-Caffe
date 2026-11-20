import type { ReactNode } from 'react';
import { MD3Card } from '@/components/md3';

export interface HqUtmBucket {
  source: string;
  campaign: string;
  medium: string;
  content: string;
  signups: number;
  activated7d: number;
  paid: number;
}

export interface HqActivationFunnel {
  totalMerchants: number;
  activated7dCount: number;
  activationRatePercent: number;
  unactivatedOver24hCount: number;
  thresholds: {
    minProducts: number;
    minOrders7d: number;
  };
}

export interface HqOverview {
  totalTenants: number;
  activePaid: number;
  inTrial: number;
  inGrace: number;
  inReadOnly: number;
  suspended: number;
  mrrVnd: number;
  totalCollectedVnd: number;
  trialConversionPercent: number;
  activationFunnel?: HqActivationFunnel;
  utmBreakdown?: HqUtmBucket[];
}

export interface HqTenantAttribution {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  landing_path: string | null;
  captured_at: string | null;
}

export interface HqTenantRow {
  id: string;
  slug: string;
  name: string;
  planId: string;
  billingCycle: string;
  rawStatus?: string;
  lifecycleState: string;
  ownerEmail: string | null;
  ownerName: string | null;
  ownerPhone?: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  activated7d?: boolean;
  ordersFirst7d?: number;
  attribution?: HqTenantAttribution | null;
  usage: { tables: number; staff: number; products?: number; orders: number };
}

export interface HqAuditLogRow {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  actor_role: string | null;
  action: string;
  reason: string | null;
  after_json: string | null;
  created_at: string;
}

const PANEL_CARD_CLASS =
  'bg-[var(--md-sys-color-surface-container-low)] text-[var(--md-sys-color-on-surface)]';
const TABLE_HEAD_CLASS =
  'bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface-variant)] border-b border-[var(--md-sys-color-outline-variant)]';

export function HqUtmBreakdownPanel({
  buckets,
  thresholds,
}: {
  buckets: HqUtmBucket[];
  thresholds?: { minProducts: number; minOrders7d: number };
}): ReactNode {
  const minProducts = thresholds?.minProducts ?? 5;
  const minOrders7d = thresholds?.minOrders7d ?? 3;

  if (buckets.length === 0) {
    return (
      <MD3Card variant="outlined" className={`p-4 m3-body-small text-[var(--md-sys-color-on-surface-variant)] ${PANEL_CARD_CLASS}`}>
        Chưa có dữ liệu đăng ký theo kênh UTM.
      </MD3Card>
    );
  }

  return (
    <MD3Card variant="outlined" className={PANEL_CARD_CLASS}>
      <div className="px-4 py-3 border-b border-[var(--md-sys-color-outline-variant)] flex items-center justify-between gap-3 flex-wrap">
        <h2 className="m3-title-small text-[var(--md-sys-color-on-surface)]">Phễu kênh UTM & Kích hoạt 7 ngày</h2>
        <span className="m3-body-small text-[var(--md-sys-color-on-surface-variant)]">
          Tiêu chuẩn kích hoạt: ≥{minProducts} món & ≥{minOrders7d} đơn trong 7 ngày đầu
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left m3-body-small">
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <th className="p-3 m3-label-medium">Nguồn (utm_source)</th>
              <th className="p-3 m3-label-medium">Chiến dịch (utm_campaign)</th>
              <th className="p-3 m3-label-medium">Nội dung (utm_content)</th>
              <th className="p-3 text-right m3-label-medium">Đăng ký</th>
              <th className="p-3 text-right m3-label-medium">Kích hoạt 7d</th>
              <th className="p-3 text-right m3-label-medium">Trả phí</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]">
            {buckets.map((row) => {
              const pct = row.signups > 0 ? Math.round((row.activated7d / row.signups) * 100) : 0;
              return (
                <tr key={`${row.source}|${row.campaign}|${row.medium}|${row.content}`}>
                  <td className="p-3 font-mono text-[var(--md-sys-color-on-surface)]">{row.source}</td>
                  <td className="p-3 text-[var(--md-sys-color-on-surface)]">{row.campaign}</td>
                  <td className="p-3 text-[var(--md-sys-color-on-surface-variant)]">{row.content || '—'}</td>
                  <td className="p-3 text-right font-semibold tabular-nums text-[var(--md-sys-color-on-surface)]">{row.signups}</td>
                  <td className="p-3 text-right tabular-nums text-[var(--md-sys-color-on-surface)]">
                    {row.activated7d} <span className="text-[var(--md-sys-color-on-surface-variant)]">({pct}%)</span>
                  </td>
                  <td className="p-3 text-right tabular-nums text-[var(--md-sys-color-on-surface)]">{row.paid}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </MD3Card>
  );
}

export function HqAuditLogsPanel({ logs, loading }: { logs: HqAuditLogRow[]; loading: boolean }): ReactNode {
  return (
    <MD3Card variant="outlined" className={PANEL_CARD_CLASS}>
      <div className="overflow-x-auto">
        <table className="w-full text-left m3-body-small">
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <th className="p-3 m3-label-medium">Thời gian</th>
              <th className="p-3 m3-label-medium">Hành động</th>
              <th className="p-3 m3-label-medium">Tenant</th>
              <th className="p-3 m3-label-medium">Tác nhân</th>
              <th className="p-3 m3-label-medium">Lý do / Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-[var(--md-sys-color-on-surface-variant)]">
                  Đang tải nhật ký HQ...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-[var(--md-sys-color-on-surface-variant)]">
                  Chưa có bản ghi nhật ký SaaS nào.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td className="p-3 font-mono tabular-nums text-[var(--md-sys-color-on-surface-variant)] whitespace-nowrap">
                    {log.created_at}
                  </td>
                  <td className="p-3 font-mono text-[var(--md-sys-color-on-surface)]">{log.action}</td>
                  <td className="p-3 font-mono text-[var(--md-sys-color-on-surface)]">{log.tenant_id}</td>
                  <td className="p-3 text-[var(--md-sys-color-on-surface-variant)]">{log.actor_role || 'system'}</td>
                  <td className="p-3 text-[var(--md-sys-color-on-surface-variant)] max-w-md truncate" title={log.after_json || log.reason || ''}>
                    {log.reason || log.after_json || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </MD3Card>
  );
}
