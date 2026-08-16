/**
 * NotificationPreferences — Push notification toggle for account page.
 * Uses the existing usePushNotifications hook for subscribe/unsubscribe.
 * Dark navy glass card matching Aura Cafe design system.
 */
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { Bell, BellOff, Loader2 } from 'lucide-react';

interface NotificationPreferencesProps {
  customerId?: string;
}

export function NotificationPreferences({ customerId }: NotificationPreferencesProps) {
  const {
    isSubscribed,
    subscribing,
    permission,
    error,
    subscribe,
    unsubscribe,
    supported,
  } = usePushNotifications();

  if (!supported) return null;

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe(customerId);
    }
  };

  return (
    <div className="rounded-2xl p-4 bg-[var(--aura-noir-deep)]/60 backdrop-blur-md border border-[var(--aura-border-chrome)]/20">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {isSubscribed ? (
            <Bell className="w-5 h-5 text-[var(--aura-forest-primary)] shrink-0" />
          ) : (
            <BellOff className="w-5 h-5 text-[var(--aura-chrome-mid)] shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--aura-chrome-bright)]">
              Thông báo đẩy
            </p>
            <p className="text-xs text-[var(--aura-chrome-mid)] mt-0.5">
              {isSubscribed
                ? 'Đang nhận thông báo trạng thái đơn hàng'
                : permission === 'denied'
                  ? 'Đã bị chặn — vui lòng cài đặt lại trong trình duyệt'
                  : 'Bật để nhận thông báo trạng thái đơn hàng'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggle}
          disabled={subscribing || permission === 'denied'}
          className={`relative shrink-0 w-12 h-7 rounded-full transition-colors duration-200 cursor-pointer
            disabled:opacity-50 disabled:cursor-not-allowed
            ${isSubscribed
              ? 'bg-[var(--aura-forest-primary)]'
              : 'bg-[var(--aura-chrome-mid)]/30 border border-[var(--aura-border-chrome)]/30'
            }`}
          aria-label={isSubscribed ? 'Tắt thông báo' : 'Bật thông báo'}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200
              ${isSubscribed ? 'translate-x-5' : 'translate-x-0'}`}
          />
          {subscribing && (
            <Loader2 className="absolute inset-0 m-auto w-4 h-4 text-white animate-spin" />
          )}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 mt-2 pl-8">{error}</p>
      )}
    </div>
  );
}
