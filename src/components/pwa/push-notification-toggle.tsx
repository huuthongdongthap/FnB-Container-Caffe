import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { styles } from './push-notification-toggle-styles';
import type { PushNotificationToggleProps } from './push-notification-toggle-types';

export type { PushNotificationToggleProps } from './push-notification-toggle-types';

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
      <div style={styles.container}>
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
