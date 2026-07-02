import { useState } from 'react';
import { Bell, BellOff, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/use-push-notifications';

interface NotificationBannerProps {
  customerId?: string;
  compact?: boolean;
}

export function NotificationBanner({ customerId, compact = false }: NotificationBannerProps) {
  const { permission, isSubscribed, subscribing, error, subscribe, unsubscribe, supported } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);

  if (!supported || dismissed) return null;

  // Already subscribed
  if (isSubscribed) {
    if (compact) {
      return (
        <div className="flex items-center gap-2 text-xs text-green-400">
          <CheckCircle2 className="h-3 w-3" />
          <span>Da bat thong bao don hang</span>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Thong bao da duoc bat</span>
          </div>
          <Button size="sm" variant="ghost" onClick={unsubscribe}>
            <BellOff className="h-3 w-3 mr-1" /> Tat
          </Button>
        </div>
      </div>
    );
  }

  // Permission denied
  if (permission === 'denied') {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 text-sm text-amber-400">
          <BellOff className="h-4 w-4" />
          <span>Thong bao da bi chan. Vao cai dat trinh duyet de bat lai.</span>
        </div>
      </div>
    );
  }

  // Opt-in prompt
  return (
    <div className="rounded-xl border border-chrome-light/10 bg-gradient-to-br from-[#0A1A2E]/80 to-[#050D1A]/90 p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            <Bell className="h-5 w-5 text-chrome-bright" />
          </div>
          <div>
            <p className="text-sm font-medium text-chrome-bright">
              Bat thong bao don hang
            </p>
            <p className="mt-0.5 text-xs text-chrome-light/60">
              Nhan thong bao khi don hang thay doi trang thai (xac nhan, dang lam, san sang)
            </p>
          </div>
        </div>
        {!compact && (
          <button
            onClick={() => setDismissed(true)}
            className="text-chrome-light/40 hover:text-chrome-light/80"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
      <Button
        size="sm"
        className="mt-3"
        onClick={() => subscribe(customerId)}
        loading={subscribing}
        disabled={subscribing}
      >
        {subscribing ? 'Dang bat...' : 'Bat thong bao'}
      </Button>
    </div>
  );
}
