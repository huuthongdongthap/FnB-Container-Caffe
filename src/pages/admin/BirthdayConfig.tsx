import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useBirthdayAdmin, type BirthdayConfig } from '@/hooks/use-birthday-admin';

/* ═══════════════════════════════════════════════════════════════════
   AdminBirthdayConfigPage — /admin/birthday
   Birthday reward settings: discount, free item, window days, auto-send.
   Dark theme, bilingual VN/EN, loading skeleton, error retry, green toast.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Toast component (lightweight, no external dep) ─── */

type ToastKind = 'success' | 'error';

function ToastBar({
  kind,
  message,
  onDismiss,
}: {
  kind: ToastKind;
  message: string;
  onDismiss: () => void;
}) {
  const bg = kind === 'success' ? 'bg-green-700' : 'bg-red-700';
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3 shadow-2xl ${bg} text-white text-sm font-medium animate-slide-up`}
      role="alert"
    >
      <span>{message}</span>
      <button
        onClick={onDismiss}
        className="ml-2 text-white/70 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}

/* ─── Locale labels (bilingual VN/EN) ─── */

const LOCALE = {
  title: { vi: 'Cấu hình quà tặng sinh nhật', en: 'Birthday Reward Settings' },
  description: {
    vi: 'Tuỳ chỉnh chương trình quà tặng sinh nhật cho khách hàng thân thiết',
    en: 'Customize birthday rewards for loyal customers',
  },
  discountPercent: { vi: 'Phần trăm giảm giá', en: 'Discount %' },
  freeItemEnabled: { vi: 'Tặng kèm món miễn phí', en: 'Free Item' },
  freeItemHint: {
    vi: 'Tặng kèm một món đồ uống hoặc bánh miễn phí khi mua hàng',
    en: 'Include a free drink or pastry with purchase',
  },
  earlyWindow: { vi: 'Số ngày trước sinh nhật', en: 'Early Window (days)' },
  lateWindow: { vi: 'Số ngày sau sinh nhật', en: 'Late Window (days)' },
  windowHint: {
    vi: 'Tổng thời gian khách hàng có thể nhận ưu đãi',
    en: 'Total window for customer to claim the reward',
  },
  autoSend: { vi: 'Tự động gửi quà', en: 'Auto-Send' },
  autoSendHint: {
    vi: 'Tự động gửi mã giảm giá qua SMS/Zalo khi đến hạn',
    en: 'Automatically send discount code via SMS/Zalo on due date',
  },
  save: { vi: 'Lưu cài đặt', en: 'Save Settings' },
  saving: { vi: 'Đang lưu...', en: 'Saving...' },
  saved: { vi: 'Đã lưu cài đặt thành công!', en: 'Settings saved successfully!' },
  saveFailed: { vi: 'Lưu thất bại. Vui lòng thử lại.', en: 'Save failed. Please try again.' },
  loadError: {
    vi: 'Không thể tải cấu hình. Vui lòng thử lại.',
    en: 'Failed to load configuration. Please try again.',
  },
  retry: { vi: 'Thử lại', en: 'Retry' },
  loading: { vi: 'Đang tải...', en: 'Loading...' },
  enabled: { vi: 'Bật', en: 'ON' },
  disabled: { vi: 'Tắt', en: 'OFF' },
  discountHint: {
    vi: 'Phần trăm giảm giá cho đơn hàng (0-100)',
    en: 'Discount percentage for the order (0-100)',
  },
} as const;

/* ─── Toggle component ─── */

function Toggle({
  checked,
  onChange,
  label,
  hint,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  id: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex-1">
        <label htmlFor={id} className="text-sm font-medium text-[var(--aura-text-primary)] cursor-pointer">
          {label}
        </label>
        {hint && (
          <p className="text-xs text-[var(--aura-chrome-dark)] mt-0.5">{hint}</p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2
          focus-visible:ring-[var(--aura-chrome-light)] focus-visible:ring-offset-2
          focus-visible:ring-offset-[var(--aura-noir-deep)]
          ${checked ? 'bg-[var(--aura-forest-primary)]' : 'bg-[var(--aura-noir-steel)]'}
        `}
      >
        <span
          aria-hidden="true"
          className={`
            pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-lg ring-0
            transition-transform duration-200 ease-in-out
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
      <span className="text-xs font-medium text-[var(--aura-chrome-mid)] min-w-[2rem] text-right self-center">
        {checked ? LOCALE.enabled.vi : LOCALE.disabled.vi}
      </span>
    </div>
  );
}

/* ─── Skeleton view ─── */

function SkeletonForm() {
  return (
    <div className="space-y-5 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="flex items-center gap-4 py-3">
        <div className="flex-1 space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton variant="rectangular" className="h-7 w-12 rounded-full" />
      </div>
      <Skeleton variant="rectangular" className="h-12 w-40 rounded-xl" />
    </div>
  );
}

/* ─── Error view ─── */

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-center">
      <p className="text-sm text-red-300 mb-3">{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        {LOCALE.retry.vi} / {LOCALE.retry.en}
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Main Page                                                        */
/* ═══════════════════════════════════════════════════════════════════ */

export default function AdminBirthdayConfigPage() {
  const { config, isLoading, error, refetch, save, isSaving, saveError } = useBirthdayAdmin();

  const [form, setForm] = useState<BirthdayConfig | null>(null);
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null);

  /* Sync server config into form when loaded */
  useEffect(() => {
    if (config && !form) {
      setForm({ ...config });
    }
  }, [config, form]);

  /* Auto-dismiss toast after 3s */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSave = async () => {
    if (!form) return;
    try {
      await save(form);
      setToast({ kind: 'success', message: LOCALE.saved.vi + ' / ' + LOCALE.saved.en });
    } catch {
      setToast({ kind: 'error', message: LOCALE.saveFailed.vi + ' / ' + LOCALE.saveFailed.en });
    }
  };

  const hasChanges =
    config &&
    (config.discountPercent !== form?.discountPercent ||
      config.freeItemEnabled !== form?.freeItemEnabled ||
      config.earlyWindowDays !== form?.earlyWindowDays ||
      config.lateWindowDays !== form?.lateWindowDays ||
      config.autoSendEnabled !== form?.autoSendEnabled);

  return (
    <>
      <HelmetHead
        title="Cấu hình sinh nhật — Birthday Config — AURA CAFE"
        description="Cấu hình ưu đãi sinh nhật, giảm giá và quà tặng cho khách hàng tại AURA CAFE. Birthday reward settings, discounts & free items."
      />
      <div className="min-h-screen bg-[var(--aura-noir-void)] p-6">
        <div className="mx-auto max-w-2xl">
          {/* ── Header ── */}
          <div className="mb-6">
            <h1 className="text-2xl font-display font-bold text-[var(--aura-chrome-bright)]">
              {LOCALE.title.vi}
            </h1>
          <p className="text-xs text-[var(--aura-chrome-dark)] mt-1 uppercase tracking-wider font-utility">
            {LOCALE.title.en}
          </p>
          <p className="text-sm text-[var(--aura-text-muted)] mt-2">{LOCALE.description.vi}</p>
          <p className="text-xs text-[var(--aura-chrome-dark)]">{LOCALE.description.en}</p>
        </div>

        {/* ── Loading state ── */}
        {isLoading && (
          <Card>
            <CardBody>
              <SkeletonForm />
            </CardBody>
          </Card>
        )}

        {/* ── Error state ── */}
        {!isLoading && error && (
          <ErrorBanner
            message={`${LOCALE.loadError.vi} / ${LOCALE.loadError.en}`}
            onRetry={() => {
              refetch();
              setForm(null);
            }}
          />
        )}

        {/* ── Form ── */}
        {!isLoading && !error && form && (
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold text-[var(--aura-chrome-bright)]">
                  {LOCALE.discountPercent.vi}
                </h2>
                <span className="text-xs text-[var(--aura-chrome-dark)] uppercase tracking-wider">
                  {LOCALE.discountPercent.en}
                </span>
              </CardHeader>
              <CardBody className="space-y-4">
                <Input
                  label={`${LOCALE.discountPercent.vi} (${LOCALE.discountPercent.en})`}
                  id="birthday-discount"
                  type="number"
                  min={0}
                  max={100}
                  value={form.discountPercent}
                  onChange={(e) =>
                    setForm({ ...form, discountPercent: Math.max(0, Math.min(100, Number(e.target.value))) })
                  }
                  helperText={LOCALE.discountHint.vi + ' / ' + LOCALE.discountHint.en}
                />
              </CardBody>
            </Card>

            {/* ― Window Days ― */}
            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold text-[var(--aura-chrome-bright)]">
                  Thời gian áp dụng / Window Period
                </h2>
              </CardHeader>
              <CardBody className="space-y-4">
                <Input
                  label={`${LOCALE.earlyWindow.vi} (${LOCALE.earlyWindow.en})`}
                  id="birthday-early"
                  type="number"
                  min={0}
                  max={30}
                  value={form.earlyWindowDays}
                  onChange={(e) =>
                    setForm({ ...form, earlyWindowDays: Math.max(0, Math.min(30, Number(e.target.value))) })
                  }
                />
                <Input
                  label={`${LOCALE.lateWindow.vi} (${LOCALE.lateWindow.en})`}
                  id="birthday-late"
                  type="number"
                  min={0}
                  max={30}
                  value={form.lateWindowDays}
                  onChange={(e) =>
                    setForm({ ...form, lateWindowDays: Math.max(0, Math.min(30, Number(e.target.value))) })
                  }
                />
                <p className="text-xs text-[var(--aura-chrome-dark)]">
                  {LOCALE.windowHint.vi} / {LOCALE.windowHint.en}
                </p>
              </CardBody>
            </Card>

            {/* ― Toggles ― */}
            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold text-[var(--aura-chrome-bright)]">
                  Tuỳ chọn / Options
                </h2>
              </CardHeader>
              <CardBody className="divide-y divide-[var(--aura-border-soft)]">
                <Toggle
                  id="birthday-free-item"
                  checked={form.freeItemEnabled}
                  onChange={(v) => setForm({ ...form, freeItemEnabled: v })}
                  label={`${LOCALE.freeItemEnabled.vi} (${LOCALE.freeItemEnabled.en})`}
                  hint={`${LOCALE.freeItemHint.vi} / ${LOCALE.freeItemHint.en}`}
                />
                <Toggle
                  id="birthday-auto-send"
                  checked={form.autoSendEnabled}
                  onChange={(v) => setForm({ ...form, autoSendEnabled: v })}
                  label={`${LOCALE.autoSend.vi} (${LOCALE.autoSend.en})`}
                  hint={`${LOCALE.autoSendHint.vi} / ${LOCALE.autoSendHint.en}`}
                />
              </CardBody>
            </Card>

            {/* ── Save button ── */}
            <div className="flex items-center gap-3">
              <Button onClick={handleSave} loading={isSaving} disabled={!hasChanges && !isSaving} size="md">
                {isSaving ? LOCALE.saving.vi : LOCALE.save.vi}
              </Button>
              {saveError && (
                <span className="text-xs text-red-400">
                  {LOCALE.saveFailed.vi}
                </span>
              )}
              {!hasChanges && config && !isSaving && (
                <Badge variant="info">
                  {LOCALE.loading.vi} / {LOCALE.loading.en}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* ── Toast ── */}
        {toast && (
          <ToastBar kind={toast.kind} message={toast.message} onDismiss={() => setToast(null)} />
        )}
      </div>
    </div>
    </>
  );
}
