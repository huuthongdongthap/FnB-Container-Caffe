import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API_BASE, apiFetch } from '@/lib/api-client';
import { MD3Button } from '@/components/md3/md3-button';
import { merchantWebhookUrl, safePayosCheckoutUrl, safeVietQrPreviewUrl } from './saas-settings-urls';

interface MePayload {
  tenantId: string;
  tenant: { id: string; slug: string; name: string };
  entitlement: {
    planId: string;
    plan: { name: string; monthlyPriceVnd: number; annualPriceVnd: number };
    lifecycleState: 'trial' | 'active' | 'grace' | 'readonly' | 'suspended';
    isReadOnly: boolean;
    daysRemaining: number;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
  };
  usage: { tables: number; maxTables: number | null; staff: number; maxStaff: number | null };
  branding: {
    display_name?: string;
    tagline?: string;
    logo_url?: string;
    primary_color?: string;
    accent_color?: string;
    address?: string;
    phone?: string;
    receipt_footer?: string;
  } | null;
  domains: Array<{
    id: string;
    domain: string;
    status: string;
    verification_token: string;
    verified_at?: string | null;
  }>;
}

interface PaymentConfigPayload {
  provider: 'vietqr' | 'payos';
  hasPayosCredentials: boolean;
  bankBin: string;
  bankAccountNo: string;
  bankAccountName: string;
  bankName: string;
  webhookUrl?: string;
  webhookUrlPath: string;
}

interface BillingInvoice {
  id: string;
  tier: string;
  billing_cycle: string;
  amount_vnd: number;
  status: string;
  checkout_url?: string | null;
  paid_at?: string | null;
  created_at: string;
}

const VALID_TABS = new Set(['billing', 'payment', 'branding', 'domains'] as const);

export default function AdminSaasSettingsPage(): ReactNode {
  const [searchParams] = useSearchParams();
  const initialTabParam = searchParams.get('tab');
  const initialTab: 'billing' | 'payment' | 'branding' | 'domains' =
    initialTabParam && VALID_TABS.has(initialTabParam as 'billing' | 'payment' | 'branding' | 'domains')
      ? (initialTabParam as 'billing' | 'payment' | 'branding' | 'domains')
      : 'billing';

  const [tab, setTab] = useState<'billing' | 'payment' | 'branding' | 'domains'>(initialTab);
  const [me, setMe] = useState<MePayload | null>(null);
  const [payment, setPayment] = useState<PaymentConfigPayload | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [sampleQrUrl, setSampleQrUrl] = useState<string | null>(null);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [webhookCopyError, setWebhookCopyError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const mountedRef = useRef(true);
  const loadRequestIdRef = useRef(0);
  const loadInFlightRef = useRef(false);
  const actionInFlightRef = useRef<string | null>(null);
  const brandingDirtyRef = useRef(false);
  const paymentDirtyRef = useRef(false);
  const copyResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const statusParam = searchParams.get('status');
    const invoiceParam = searchParams.get('invoice');
    if (statusParam === 'paid') {
      setNotice({
        type: 'ok',
        text: invoiceParam
          ? `Thanh toán hóa đơn ${invoiceParam} đã được ghi nhận. Gói dịch vụ sẽ tự động gia hạn ngay khi PayOS xác nhận.`
          : 'Thanh toán đã được ghi nhận. Gói dịch vụ sẽ tự động gia hạn ngay khi PayOS xác nhận.',
      });
    } else if (statusParam === 'cancelled') {
      setNotice({
        type: 'err',
        text: 'Giao dịch thanh toán gói dịch vụ đã bị hủy. Bạn có thể tạo hóa đơn mới bất kỳ lúc nào.',
      });
    }
  }, [searchParams]);

  // Payment form state
  const [provider, setProvider] = useState<'vietqr' | 'payos'>('vietqr');
  const [bankBin, setBankBin] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [payosClientId, setPayosClientId] = useState('');
  const [payosApiKey, setPayosApiKey] = useState('');
  const [payosChecksumKey, setPayosChecksumKey] = useState('');

  // Branding form state
  const [displayName, setDisplayName] = useState('');
  const [tagline, setTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1F2937');
  const [accentColor, setAccentColor] = useState('#D97706');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');

  // Domain state
  const [newDomain, setNewDomain] = useState('');

  const loadAll = useCallback(
    async (options?: { isRetry?: boolean; dedupe?: boolean }) => {
      if (options?.dedupe && loadInFlightRef.current) return;
      loadInFlightRef.current = true;
      const requestId = ++loadRequestIdRef.current;

      if (options?.isRetry) setRetrying(true);

      try {
        const [meResult, payResult, billResult] = await Promise.allSettled([
          apiFetch<{ success: boolean; error?: string; data?: MePayload }>('/api/saas/me', { silent: true }),
          apiFetch<{ success: boolean; error?: string; data?: PaymentConfigPayload }>('/api/saas/payment-config', {
            silent: true,
          }),
          apiFetch<{ success: boolean; error?: string; data?: { invoices: BillingInvoice[] } }>(
            '/api/saas/billing/status',
            { silent: true },
          ),
        ]);

        if (!mountedRef.current || requestId !== loadRequestIdRef.current) return;

        const errors: string[] = [];

        if (meResult.status === 'fulfilled' && meResult.value.success && meResult.value.data) {
          const meData = meResult.value.data;
          setMe(meData);
          if (!brandingDirtyRef.current) {
            setDisplayName(meData.branding?.display_name || meData.tenant.name || '');
            setTagline(meData.branding?.tagline || '');
            setLogoUrl(meData.branding?.logo_url || '');
            setPrimaryColor(meData.branding?.primary_color || '#1F2937');
            setAccentColor(meData.branding?.accent_color || '#D97706');
            setAddress(meData.branding?.address || '');
            setPhone(meData.branding?.phone || '');
            setReceiptFooter(meData.branding?.receipt_footer || '');
            brandingDirtyRef.current = false;
          }
        } else {
          const msg =
            meResult.status === 'rejected'
              ? meResult.reason instanceof Error
                ? meResult.reason.message
                : 'Không thể tải thông tin cửa hàng.'
              : meResult.value.error || 'Không thể tải thông tin cửa hàng.';
          errors.push(msg);
        }

        if (payResult.status === 'fulfilled' && payResult.value.success && payResult.value.data) {
          const payData = payResult.value.data;
          setPayment(payData);
          if (!paymentDirtyRef.current) {
            setProvider(payData.provider === 'payos' ? 'payos' : 'vietqr');
            setBankBin(payData.bankBin || '');
            setBankAccountNo(payData.bankAccountNo || '');
            setBankAccountName(payData.bankAccountName || '');
            setBankName(payData.bankName || '');
            paymentDirtyRef.current = false;
          }
        } else {
          const msg =
            payResult.status === 'rejected'
              ? payResult.reason instanceof Error
                ? payResult.reason.message
                : 'Không thể tải cấu hình thanh toán.'
              : payResult.value.error || 'Không thể tải cấu hình thanh toán.';
          errors.push(msg);
        }

        if (billResult.status === 'fulfilled' && billResult.value.success && billResult.value.data?.invoices) {
          setInvoices(billResult.value.data.invoices);
        } else {
          const msg =
            billResult.status === 'rejected'
              ? billResult.reason instanceof Error
                ? billResult.reason.message
                : 'Không thể tải lịch sử hóa đơn.'
              : billResult.value.error || 'Không thể tải lịch sử hóa đơn.';
          errors.push(msg);
        }

        if (errors.length > 0) {
          const uniqueErrors = Array.from(new Set(errors));
          setLoadError(uniqueErrors.join(' '));
        } else {
          setLoadError(null);
        }
      } catch (err) {
        if (!mountedRef.current || requestId !== loadRequestIdRef.current) return;
        setLoadError(err instanceof Error ? err.message : 'Không thể tải cấu hình SaaS.');
      } finally {
        if (requestId === loadRequestIdRef.current) {
          loadInFlightRef.current = false;
          if (mountedRef.current) {
            setLoading(false);
            setRetrying(false);
          }
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function runAction(actionKey: string, task: () => Promise<void>) {
    if (actionInFlightRef.current !== null || loadInFlightRef.current) return;
    actionInFlightRef.current = actionKey;
    setBusyAction(actionKey);
    try {
      await task();
    } finally {
      actionInFlightRef.current = null;
      if (mountedRef.current) {
        setBusyAction(null);
      }
    }
  }

  async function handleCheckout(planId: 'starter' | 'pro' | 'chain', billingCycle: 'monthly' | 'annual') {
    await runAction(`checkout:${planId}:${billingCycle}`, async () => {
      setNotice(null);
      try {
        const res = await apiFetch<{
          success: boolean;
          error?: string;
          data?: { checkoutUrl?: string | null; amountVnd: number; payosOrderCode: string };
        }>('/api/saas/billing/checkout', {
          method: 'POST',
          body: JSON.stringify({ planId, billingCycle }),
        });
        if (!res.success || !res.data) {
          setNotice({ type: 'err', text: res.error || 'Không thể tạo hóa đơn thanh toán.' });
          return;
        }
        const safeCheckoutUrl = safePayosCheckoutUrl(res.data.checkoutUrl);
        if (safeCheckoutUrl) {
          window.open(safeCheckoutUrl, '_blank', 'noopener,noreferrer');
        }
        const invalidCheckoutSuffix =
          res.data.checkoutUrl && !safeCheckoutUrl
            ? ' Liên kết thanh toán chưa hợp lệ nên không tự mở trình duyệt.'
            : '';
        setNotice({
          type: 'ok',
          text: `Đã tạo hóa đơn #${res.data.payosOrderCode} (${res.data.amountVnd.toLocaleString('vi-VN')}đ).${invalidCheckoutSuffix}`,
        });
        await loadAll();
      } catch (err) {
        setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Lỗi tạo hóa đơn.' });
      }
    });
  }

  async function handleSavePayment(e: React.FormEvent) {
    e.preventDefault();
    await runAction('savePayment', async () => {
      setNotice(null);
      const hasAnyPayosInput = Boolean(payosClientId || payosApiKey || payosChecksumKey);
      try {
        const res = await apiFetch<{ success: boolean; error?: string }>('/api/saas/payment-config', {
          method: 'PUT',
          body: JSON.stringify({
            provider,
            bankBin,
            bankAccountNo,
            bankAccountName,
            bankName,
            ...(hasAnyPayosInput ? { payosClientId, payosApiKey, payosChecksumKey } : {}),
          }),
        });
        if (!res.success) {
          setNotice({ type: 'err', text: res.error || 'Không thể lưu cấu hình thanh toán.' });
          return;
        }
        setPayosClientId('');
        setPayosApiKey('');
        setPayosChecksumKey('');
        setNotice({ type: 'ok', text: 'Đã lưu & mã hóa cấu hình thanh toán trực tiếp cho quán.' });
        await loadAll();
      } catch (err) {
        setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Lỗi lưu cấu hình.' });
      }
    });
  }

  async function handleTestPayment() {
    await runAction('testPayment', async () => {
      setNotice(null);
      try {
        const res = await apiFetch<{
          success: boolean;
          error?: string;
          data?: { message: string; sampleQrUrl?: string | null; provider?: string };
        }>('/api/saas/payment-config/test', { method: 'POST' });
        const validatedSampleQr = res.success ? safeVietQrPreviewUrl(res.data?.sampleQrUrl) : null;
        setSampleQrUrl(validatedSampleQr);
        setNotice({
          type: res.success ? 'ok' : 'err',
          text: res.data?.message || res.error || 'Đã kiểm tra kết nối.',
        });
      } catch (err) {
        setSampleQrUrl(null);
        setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Kiểm tra thất bại.' });
      }
    });
  }

  async function handleSaveBranding(e: React.FormEvent) {
    e.preventDefault();
    await runAction('saveBranding', async () => {
      setNotice(null);
      try {
        const res = await apiFetch<{ success: boolean; error?: string }>('/api/saas/branding', {
          method: 'PATCH',
          body: JSON.stringify({
            displayName,
            tagline,
            logoUrl,
            primaryColor,
            accentColor,
            address,
            phone,
            receiptFooter,
          }),
        });
        if (!res.success) {
          setNotice({ type: 'err', text: res.error || 'Lưu thương hiệu thất bại.' });
          return;
        }
        setNotice({ type: 'ok', text: 'Đã cập nhật thương hiệu trang đặt món của quán.' });
        await loadAll();
      } catch (err) {
        setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Lỗi lưu thương hiệu.' });
      }
    });
  }

  async function handleAddDomain(e: React.FormEvent) {
    e.preventDefault();
    await runAction('addDomain', async () => {
      setNotice(null);
      try {
        const res = await apiFetch<{ success: boolean; error?: string }>('/api/saas/domains', {
          method: 'POST',
          body: JSON.stringify({ domain: newDomain }),
        });
        if (!res.success) {
          setNotice({ type: 'err', text: res.error || 'Không thể thêm tên miền.' });
          return;
        }
        setNewDomain('');
        setNotice({ type: 'ok', text: 'Đã thêm tên miền. Vui lòng trỏ bản ghi TXT để xác minh.' });
        await loadAll();
      } catch (err) {
        setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Lỗi thêm tên miền.' });
      }
    });
  }

  async function handleVerifyDomain(id: string) {
    await runAction(`verifyDomain:${id}`, async () => {
      setNotice(null);
      try {
        const res = await apiFetch<{ success: boolean; error?: string }>(`/api/saas/domains/${id}/verify`, {
          method: 'POST',
        });
        setNotice({
          type: res.success ? 'ok' : 'err',
          text: res.success ? 'Tên miền đã được xác minh thành công!' : res.error || 'Chưa tìm thấy bản ghi TXT.',
        });
        await loadAll();
      } catch (err) {
        setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Xác minh DNS thất bại.' });
      }
    });
  }

  async function handleExportData() {
    await runAction('exportData', async () => {
      try {
        const data = await apiFetch<Record<string, unknown>>('/api/saas/export');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aura-export-${me?.tenant.slug || 'store'}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Xuất dữ liệu thất bại.' });
      }
    });
  }

  const safeWebhookUrl = merchantWebhookUrl(payment, API_BASE, import.meta.env.DEV);

  async function handleCopyWebhookUrl() {
    if (!safeWebhookUrl) return;
    setWebhookCopyError(null);
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(safeWebhookUrl);
      if (!mountedRef.current) return;
      setWebhookCopied(true);
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
      copyResetTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) {
          setWebhookCopied(false);
        }
      }, 2500);
    } catch {
      if (!mountedRef.current) return;
      setWebhookCopied(false);
      setWebhookCopyError('Không thể tự động sao chép. Vui lòng chọn và sao chép Webhook URL thủ công.');
    }
  }

  const isBusy = busyAction !== null || retrying || loading;

  if (loading && !me && !loadError) {
    return <div className="p-6 text-slate-400">Đang tải cấu hình SaaS...</div>;
  }

  if (!me && loadError) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div
          role="alert"
          className="rounded-[var(--md-sys-shape-corner-large)] border border-[var(--md-sys-color-error)]/40 bg-[var(--md-sys-color-error-container)]/20 p-6 space-y-4 text-[var(--md-sys-color-on-surface)]"
        >
          <div className="space-y-1">
            <h1 className="m3-headline-small">Không thể tải cấu hình SaaS</h1>
            <p className="m3-body-large">{loadError}</p>
          </div>
          <MD3Button
            type="button"
            variant="filled"
            disabled={retrying}
            onClick={() => void loadAll({ isRetry: true, dedupe: true })}
          >
            {retrying ? 'Đang thử lại...' : 'Thử lại'}
          </MD3Button>
        </div>
      </div>
    );
  }

  const ent = me?.entitlement;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Gói dịch vụ, Thanh toán & Thương hiệu</h1>
          <p className="text-sm text-slate-400">
            Cửa hàng: <strong className="text-white">{me?.tenant.name}</strong> • Link QR:{' '}
            <a
              href={me?.tenant.slug && me.tenant.slug !== 'default' ? `/s/${me.tenant.slug}` : '/'}
              className="font-mono text-amber-400 hover:underline"
            >
              {me?.tenant.slug && me.tenant.slug !== 'default' ? `/s/${me.tenant.slug}` : '/'}
            </a>
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportData}
          disabled={isBusy}
          className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
        >
          Xuất toàn bộ dữ liệu (.JSON)
        </button>
      </div>

      {loadError && (
        <div role="alert" className="rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-error-container)] p-4 text-[var(--md-sys-color-on-error-container)] space-y-2">
          <p className="m3-body-large">Không thể tải đầy đủ cấu hình SaaS. {loadError}</p>
          <MD3Button type="button" variant="outlined" disabled={isBusy}
            onClick={() => void loadAll({ isRetry: true, dedupe: true })}>
            {retrying ? 'Đang thử lại...' : 'Thử lại'}
          </MD3Button>
        </div>
      )}

      {/* Trial / Grace / Readonly Banner */}
      {ent && (
        <div
          className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            ent.isReadOnly
              ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
              : ent.lifecycleState === 'grace'
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          <div className="text-sm">
            Gói hiện tại: <strong className="uppercase">{ent.plan.name}</strong> • Trạng thái:{' '}
            <strong className="uppercase">{ent.lifecycleState}</strong> ({ent.daysRemaining} ngày còn lại)
            {me && (
              <span className="ml-3 text-xs opacity-80">
                Bàn: {me.usage.tables}/{me.usage.maxTables ?? '∞'} • Nhân viên: {me.usage.staff}/
                {me.usage.maxStaff ?? '∞'}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setTab('billing')}
            className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950"
          >
            Nâng cấp / Gia hạn
          </button>
        </div>
      )}

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.type === 'ok'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'billing', label: '1. Gói & Hóa đơn SaaS' },
          { id: 'payment', label: '2. Thanh toán trực tiếp (VietQR / PayOS)' },
          { id: 'branding', label: '3. Thương hiệu quán' },
          { id: 'domains', label: '4. Tên miền riêng (Custom Domain)' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              tab === t.id ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: BILLING */}
      {tab === 'billing' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {[
              { id: 'starter' as const, name: 'Starter', monthly: 199_000, annual: 1_910_400, desc: 'Tối đa 15 bàn, 3 nhân viên, VietQR' },
              { id: 'pro' as const, name: 'Pro', monthly: 499_000, annual: 4_790_400, desc: 'Tối đa 50 bàn, 15 nhân viên, PayOS riêng, Tên miền riêng' },
              { id: 'chain' as const, name: 'Chain', monthly: 1_290_000, annual: 12_384_000, desc: 'Không giới hạn bàn & NV, đa chi nhánh, HQ rollup, API & Webhook' },
            ].map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{p.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">{p.desc}</p>
                </div>
                <div className="flex flex-wrap items-baseline gap-1 text-2xl font-bold text-amber-400">
                  <span>{p.monthly.toLocaleString('vi-VN')}đ</span>
                  <span className="text-xs font-normal text-slate-400">/tháng</span>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleCheckout(p.id, 'monthly')}
                    disabled={isBusy}
                    className="min-h-[44px] rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                  >
                    Thanh toán 1 tháng ({p.monthly.toLocaleString('vi-VN')}đ)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCheckout(p.id, 'annual')}
                    disabled={isBusy}
                    className="min-h-[44px] rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
                  >
                    Thanh toán 1 năm (-20%: {p.annual.toLocaleString('vi-VN')}đ)
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-3">
            <h3 className="text-sm font-bold text-white">Lịch sử hóa đơn gói dịch vụ</h3>
            {invoices.length === 0 ? (
              <p className="text-xs text-slate-400">Chưa có hóa đơn nào.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2">Mã HĐ</th>
                      <th className="py-2">Gói</th>
                      <th className="py-2">Chu kỳ</th>
                      <th className="py-2">Số tiền</th>
                      <th className="py-2">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {invoices.map((inv) => {
                      const checkoutUrl = inv.status === 'pending' ? safePayosCheckoutUrl(inv.checkout_url) : null;
                      return (
                        <tr key={inv.id}>
                          <td className="py-2 font-mono">{inv.id}</td>
                          <td className="py-2 uppercase">{inv.tier}</td>
                          <td className="py-2">{inv.billing_cycle}</td>
                          <td className="py-2 font-semibold">{Number(inv.amount_vnd).toLocaleString('vi-VN')}đ</td>
                          <td className="py-2">
                            {inv.status}
                            {checkoutUrl && (
                              <a href={checkoutUrl} target="_blank" rel="noopener noreferrer"
                                className="ml-3 inline-flex min-h-12 items-center rounded-[var(--md-sys-shape-corner-full)] px-4 text-[var(--md-sys-color-primary)] underline focus-visible:outline focus-visible:outline-2">
                                Thanh toán ngay
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DIRECT MERCHANT PAYMENT */}
      {tab === 'payment' && (
        <form onSubmit={handleSavePayment} onChangeCapture={() => { paymentDirtyRef.current = true; setSampleQrUrl(null); }} className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-5">
          <fieldset disabled={isBusy || !payment} className="min-w-0 space-y-5">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            Tiền bán đồ uống chuyển <strong>trực tiếp</strong> vào tài khoản ngân hàng / PayOS của quán bạn. Nền tảng không giữ hộ tiền và thu 0% phí giao dịch.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Phương thức nhận tiền</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { paymentDirtyRef.current = true; setSampleQrUrl(null); setProvider('vietqr'); }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold border ${
                  provider === 'vietqr' ? 'border-amber-500 bg-amber-500/15 text-amber-300' : 'border-slate-700 text-slate-300'
                }`}
              >
                VietQR Chuyển khoản trực tiếp (Miễn phí)
              </button>
              <button
                type="button"
                onClick={() => { paymentDirtyRef.current = true; setSampleQrUrl(null); setProvider('payos'); }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold border ${
                  provider === 'payos' ? 'border-amber-500 bg-amber-500/15 text-amber-300' : 'border-slate-700 text-slate-300'
                }`}
              >
                PayOS Tự động gạch nợ (Gói Pro+)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Mã ngân hàng (BIN / Viết tắt, VD: MB, VCB, TCB)</label>
              <input
                type="text"
                value={bankBin}
                onChange={(e) => setBankBin(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tên ngân hàng</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="MB Bank"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Số tài khoản nhận tiền</label>
              <input
                type="text"
                value={bankAccountNo}
                onChange={(e) => setBankAccountNo(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tên chủ tài khoản (Không dấu)</label>
              <input
                type="text"
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                placeholder="NGUYEN VAN A"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white uppercase"
              />
            </div>
          </div>

          {provider === 'payos' && (
            <div className="space-y-3 border-t border-slate-800 pt-4">
              <div className="text-xs text-slate-300">
                Khóa PayOS của quán được mã hóa bằng <strong>AES-256-GCM</strong> trước khi lưu.
                {payment?.hasPayosCredentials && (
                  <span className="ml-2 text-emerald-400">✓ Đã lưu khóa (để trống nếu không muốn đổi).</span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="password"
                  placeholder="PayOS Client ID"
                  value={payosClientId}
                  onChange={(e) => setPayosClientId(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
                <input
                  type="password"
                  placeholder="PayOS API Key"
                  value={payosApiKey}
                  onChange={(e) => setPayosApiKey(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
                <input
                  type="password"
                  placeholder="PayOS Checksum Key"
                  value={payosChecksumKey}
                  onChange={(e) => setPayosChecksumKey(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>
              {safeWebhookUrl && (
                <div className="m3-body-large space-y-2 text-[var(--md-sys-color-on-surface-variant)]">
                  <p>Webhook URL dán vào PayOS Dashboard:</p>
                  <code className="block break-all select-all text-[var(--md-sys-color-primary)]">{safeWebhookUrl}</code>
                  <MD3Button type="button" variant="outlined" onClick={() => void handleCopyWebhookUrl()}>
                    {webhookCopied ? 'Đã sao chép' : 'Sao chép Webhook URL'}
                  </MD3Button>
                  {webhookCopyError && <p role="alert">{webhookCopyError}</p>}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
            >
              Lưu cấu hình thanh toán
            </button>
            <button
              type="button"
              onClick={handleTestPayment}
              className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-700"
            >
              Kiểm tra kết nối
            </button>
          </div>
          {sampleQrUrl && (
            <figure className="space-y-2 text-[var(--md-sys-color-on-surface-variant)]">
              <img src={sampleQrUrl} alt="Mã VietQR kiểm tra kết nối" width={240} height={240}
                referrerPolicy="no-referrer" className="max-w-full rounded-[var(--md-sys-shape-corner-medium)]" />
              <figcaption className="m3-body-large">Mã QR mẫu để kiểm tra cấu hình đã lưu, không phải hóa đơn thanh toán.</figcaption>
            </figure>
          )}
          </fieldset>
        </form>
      )}

      {/* TAB 3: BRANDING */}
      {tab === 'branding' && (
        <form onSubmit={handleSaveBranding} onChangeCapture={() => { brandingDirtyRef.current = true; }} className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <fieldset disabled={isBusy} className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tên hiển thị quán</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Slogan / Tagline</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Màu chủ đạo (Header)</label>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-24 rounded-lg border border-slate-700 bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Màu nhấn (Nút đặt món)</label>
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-10 w-24 rounded-lg border border-slate-700 bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Logo URL</label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Hotline quán</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Địa chỉ</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Chân trang hóa đơn (Receipt Footer)</label>
            <input
              type="text"
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
          >
            Lưu thương hiệu
          </button>
          </fieldset>
        </form>
      )}

      {/* TAB 4: CUSTOM DOMAINS */}
      {tab === 'domains' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-5">
          <form onSubmit={handleAddDomain} className="flex flex-col sm:flex-row gap-3">
            <input
              disabled={isBusy}
              type="text"
              required
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="order.quancuaban.vn"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white font-mono"
            />
            <button
              type="submit"
              disabled={isBusy}
              className="rounded-lg bg-amber-500 px-5 py-2 text-xs font-bold text-slate-950"
            >
              + Thêm tên miền (Pro+)
            </button>
          </form>

          <div className="space-y-3">
            {(me?.domains || []).map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-slate-800 bg-slate-950 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-white">{d.domain}</span>
                    <span
                      className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-bold ${
                        d.status === 'verified'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                  {d.status !== 'verified' && (
                    <p className="text-xs text-slate-400">
                      Tạo bản ghi TXT tại <code className="text-amber-300">_aura-verify.{d.domain}</code> với giá trị:{' '}
                      <code className="text-white">{d.verification_token}</code>
                    </p>
                  )}
                </div>
                {d.status !== 'verified' && (
                  <button
                    type="button"
                    onClick={() => handleVerifyDomain(d.id)}
                    disabled={isBusy}
                    className="rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950"
                  >
                    Xác minh DNS
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
