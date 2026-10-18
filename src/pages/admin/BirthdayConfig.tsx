import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useBirthdayAdmin, type BirthdayConfig } from '@/hooks/use-birthday-admin';
import { ToastBar, type ToastKind } from './birthday-toast-bar';
import { SkeletonForm } from './birthday-skeleton-form';
import { Toggle } from './birthday-toggle';

/* ═══════════════════════════════════════════════════════════════════
   AdminBirthdayConfigPage — /admin/birthday
   Birthday reward settings: discount, free item, window days, auto-send.
   ═══════════════════════════════════════════════════════════════════ */

export default function AdminBirthdayConfigPage() {
  const { t } = useTranslation();
  const birthdayHook = useBirthdayAdmin() as ReturnType<typeof useBirthdayAdmin> & {
    loading?: boolean;
    sending?: boolean;
  };
  const { config, error, refetch, save } = birthdayHook;
  const loading = birthdayHook.isLoading ?? birthdayHook.loading ?? false;
  const sending = birthdayHook.isSaving ?? birthdayHook.sending ?? false;
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
                <Badge variant="destructive">Error</Badge>
                <p className="text-sm text-red-400">{t('adminBirthday.saveError')}</p>
                <Button variant="secondary" size="sm" onClick={() => refetch()}>
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
                  <p className="text-xs text-on-surface-variant">{t('adminBirthday.discountHint')}</p>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={form.discountPercent}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      const clamped = Number.isNaN(raw) ? 1 : Math.min(100, Math.max(1, raw));
                      setForm({ ...form, discountPercent: clamped });
                    }}
                    className="bg-[var(--aura-noir-deep)] border-[var(--glass-border)] text-[var(--aura-chrome-bright)]"
                  />
                </div>

                <div className="pt-3 space-y-1">
                  <label className="text-sm font-medium text-[var(--aura-text-primary)]">{t('adminBirthday.earlyWindowLabel')}</label>
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    value={form.earlyWindowDays}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      const clamped = Number.isNaN(raw) ? 0 : Math.min(30, Math.max(0, raw));
                      setForm({ ...form, earlyWindowDays: clamped });
                    }}
                    className="bg-[var(--aura-noir-deep)] border-[var(--glass-border)] text-[var(--aura-chrome-bright)]"
                  />
                </div>

                <div className="pt-3 space-y-1">
                  <label className="text-sm font-medium text-[var(--aura-text-primary)]">{t('adminBirthday.lateWindowLabel')}</label>
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    value={form.lateWindowDays}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      const clamped = Number.isNaN(raw) ? 0 : Math.min(30, Math.max(0, raw));
                      setForm({ ...form, lateWindowDays: clamped });
                    }}
                    className="bg-[var(--aura-noir-deep)] border-[var(--glass-border)] text-[var(--aura-chrome-bright)]"
                  />
                </div>

                <p className="text-xs text-on-surface-variant pt-1">{t('adminBirthday.windowHint')}</p>

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
