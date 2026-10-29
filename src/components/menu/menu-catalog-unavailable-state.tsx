import { AlertCircle, UtensilsCrossed } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MenuTableBannerProps {
  tableNumber: string;
}

export function MenuTableBanner({ tableNumber }: MenuTableBannerProps) {
  return (
    <aside
      aria-label="Thông tin bàn phục vụ"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-3xl px-4 pointer-events-none"
    >
      <div className="pointer-events-auto flex items-center justify-between gap-3 px-5 py-2.5 rounded-full bg-[var(--aura-noir-bright)]/90 border border-[var(--aura-chrome-mid)]/50 backdrop-blur-md shadow-2xl text-xs sm:text-sm text-[var(--aura-chrome-bright)]">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-[var(--aura-forest-light)] animate-pulse" />
          <UtensilsCrossed className="w-4 h-4 text-[var(--aura-chrome-mid)]" />
          <span>
            Quý khách đang gọi món tại{' '}
            <strong className="text-white font-semibold underline decoration-[var(--aura-chrome-mid)]">
              Bàn {tableNumber}
            </strong>
          </span>
        </div>
        <a
          href="/order"
          className="text-[11px] font-semibold text-[var(--aura-chrome-mid)] hover:text-white uppercase tracking-wider"
        >
          Đổi bàn
        </a>
      </div>
    </aside>
  );
}

interface MenuCatalogUnavailableStateProps {
  hasError: boolean;
  onRetry: () => void;
}

export function MenuCatalogUnavailableState({
  hasError,
  onRetry,
}: MenuCatalogUnavailableStateProps) {
  const { t } = useTranslation();

  return (
    <main
      role="status"
      aria-live="polite"
      className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-24 text-center"
    >
      <AlertCircle className="mb-4 h-12 w-12 text-[var(--aura-chrome-mid)]" aria-hidden="true" />
      <h1 className="text-xl font-bold text-white sm:text-2xl">
        {hasError
          ? t('menu.loadErrorTitle', 'Không thể tải thực đơn lúc này')
          : t('menu.emptyCatalogTitle', 'Thực đơn hiện đang cập nhật')}
      </h1>
      <p className="mt-2 text-sm text-[var(--aura-chrome-mid)]">
        {t(
          'menu.unavailableDescription',
          'Hệ thống chưa lấy được danh sách món phục vụ trực tiếp. Vui lòng thử tải lại hoặc liên hệ nhân viên tại quầy.',
        )}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 min-h-[44px] rounded-full bg-[var(--aura-chrome-bright)] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--aura-noir-deep)] transition hover:brightness-110 cursor-pointer"
      >
        {t('menu.retry', 'Thử lại')}
      </button>
    </main>
  );
}
