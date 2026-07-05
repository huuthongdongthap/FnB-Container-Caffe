import { useState } from 'react';
import { WifiOff, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/* ═══════════════════════════════════════════════════════════════════
OfflineBanner — top-of-page dismissible sticky banner shown when !isOnline.
Uses AURA CAFE brand tokens from brand-tokens.css.
Bilingual VN + EN via react-i18next keys pwa.offlineBanner / pwa.offlineBannerSub.
═══════════════════════════════════════════════════════════════════ */

interface OfflineBannerProps {
  isOnline: boolean;
}

export default function OfflineBanner({ isOnline }: OfflineBannerProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  if (isOnline || dismissed) return null;

  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-between border-b px-4 py-2"
      style={{
        background: 'linear-gradient(to bottom, #1A2D1F, #0A1A2E)',
        borderColor: 'rgba(201,214,223,0.18)',
      }}
    >
      <div className="flex items-center gap-2">
        <WifiOff className="h-4 w-4 text-[#6B9FB8]" aria-hidden="true" />
        <span className="text-sm font-medium text-[#C9D6DF]">
          {t('pwa.offlineBanner', 'Đang offline — You\'re offline')}
        </span>
        <span className="text-xs text-[#8A8E96]">
          {t(
            'pwa.offlineBannerSub',
            'Đơn hàng sẽ được lưu tạm và gửi khi có mạng',
          )}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-[#5A6270] hover:text-[#C9D6DF] transition-colors"
        aria-label={t('pwa.offlineBannerDismiss', 'Đóng')}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
