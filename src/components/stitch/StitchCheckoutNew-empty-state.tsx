import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';

export function EmptyCartState() {
  const { t } = useTranslation();

  return (
    <section
      className="flex min-h-screen items-center justify-center bg-[var(--aura-surface-container)]"
      role="status"
      aria-label={t('stitch.emptyCartTitle', 'Your cart is empty')}
    >
      <div className="flex flex-col items-center gap-6 px-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--aura-surface-container)_75%,transparent)] backdrop-blur-[20px] border border-[rgba(198,198,199,0.15)]">
          <Package className="w-10 h-10 text-[var(--aura-chrome-soft)]" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-['EB_Garamond'] text-2xl font-medium text-[var(--aura-noir-void)]">
            {t('stitch.emptyCartTitle', 'Your cart is empty')}
          </h2>
          <p className="mt-2 text-[var(--aura-chrome-soft)]">
            {t('stitch.emptyCartDesc', 'Add some items to get started')}
          </p>
        </div>
      </div>
    </section>
  );
}
