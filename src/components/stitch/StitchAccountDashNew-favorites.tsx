/**
 * DashFavoritesSection — My Favorites list for StitchAccountDashNew
 */
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import { BODY_FONT } from './StitchAccountDashNew-constants';

interface FavoriteItem {
  id: string | number;
  name: string;
  price?: number;
}

interface DashFavoritesSectionProps {
  favoriteItems: FavoriteItem[];
  setGlassCardRef: (el: HTMLElement | null) => void;
}

export function DashFavoritesSection({ favoriteItems, setGlassCardRef }: DashFavoritesSectionProps) {
  const { t } = useTranslation();
  return (
    <section className="space-y-4" aria-label={t('stitch.accountDashboard.myFavoritesTitle', 'My Favorites')}>
      <div className="flex justify-between items-center">
        <h3
          className="text-[12px] font-bold tracking-[0.15em] uppercase text-[var(--aura-chrome-bright)]"
          style={{ fontFamily: BODY_FONT, lineHeight: '1' }}
        >
          {t('stitch.accountDashboard.myFavoritesTitle', 'My Favorites')}
        </h3>
      </div>

      {favoriteItems.length === 0 ? (
        <div className="rounded-xl p-8 text-center bg-[rgba(30,41,59,0.4)] backdrop-blur-xl border border-white/10">
          <Heart className="w-10 h-10 mx-auto mb-3 text-[rgba(184,199,226,0.2)]" />
          <p className="text-sm font-medium mb-1 text-[var(--aura-chrome-bright)]">
            {t('stitch.accountDashboard.myFavoritesEmpty', 'No favorites yet')}
          </p>
          <p className="text-xs text-[var(--aura-chrome-soft)]">
            {t('stitch.accountDashboard.myFavoritesEmptyDesc', 'Tap the heart icon on menu items to add them here.')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {favoriteItems.map((item) => (
            <div
              key={item.id}
              ref={setGlassCardRef}
              className="flex items-center justify-between p-4 rounded-lg bg-[rgba(30,41,59,0.4)] backdrop-blur-xl border border-[rgba(148,163,184,0.3)]"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center border border-white/5 bg-[var(--aura-bg-elevated)]">
                  <Heart className="w-5 h-5 text-[var(--aura-chrome-bright)]" fill="var(--aura-chrome-bright)" />
                </div>
                <div>
                  <p
                    className="text-lg font-medium text-[var(--aura-chrome-bright)]"
                    style={{ fontFamily: BODY_FONT, lineHeight: '1.6' }}
                  >
                    {item.name}
                  </p>
                  <p
                    className="text-[10px] text-[var(--aura-chrome-soft)] mt-0.5"
                    style={{ fontFamily: BODY_FONT, lineHeight: '1', letterSpacing: '0.1em', fontWeight: 700 }}
                  >
                    {item.price ? `${item.price.toLocaleString('vi-VN')}₫` : ''}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
