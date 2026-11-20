import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { apiFetch } from '@/lib/api-client';
import {
  HqAuditLogsPanel,
  HqUtmBreakdownPanel,
  type HqAuditLogRow,
  type HqOverview,
  type HqTenantRow,
} from './hq-saas-telemetry-panels';

type HqTab = 'tenants' | 'utm' | 'audit';

interface HqActionResponse {
  success?: boolean;
  error?: string;
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return fallback;
}

export default function AdminHqSaasPage(): ReactNode {
  const [overview, setOverview] = useState<HqOverview | null>(null);
  const [tenants, setTenants] = useState<HqTenantRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<HqAuditLogRow[]>([]);
  const [activeTab, setActiveTab] = useState<HqTab>('tenants');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingTenants, setPendingTenants] = useState<Record<string, boolean>>({});

  const mountedRef = useRef(true);
  const loadReqIdRef = useRef(0);
  const auditReqIdRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const auditAbortRef = useRef<AbortController | null>(null);
  const pendingRef = useRef<Set<string>>(new Set());

  async function loadData(query = '') {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const reqId = ++loadReqIdRef.current;

    setLoading(true);
    setErrorMessage(null);
    try {
      const [ovRes, tenRes] = await Promise.all([
        apiFetch<{ success: boolean; data?: HqOverview; error?: string }>('/api/hq/saas/overview', {
          silent: true,
          signal: controller.signal,
        }),
        apiFetch<{ success: boolean; data?: { tenants: HqTenantRow[] }; error?: string }>(
          `/api/hq/saas/tenants${query ? `?search=${encodeURIComponent(query)}` : ''}`,
          { silent: true, signal: controller.signal }
        ),
      ]);
      if (!mountedRef.current || reqId !== loadReqIdRef.current) return;

      const errors: string[] = [];
      if (!ovRes || ovRes.success !== true) {
        errors.push(ovRes?.error || 'Không thể tải tổng quan HQ.');
      } else if (ovRes.data) {
        setOverview(ovRes.data);
      }

      if (!tenRes || tenRes.success !== true) {
        errors.push(tenRes?.error || 'Không thể tải danh sách cửa hàng.');
      } else if (tenRes.data?.tenants) {
        setTenants(tenRes.data.tenants);
      }

      if (errors.length > 0) {
        setErrorMessage(errors.join(' '));
      }
    } catch (err) {
      if (isAbortError(err) || !mountedRef.current || reqId !== loadReqIdRef.current) return;
      setErrorMessage(getErrorMessage(err, 'Không thể tải dữ liệu quản trị HQ SaaS.'));
    } finally {
      if (mountedRef.current && reqId === loadReqIdRef.current) {
        setLoading(false);
      }
    }
  }

  async function loadAuditLogs() {
    auditAbortRef.current?.abort();
    const controller = new AbortController();
    auditAbortRef.current = controller;
    const reqId = ++auditReqIdRef.current;

    setAuditLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiFetch<{ success: boolean; data?: { logs: HqAuditLogRow[] }; error?: string }>(
        '/api/hq/saas/audit-logs',
        { silent: true, signal: controller.signal }
      );
      if (!mountedRef.current || reqId !== auditReqIdRef.current) return;

      if (!res || res.success !== true) {
        setErrorMessage(res?.error || 'Không thể tải nhật ký HQ.');
        return;
      }
      if (res.data?.logs) setAuditLogs(res.data.logs);
    } catch (err) {
      if (isAbortError(err) || !mountedRef.current || reqId !== auditReqIdRef.current) return;
      setErrorMessage(getErrorMessage(err, 'Không thể tải nhật ký HQ.'));
    } finally {
      if (mountedRef.current && reqId === auditReqIdRef.current) {
        setAuditLoading(false);
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    void loadData();
    return () => {
      mountedRef.current = false;
      loadAbortRef.current?.abort();
      auditAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      void loadAuditLogs();
      return () => {
        auditAbortRef.current?.abort();
      };
    }
    return undefined;
  }, [activeTab]);

  async function runTenantAction(
    tenantId: string,
    request: () => Promise<HqActionResponse>,
    successMessage: string,
    fallbackError: string
  ) {
    if (pendingRef.current.has(tenantId)) return;
    pendingRef.current.add(tenantId);
    setPendingTenants((prev) => ({ ...prev, [tenantId]: true }));
    setMessage(null);
    setErrorMessage(null);

    try {
      const res = await request();
      if (!mountedRef.current) return;
      if (!res || res.success !== true) {
        setErrorMessage(res?.error || fallbackError);
        return;
      }
      setMessage(successMessage);
      await loadData(search);
    } catch (err) {
      if (!mountedRef.current) return;
      setMessage(null);
      setErrorMessage(getErrorMessage(err, fallbackError));
    } finally {
      pendingRef.current.delete(tenantId);
      if (mountedRef.current) {
        setPendingTenants((prev) => {
          const next = { ...prev };
          delete next[tenantId];
          return next;
        });
      }
    }
  }

  function extendTrial(id: string) {
    void runTenantAction(
      id,
      () =>
        apiFetch<HqActionResponse>(`/api/hq/saas/tenants/${id}/extend-trial`, {
          method: 'POST',
          body: JSON.stringify({ days: 14, reason: 'HQ extended trial +14d' }),
        }),
      'Đã gia hạn dùng thử +14 ngày.',
      'Không thể gia hạn dùng thử cho cửa hàng này.'
    );
  }

  function overrideTier(id: string, planId: 'starter' | 'pro' | 'chain') {
    void runTenantAction(
      id,
      () =>
        apiFetch<HqActionResponse>(`/api/hq/saas/tenants/${id}/override-tier`, {
          method: 'POST',
          body: JSON.stringify({ planId, status: 'active', durationDays: 30 }),
        }),
      `Đã kích hoạt gói ${planId.toUpperCase()} (30 ngày).`,
      `Không thể kích hoạt gói ${planId.toUpperCase()}.`
    );
  }

  function toggleSuspend(t: HqTenantRow) {
    const isCurrentlySuspended = t.rawStatus === 'suspended' || t.lifecycleState === 'suspended';
    const suspend = !isCurrentlySuspended;
    void runTenantAction(
      t.id,
      () =>
        apiFetch<HqActionResponse>(`/api/hq/saas/tenants/${t.id}/suspend`, {
          method: 'POST',
          body: JSON.stringify({ suspend }),
        }),
      suspend ? `Đã khóa quán ${t.name}.` : `Đã mở khóa quán ${t.name}.`,
      suspend ? `Không thể khóa quán ${t.name}.` : `Không thể mở khóa quán ${t.name}.`
    );
  }

  function handleSearchSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void loadData(search);
  }

  const minProducts = overview?.activationFunnel?.thresholds?.minProducts ?? 5;
  const minOrders7d = overview?.activationFunnel?.thresholds?.minOrders7d ?? 3;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 text-slate-100">
      <div>
        <h1 className="text-2xl font-bold text-white">HQ SaaS Commercial Control</h1>
        <p className="text-sm text-slate-400">Quản trị toàn bộ cửa hàng đối tác, MRR, phễu kích hoạt 7 ngày và nhật ký HQ.</p>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          {errorMessage}
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-400">MRR Ước tính</div>
            <div className="text-xl font-bold text-amber-400 mt-1">
              {overview.mrrVnd.toLocaleString('vi-VN')}đ
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-400">Tổng quán / Trả phí</div>
            <div className="text-xl font-bold text-white mt-1">
              {overview.totalTenants} / <span className="text-emerald-400">{overview.activePaid}</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-400">Đang Trial / Chuyển đổi</div>
            <div className="text-xl font-bold text-sky-400 mt-1">
              {overview.inTrial} ({overview.trialConversionPercent}%)
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-400">Kích hoạt 7 ngày</div>
            <div className="text-xl font-bold text-emerald-400 mt-1">
              {overview.activationFunnel?.activated7dCount ?? 0} / {overview.activationFunnel?.totalMerchants ?? 0}
              <span className="text-xs text-slate-400 font-normal ml-1">
                ({overview.activationFunnel?.activationRatePercent ?? 0}%)
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-400">Grace / Read-Only / Khóa</div>
            <div className="text-xl font-bold text-rose-400 mt-1">
              {overview.inGrace} / {overview.inReadOnly} / {overview.suspended}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        {(
          [
            ['tenants', `Cửa hàng (${tenants.length})`],
            ['utm', `Phễu UTM (${overview?.utmBreakdown?.length ?? 0})`],
            ['audit', 'Nhật ký HQ'],
          ] as Array<[HqTab, string]>
        ).map(([tabKey, label]) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setActiveTab(tabKey)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              activeTab === tabKey
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'utm' && (
        <HqUtmBreakdownPanel
          buckets={overview?.utmBreakdown ?? []}
          thresholds={overview?.activationFunnel?.thresholds}
        />
      )}

      {activeTab === 'audit' && <HqAuditLogsPanel logs={auditLogs} loading={auditLoading} />}

      {activeTab === 'tenants' && (
        <>
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên quán, slug hoặc email chủ quán..."
              className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50"
            >
              Tìm kiếm
            </button>
          </form>

          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">Cửa hàng / Kênh</th>
                  <th className="p-3">Chủ quán</th>
                  <th className="p-3">Gói / Trạng thái</th>
                  <th className="p-3">Sử dụng & Kích hoạt</th>
                  <th className="p-3">Thao tác HQ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400">
                      Đang tải danh sách tenant...
                    </td>
                  </tr>
                ) : (
                  tenants.map((t) => {
                    const isSuspended = t.rawStatus === 'suspended' || t.lifecycleState === 'suspended';
                    const isPending = Boolean(pendingTenants[t.id]);
                    const productCount = t.usage.products ?? 0;
                    const ordersFirst7d = t.ordersFirst7d ?? 0;
                    const statusLabel = isSuspended ? 'suspended' : t.lifecycleState;
                    const statusClass = isSuspended
                      ? 'text-rose-400'
                      : t.lifecycleState === 'active'
                        ? 'text-emerald-400'
                        : t.lifecycleState === 'trial'
                          ? 'text-sky-400'
                          : 'text-amber-400';

                    return (
                      <tr key={t.id}>
                        <td className="p-3 space-y-0.5">
                          <div className="font-semibold text-white">{t.name}</div>
                          <div className="font-mono text-[11px] text-amber-400">/s/{t.slug}</div>
                          {t.attribution?.utm_source && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              UTM: {t.attribution.utm_source}
                              {t.attribution.utm_campaign ? ` / ${t.attribution.utm_campaign}` : ''}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <div>{t.ownerName || '—'}</div>
                          <div className="text-slate-400">{t.ownerEmail || '—'}</div>
                        </td>
                        <td className="p-3">
                          <span className="uppercase font-bold text-white">{t.planId}</span> •{' '}
                          <span className={`uppercase font-semibold ${statusClass}`}>{statusLabel}</span>
                        </td>
                        <td className="p-3 text-slate-300 space-y-1">
                          <div>
                            {productCount} món • {t.usage.tables} bàn • {t.usage.staff} NV •{' '}
                            {t.usage.orders} đơn
                          </div>
                          <div>
                            {t.activated7d ? (
                              <span className="inline-block rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                                Đã kích hoạt 7d ({productCount}/{minProducts} món • {ordersFirst7d}/{minOrders7d} đơn)
                              </span>
                            ) : (
                              <span className="inline-block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                                Chưa kích hoạt ({productCount}/{minProducts} món • {ordersFirst7d}/{minOrders7d} đơn)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1.5" aria-busy={isPending}>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => extendTrial(t.id)}
                              className="rounded bg-sky-500/20 px-2 py-1 text-[11px] text-sky-300 hover:bg-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              +14d Trial
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => overrideTier(t.id, 'pro')}
                              className="rounded bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Kích hoạt Pro
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => toggleSuspend(t)}
                              className="rounded bg-rose-500/20 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isSuspended ? 'Mở khóa' : 'Khóa'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
