import { useTranslation } from 'react-i18next';
import { RefreshCw, X } from 'lucide-react';
import { useSWRegistration } from '@/hooks/use-sw-registration';

/* ═══════════════════════════════════════════════════════════════════
SWUpdatePrompt — top-bar shown when a new Service Worker is waiting.
Calls skipWaiting() then reloads when the new SW takes control.
═══════════════════════════════════════════════════════════════════ */

export default function SWUpdatePrompt() {
  const { isUpdateAvailable, skipWaiting } = useSWRegistration();
  const { t } = useTranslation('pwa');

  if (!isUpdateAvailable) return null;

  const handleReload = () => {
    skipWaiting();
    // controllerchange fires → new SW controls → reload
    const handler = () => window.location.reload();
    navigator.serviceWorker.addEventListener('controllerchange', handler, { once: true });
  };

  return (
    <div
      className="sticky top-0 z-[60] flex items-center justify-between border-b px-4 py-2"
      style={{
        background: 'linear-gradient(to bottom, #2A1A0A, #1A2D1F)',
        borderColor: 'rgba(201,214,223,0.18)',
      }}
      role="alert"
    >
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-[#CD7F32]" aria-hidden="true" />
        <span className="text-sm font-medium text-[#C9D6DF]">
          {t('pwa.swUpdateAvailable', 'Có bản cập nhật mới')}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleReload}
          className="text-xs font-medium text-[#CD7F32] hover:underline"
        >
          {t('pwa.swUpdateReload', 'Tải lại ngay')}
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-[#5A6270] hover:text-[#C9D6DF] transition-colors"
          aria-label={t('pwa.swUpdateLater', 'Để sau')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
