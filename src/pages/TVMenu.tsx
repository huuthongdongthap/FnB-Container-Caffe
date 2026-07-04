import { useTVMenu } from '@/hooks/use-tv-menu';
import { MenuSlideshow } from '@/components/tv-menu/MenuSlideshow';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { TriangleAlert } from 'lucide-react';

export default function TVMenuPage() {
  const { menuGroups, totalItems, isLoading, isError, lastUpdated, isHappyHour } = useTVMenu();
  const { t } = useTranslation('tvMenu');

  if (isLoading && menuGroups.length === 0) {
    return (
      <>
        <HelmetHead
          title={t('seoTitle', 'TV Menu - AURA CAFE Sa Dec')}
          description={t('seoDescription', 'Digital TV menu display for AURA CAFE Sa Dec. Browse our coffee, tea, and beverage offerings.')}
          canonical="/tv-menu"
        />
        <div className="min-h-screen bg-[color:var(--st-primary-container)] flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="w-10 h-10 border-3 border-gray-600 border-t-gold rounded-full animate-spin mx-auto mb-4" />
            <span className="text-2xl">{t('loading')}</span>
          </div>
        </div>
      </>
    );
  }

  if (isError && menuGroups.length === 0) {
    return (
      <>
        <HelmetHead
          title={t('seoTitle', 'TV Menu - AURA CAFE Sa Dec')}
          description={t('seoDescription', 'Digital TV menu display for AURA CAFE Sa Dec. Browse our coffee, tea, and beverage offerings.')}
          canonical="/tv-menu"
        />
        <div className="min-h-screen bg-[color:var(--st-primary-container)] flex items-center justify-center">
          <div className="text-center text-red-400">
            <span className="text-5xl block mb-4"><TriangleAlert size={36} className="inline" /></span>
            <span className="text-2xl">{t('errorLoading')}</span>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <HelmetHead
        title={t('seoTitle', 'TV Menu - AURA CAFE Sa Dec')}
        description={t('seoDescription', 'Digital TV menu display for AURA CAFE Sa Dec. Browse our coffee, tea, and beverage offerings.')}
        canonical="/tv-menu"
      />
    <div className="min-h-screen bg-[color:var(--st-primary-container)] text-[color:var(--st-on-surface)] p-10 overflow-hidden" style={{ cursor: 'none' }}>
      <MenuSlideshow
        menuGroups={menuGroups}
        isHappyHour={isHappyHour}
        lastUpdated={lastUpdated}
        totalItems={totalItems}
      />
    </div>
    </>
  );
}
