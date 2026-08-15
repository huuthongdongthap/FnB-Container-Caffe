import { useTranslation } from 'react-i18next';

export function DinDinLoading() {
  const { t } = useTranslation('admin');
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <p className="text-sm text-[var(--aura-text-secondary)]">{t('loading', { defaultValue: 'Đang tải...' })}</p>
    </div>
  );
}
