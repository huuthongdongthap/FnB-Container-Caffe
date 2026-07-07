import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOrderStore } from '@/hooks/stores/use-order-store';

/* ═══════════════════════════════════════════════════════════════════
OrderQueueIndicator — sticky bottom bar visible when queuedOffline
Shows sync status: retrying → success (auto-dismiss) → error + retry.
Matches offline-banner AURA brand tokens.
═══════════════════════════════════════════════════════════════════ */

export default function OrderQueueIndicator() {
  const { t } = useTranslation();
  const queuedOffline = useOrderStore((s) => s.queuedOffline);
  const syncError = useOrderStore((s) => s.error);
  const flushQueuedOrders = useOrderStore((s) => s.flushQueuedOrders);

  const [dismissed, setDismissed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Reset when a new order is queued
  useEffect(() => {
    if (queuedOffline && !dismissed) {
      setSyncing(false);
      setLocalError(null);
      setShowSuccess(false);
    }
  }, [queuedOffline, dismissed]);

  // Auto-trigger sync 2s after appearing
  useEffect(() => {
    if (!queuedOffline || dismissed || syncing) return;
    const timer = setTimeout(async () => {
      setSyncing(true);
      setLocalError(null);
      try {
        await flushQueuedOrders();
        setSyncing(false);
        setShowSuccess(true);
        // Auto-dismiss after success
        const hideTimer = setTimeout(() => {
          setDismissed(true);
          setShowSuccess(false);
        }, 3000);
        return () => clearTimeout(hideTimer);
      } catch (err) {
        setSyncing(false);
        setLocalError(err instanceof Error ? err.message : 'Lỗi đồng bộ');
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [queuedOffline, dismissed, syncing, flushQueuedOrders]);

  const handleRetry = useCallback(async () => {
    setSyncing(true);
    setLocalError(null);
    try {
      await flushQueuedOrders();
      setSyncing(false);
      setShowSuccess(true);
      setTimeout(() => {
        setDismissed(true);
        setShowSuccess(false);
      }, 3000);
    } catch (err) {
      setSyncing(false);
      setLocalError(err instanceof Error ? err.message : 'Lỗi đồng bộ');
    }
  }, [flushQueuedOrders]);

  if (!queuedOffline || dismissed) return null;

  const errorMsg = localError || syncError;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between border-t px-4 py-3"
      style={{
        background: 'linear-gradient(to top, #1A2D1F, #0A1A2E)',
        borderColor: 'rgba(201,214,223,0.18)',
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        {syncing ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#6B9FB8]" aria-hidden="true" />
        ) : showSuccess ? (
          <span className="text-sm text-[#6B9FB8]" aria-hidden="true">&#10003;</span>
        ) : (
          <AlertTriangle className="h-4 w-4 text-[#D4A76A]" aria-hidden="true" />
        )}
        <span className="text-sm text-[#C9D6DF]">
          {syncing
            ? t('pwa.syncRetrying', 'Đang thử đồng bộ lại...')
            : showSuccess
              ? t('pwa.syncComplete', 'Đồng bộ thành công')
              : errorMsg
                ? t('pwa.syncFailed', 'Không thể đồng bộ đơn hàng')
                : t('pwa.orderQueueCount', '{{count}} đơn đang chờ đồng bộ', { count: 1 })}
        </span>
      </div>
      {!syncing && (
        <div className="flex items-center gap-3">
          {errorMsg && (
            <button
              type="button"
              onClick={handleRetry}
              className="text-xs font-medium text-[#CD7F32] hover:underline"
            >
              {t('pwa.syncRetrying', 'Thử lại')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-[#5A6270] hover:text-[#C9D6DF] transition-colors"
            aria-label={t('pwa.offlineBannerDismiss', 'Đóng')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
