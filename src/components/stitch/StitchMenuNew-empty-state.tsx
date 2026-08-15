'use client';

import { useTranslation } from 'react-i18next';

interface StitchMenuNewEmptyStateProps {
  hasNoResults: boolean;
  hasNoItemsInCategory: boolean;
  showFavoritesOnly: boolean;
  favIdsEmpty: boolean;
}

export function StitchMenuNewEmptyState({
  hasNoResults,
  hasNoItemsInCategory,
  showFavoritesOnly,
  favIdsEmpty,
}: StitchMenuNewEmptyStateProps) {
  const { t } = useTranslation();

  if (hasNoResults) {
    return (
      <div className="py-20 text-center" role="status">
        <p className="text-base text-[var(--aura-chrome-soft)]">
          {t('menu.notFoundDesc')}
        </p>
      </div>
    );
  }

  if (hasNoItemsInCategory) {
    return (
      <div className="py-20 text-center" role="status">
        <p className="text-base text-[var(--aura-chrome-soft)]">
          {t('stitch.noItemsInCategory')}
        </p>
      </div>
    );
  }

  if (showFavoritesOnly && favIdsEmpty) {
    return (
      <div className="py-20 text-center" role="status">
        <p className="text-base font-medium text-[var(--aura-chrome-bright)]">
          {t('stitch.noFavoritesYet')}
        </p>
        <p className="mt-2 text-sm text-[var(--aura-chrome-soft)]">
          {t('stitch.noFavoritesDesc')}
        </p>
      </div>
    );
  }

  return null;
}
