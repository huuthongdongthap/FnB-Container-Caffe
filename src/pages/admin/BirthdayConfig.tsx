import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
   ═══════════════════════════════════════════════════════════════════ */

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
      <button onClick={onDismiss} className="ml-2 text-white/70 hover:text-white transition-colors" aria-label="Dismiss">
        &times;
      </button>
    </div>
  );
}

/* ─── Skeleton ─── */

function SkeletonForm() {
  return (
    <div className="space-y-5 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

/* ─── Toggle switch ─── */

function Toggle({
  checked,
  onChange,
  label,
  hint,
  id,
  t,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  id: string;
  t: (key: string) => string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex-1">
        <label htmlFor={id} className="text-sm font-medium text-[var(--aura-text-primary)] cursor-pointer">
          {label}
        </label>
        {hint && <p className="text-xs text-[var(--aura-chrome-dark)] mt-0.5">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aura-chrome-light)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--aura-noir-deep)] ${checked ? 'bg-[var(--aura-forest-primary)]' : 'bg-[var(--aura-noir-steel)]'}`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
      <span className="text-xs font-medium text-[var(--aura-chrome-mid)] min-w-[2rem] text-right self-center">
        {checked ? t('adminBirthday.enabledLabel') : t('adminLogin.cancelButton') || 'Tắt'}
      </span>
    </div>
  );
}

/* ─── Main page ─── */

export default function AdminBirthdayConfigPage() {
  const { t } = useTranslation();
  const { config, loading, error, refetch, save, sending } = useBirthdayAdmin();
  const [form, setForm] = useState<BirthdayConfig | null>(null);
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null);

  useEffect(() => {
    if (config && !form) {
      setForm({ ...config });
    }
  }, [config, form]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleSave = async () => {
    if (!form) return;
    try {
      await save(form);
      setToast({ kind: 'success', message: t('adminBirthday.saveSuccess') });
    } catch {
      setToast({ kind: 'error', message: t('adminBirthday.saveError') });
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
        title={`${t('adminBirthday.title')} — AURA CAFE`}
        description={t('adminBirthday.description')}
      />
      <div className="min-h-screen bg-[var(--aura-noir-void)] p-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6">
            <h1 className="text-2xl font-display font-bold text-[var(--aura-chrome-bright)]">
              {t('adminBirthday.title')}
            </h1>
            <p className="text-sm text-[var(--aura-text-muted)] mt-2">{t('adminBirthday.subtitle')}</p>
          </div>

          {loading && (
            <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)]">
              <CardBody>
                <SkeletonForm />
              </CardBody>
            </Card>
          )}

          {error && (
            <Card className="border-red-500/30 bg-red-500/5">
              <CardBody className="flex flex-col items-center gap-3 py-8">
                <Badge color="error">Error</Badge>
                <p className="text-sm text-red-400">{t('adminBirthday.saveError')}</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  {t('common.retry')}
                </Button>
              </CardBody>
            </Card>
          )}

          {form && (
            <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)]">
              <CardHeader className="pb-2">
                <h2 className="text-lg font-semibold text-[var(--aura-chrome-bright)]">{t('adminBirthday.configTitle')}</h2>
              </CardHeader>
              <CardBody className="space-y-1 divide-y divide-[var(--glass-border)]">
                <Toggle
                  id="auto-send"
                  checked={form.autoSendEnabled}
                  onChange={(v) => setForm({ ...form, autoSendEnabled: v })}
                  label={t('adminBirthday.autoSendLabel')}
                  hint={t('adminBirthday.autoSendHint')}
                  t={t}
                />

                <div className="pt-3 space-y-1">
                  <label className="text-sm font-medium text-[var(--aura-text-primary)]">{t('adminBirthday.discountPercentLabel')}</label>
                  <p className="text-xs text-[var(--aura-chrome-dark)]">{t('adminBirthday.discountHint')}</p>
                  <Input
                    type="number"
                    value={form.discountPercent}
                    onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })}
                    className="bg-[var(--aura-noir-deep)] border-[var(--glass-border)] text-[var(--aura-chrome-bright)]"
                  />
                </div>

                <div className="pt-3 space-y-1">
                  <label className="text-sm font-medium text-[var(--aura-text-primary)]">{t('adminBirthday.earlyWindowLabel')}</label>
                  <Input
                    type="number"
                    value={form.earlyWindowDays}
                    onChange={(e) => setForm({ ...form, earlyWindowDays: Number(e.target.value) })}
                    className="bg-[var(--aura-noir-deep)] border-[var(--glass-border)] text-[var(--aura-chrome-bright)]"
                  />
                </div>

                <div className="pt-3 space-y-1">
                  <label className="text-sm font-medium text-[var(--aura-text-primary)]">{t('adminBirthday.lateWindowLabel')}</label>
                  <Input
                    type="number"
                    value={form.lateWindowDays}
                    onChange={(e) => setForm({ ...form, lateWindowDays: Number(e.target.value) })}
                    className="bg-[var(--aura-noir-deep)] border-[var(--glass-border)] text-[var(--aura-chrome-bright)]"
                  />
                </div>

                <p className="text-xs text-[var(--aura-chrome-dark)] pt-1">{t('adminBirthday.windowHint')}</p>

                <Toggle
                  id="free-item"
                  checked={form.freeItemEnabled}
                  onChange={(v) => setForm({ ...form, freeItemEnabled: v })}
                  label={t('adminBirthday.freeItemEnabledLabel')}
                  hint={t('adminBirthday.freeItemHint')}
                  t={t}
                />

                <div className="pt-4">
                  <Button
                    onClick={handleSave}
                    disabled={sending || !hasChanges}
                    className="bg-[var(--aura-forest-primary)] hover:bg-[var(--aura-forest-primary)]/80 text-white"
                  >
                    {sending ? t('common.loading') : t('common.save')}
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {toast && <ToastBar kind={toast.kind} message={toast.message} onDismiss={() => setToast(null)} />}
    </>
  );
}
