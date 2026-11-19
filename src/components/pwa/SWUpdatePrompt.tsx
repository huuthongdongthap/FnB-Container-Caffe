import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, X } from 'lucide-react';
import { useSWRegistration } from '@/hooks/use-sw-registration';

/* ═══════════════════════════════════════════════════════════════════
SWUpdatePrompt — top-bar shown when a new Service Worker is waiting.
Calls skipWaiting() then reloads when the new SW takes control.
═══════════════════════════════════════════════════════════════════ */

export default function SWUpdatePrompt() {
  const { isUpdateAvailable, skipWaiting } = useSWRegistration();
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const reloadRequested = useRef(false);
  const releaseReloadListener = useRef<(() => void) | null>(null);

  useEffect(() => () => {
    releaseReloadListener.current?.();
    reloadRequested.current = false;
  }, []);

  if (!isUpdateAvailable || dismissed) return null;

  const handleReload = () => {
    const serviceWorker = navigator.serviceWorker;
    if (reloadRequested.current || !serviceWorker) return;
    reloadRequested.current = true;
    const handler = () => {
      releaseReloadListener.current?.();
      window.location.reload();
    };
    releaseReloadListener.current = () => {
      serviceWorker.removeEventListener('controllerchange', handler);
      releaseReloadListener.current = null;
    };
    // Observe takeover before posting: the worker can respond immediately.
    serviceWorker.addEventListener('controllerchange', handler, { once: true });
    try {
      skipWaiting();
    } catch (error) {
      releaseReloadListener.current?.();
      reloadRequested.current = false;
      throw error;
    }
  };

  return (
    <div
      className="fixed bottom-24 md:bottom-6 right-4 z-[60] flex max-w-[calc(100vw-2rem)] sm:max-w-md items-center justify-between gap-3 rounded-2xl border px-4 py-2 shadow-2xl backdrop-blur-md"
      style={{
        background: 'linear-gradient(135deg, rgba(42,26,10,0.96), rgba(26,45,31,0.96))',
        borderColor: 'rgba(201,214,223,0.24)',
      }}
      role="alert"
    >
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 shrink-0 text-[#CD7F32]" aria-hidden="true" />
        <span className="text-sm font-medium text-[#E4E1E9]">
          {t('pwa.swUpdateAvailable', 'Có bản cập nhật mới')}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleReload}
          className="min-h-[44px] min-w-[44px] px-2.5 flex items-center justify-center rounded-lg text-xs font-semibold text-[#F5B062] hover:bg-white/10 transition-colors"
        >
          {t('pwa.swUpdateReload', 'Tải lại ngay')}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#9BA8B4] hover:text-white hover:bg-white/10 transition-colors"
          aria-label={t('pwa.swUpdateLater', 'Để sau')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
