import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/use-push-notifications';

interface PushNotificationToggleProps {
  token?: string;
}

export function PushNotificationToggle({ token }: PushNotificationToggleProps) {
  const { t } = useTranslation();
  const {
    permission,
    isSubscribed,
    subscribing,
    error,
    subscribe,
    unsubscribe,
    supported,
  } = usePushNotifications();
  const [showCard, setShowCard] = useState(true);

  if (!showCard || !supported) return null;

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribeAction();
    } else {
      await subscribeAction();
    }
  };

  const subscribeAction = async () => {
    await subscribe();
  };

  const unsubscribeAction = async () => {
    try {
      await unsubscribe();
    } catch {
      // error state handled by hook
    }
  };

  if (permission === 'denied') {
    return (
      <div
        style={styles.container}
      >
        <div style={styles.iconWrapper}>
          <BellOff className="h-5 w-5" style={{ color: '#EF4444' }} />
        </div>
        <div style={styles.textBlock}>
          <p style={styles.title}>
            {t('pushNotif.blockedTitle', 'Thông báo bị chặn')}
          </p>
          <p style={styles.description}>
            {t(
              'pushNotif.blockedDesc',
              'Bạn đã chặn thông báo. Vui lòng bật trong cài đặt trình duyệt.',
            )}
          </p>
          <a
            href="https://support.google.com/chrome/answer/6143569"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            {t('pushNotif.settingsGuide', 'Hướng dẫn mở khóa')}
          </a>
        </div>
      </div>
    );
  }

  if (isSubscribed) {
    return (
      <div style={styles.container}>
        <div style={styles.iconWrapper}>
          <Bell className="h-5 w-5" style={{ color: '#22C55E' }} />
        </div>
        <div style={styles.textBlock}>
          <span style={styles.badge}>
            {t('pushNotif.enabled', 'Đã bật')}
          </span>
          <p style={styles.description}>
            {t(
              'pushNotif.subscribedDesc',
              'Bạn sẽ nhận thông báo về đơn hàng và khuyến mãi.',
            )}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleToggle}
          disabled={subscribing}
          style={styles.actionButton}
        >
          {t('pushNotif.turnOff', 'Tắt')}
        </Button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.iconWrapper}>
        <Bell className="h-5 w-5" style={{ color: '#F97316' }} />
      </div>
      <div style={styles.textBlock}>
        <p style={styles.title}>
          {t('pushNotif.enableTitle', 'Bật thông báo đẩy')}
        </p>
        <p style={styles.description}>
          {t(
            'pushNotif.enableDesc',
            'Nhận cập nhật về đơn hàng, khuyến mãi và thông báo quan trọng.',
          )}
        </p>
      </div>
      <Button
        size="sm"
        onClick={handleToggle}
        loading={subscribing}
        style={styles.actionButton}
      >
        {t('pushNotif.enable', 'Bật thông báo')}
      </Button>
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    fontFamily: '"Space Grotesk", system-ui, sans-serif',
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    minHeight: '72px',
  },
  iconWrapper: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    backgroundColor: 'rgba(249,115,22,0.12)',
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: '#E5E7EB',
    lineHeight: '1.3',
    fontFamily: '"Space Grotesk", system-ui, sans-serif',
  },
  description: {
    margin: '4px 0 0',
    fontSize: '12px',
    color: '#9CA3AF',
    lineHeight: '1.4',
    fontFamily: '"Space Grotesk", system-ui, sans-serif',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#22C55E',
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: '9999px',
    fontFamily: '"Space Grotesk", system-ui, sans-serif',
  },
  actionButton: {
    flexShrink: 0,
  },
  error: {
    position: 'absolute',
    bottom: '-18px',
    left: '16px',
    fontSize: '11px',
    color: '#EF4444',
    fontFamily: '"Space Grotesk", system-ui, sans-serif',
  },
  link: {
    display: 'inline-block',
    marginTop: '8px',
    fontSize: '12px',
    color: '#F97316',
    textDecoration: 'none',
    fontWeight: 500,
    fontFamily: '"Space Grotesk", system-ui, sans-serif',
  },
};
