import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOrderStore } from '@/hooks/stores/use-order-store';
import { useOnlineStatus } from '@/hooks/use-online-status';

/* ═══════════════════════════════════════════════════════════════════
OrderQueueIndicator — sticky bottom bar visible when queuedOffline
Shows pending/retrying/error status; a completed queue hides the indicator.
Matches offline-banner AURA brand tokens.
═══════════════════════════════════════════════════════════════════ */

export default function OrderQueueIndicator() {
  const { t } = useTranslation();
  const { isOnline } = useOnlineStatus();
  const queuedOffline = useOrderStore((s) => s.queuedOffline);
  const syncError = useOrderStore((s) => s.error);
  const flushQueuedOrders = useOrderStore((s) => s.flushQueuedOrders);

  const [dismissed, setDismissed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const mounted = useRef(false);
  const episode = useRef(0);
  const syncInProgress = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; episode.current += 1; };
  }, []);

  // A new queue must not inherit a prior dismissal, error or async result.
  useEffect(() => {
    if (!queuedOffline) return;
    episode.current += 1;
    setDismissed(false);
    setSyncing(syncInProgress.current);
    setLocalError(null);
  }, [queuedOffline]);

  useEffect(() => {
    if (isOnline) {
      // A late failure from the old connection must not cancel this retry window.
      episode.current += 1;
      setLocalError(null);
    }
  }, [isOnline]);

  const syncQueue = useCallback(async () => {
    if (syncInProgress.current) return;
    syncInProgress.current = true;
    const owner = episode.current;
    setSyncing(true);
    setLocalError(null);
    try {
      await flushQueuedOrders();
      if (!mounted.current || owner !== episode.current) return;
      const { error: postSyncError, queuedOffline: stillQueued } = useOrderStore.getState();
      if (postSyncError || stillQueued) {
        setLocalError(postSyncError || 'Lỗi đồng bộ');
        return;
      }
    } catch (err) {
      if (mounted.current && owner === episode.current) {
        setLocalError(err instanceof Error ? err.message : 'Lỗi đồng bộ');
      }
    } finally {
      syncInProgress.current = false;
      if (mounted.current) setSyncing(false);
    }
  }, [flushQueuedOrders]);

  // Attempt once after appearing; a failure waits for explicit retry or reconnect.
  useEffect(() => {
    if (!isOnline || !queuedOffline || dismissed || syncing || localError) return;
    const timer = setTimeout(() => { void syncQueue(); }, 2000);
    return () => clearTimeout(timer);
  }, [isOnline, queuedOffline, dismissed, syncing, localError, syncQueue]);

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
        ) : (
          <AlertTriangle className="h-4 w-4 text-[#D4A76A]" aria-hidden="true" />
        )}
        <span className="text-sm text-[#C9D6DF]">
          {syncing
            ? t('pwa.syncRetrying', 'Đang thử đồng bộ lại...')
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
              onClick={syncQueue}
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
