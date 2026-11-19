import { useEffect, useState, type ReactNode } from 'react';
import { apiFetch } from '@/lib/api-client';

interface HqOverview {
  totalTenants: number;
  activePaid: number;
  inTrial: number;
  inGrace: number;
  inReadOnly: number;
  suspended: number;
  mrrVnd: number;
  totalCollectedVnd: number;
  trialConversionPercent: number;
}

interface HqTenantRow {
  id: string;
  slug: string;
  name: string;
  planId: string;
  billingCycle: string;
  lifecycleState: string;
  ownerEmail: string | null;
  ownerName: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  usage: { tables: number; staff: number; orders: number };
}

export default function AdminHqSaasPage(): ReactNode {
  const [overview, setOverview] = useState<HqOverview | null>(null);
  const [tenants, setTenants] = useState<HqTenantRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function loadData(query = '') {
    setLoading(true);
    try {
      const [ovRes, tenRes] = await Promise.all([
        apiFetch<{ success: boolean; data?: HqOverview }>('/api/hq/saas/overview', { silent: true }),
        apiFetch<{ success: boolean; data?: { tenants: HqTenantRow[] } }>(
          `/api/hq/saas/tenants${query ? `?search=${encodeURIComponent(query)}` : ''}`,
          { silent: true }
        ),
      ]);
      if (ovRes.data) setOverview(ovRes.data);
      if (tenRes.data?.tenants) setTenants(tenRes.data.tenants);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function extendTrial(id: string) {
    setMessage(null);
    await apiFetch(`/api/hq/saas/tenants/${id}/extend-trial`, {
      method: 'POST',
      body: JSON.stringify({ days: 14, reason: 'HQ extended trial +14d' }),
    });
    setMessage('Đã gia hạn dùng thử +14 ngày.');
    await loadData(search);
  }

  async function overrideTier(id: string, planId: 'starter' | 'pro' | 'chain') {
    setMessage(null);
    await apiFetch(`/api/hq/saas/tenants/${id}/override-tier`, {
      method: 'POST',
      body: JSON.stringify({ planId, status: 'active', durationDays: 30 }),
    });
    setMessage(`Đã kích hoạt gói ${planId.toUpperCase()} (30 ngày).`);
    await loadData(search);
  }

  async function toggleSuspend(t: HqTenantRow) {
    setMessage(null);
    const suspend = t.lifecycleState !== 'suspended';
    await apiFetch(`/api/hq/saas/tenants/${t.id}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ suspend }),
    });
    setMessage(suspend ? `Đã khóa quán ${t.name}.` : `Đã mở khóa quán ${t.name}.`);
    await loadData(search);
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 text-slate-100">
      <div>
        <h1 className="text-2xl font-bold text-white">HQ SaaS Commercial Control</h1>
        <p className="text-sm text-slate-400">Quản trị toàn bộ cửa hàng đối tác, MRR, trial và kích hoạt gói.</p>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-400">MRR Ước tính</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">
              {overview.mrrVnd.toLocaleString('vi-VN')}đ
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-400">Tổng quán / Trả phí</div>
            <div className="text-2xl font-bold text-white mt-1">
              {overview.totalTenants} / <span className="text-emerald-400">{overview.activePaid}</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-400">Đang Trial / Chuyển đổi</div>
            <div className="text-2xl font-bold text-sky-400 mt-1">
              {overview.inTrial} ({overview.trialConversionPercent}%)
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-400">Grace / Read-Only</div>
            <div className="text-2xl font-bold text-rose-400 mt-1">
              {overview.inGrace} / {overview.inReadOnly}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên quán, slug hoặc email chủ quán..."
          className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white"
        />
        <button
          type="button"
          onClick={() => loadData(search)}
          className="rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950"
        >
          Tìm kiếm
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-3">Cửa hàng</th>
              <th className="p-3">Chủ quán</th>
              <th className="p-3">Gói / Trạng thái</th>
              <th className="p-3">Sử dụng</th>
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
              tenants.map((t) => (
                <tr key={t.id}>
                  <td className="p-3">
                    <div className="font-semibold text-white">{t.name}</div>
                    <div className="font-mono text-[11px] text-amber-400">/s/{t.slug}</div>
                  </td>
                  <td className="p-3">
                    <div>{t.ownerName || '—'}</div>
                    <div className="text-slate-400">{t.ownerEmail || '—'}</div>
                  </td>
                  <td className="p-3">
                    <span className="uppercase font-bold text-white">{t.planId}</span> •{' '}
                    <span className="uppercase text-emerald-400">{t.lifecycleState}</span>
                  </td>
                  <td className="p-3 text-slate-300">
                    {t.usage.tables} bàn • {t.usage.staff} NV • {t.usage.orders} đơn
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => extendTrial(t.id)}
                        className="rounded bg-sky-500/20 px-2 py-1 text-[11px] text-sky-300 hover:bg-sky-500/30"
                      >
                        +14d Trial
                      </button>
                      <button
                        type="button"
                        onClick={() => overrideTier(t.id, 'pro')}
                        className="rounded bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/30"
                      >
                        Kích hoạt Pro
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSuspend(t)}
                        className="rounded bg-rose-500/20 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/30"
                      >
                        {t.lifecycleState === 'suspended' ? 'Mở khóa' : 'Khóa'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
