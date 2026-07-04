import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import StitchLandingNew from '@/components/stitch/StitchLandingNew';

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  name: 'AURA CAFE',
  description:
    'Container caffe & space with 5 unique zones in Sa Dec, Dong Thap. Coffee, milk tea, beer & lounge, garden, and photo spots.',
  url: 'https://auraspace.cafe',
  telephone: '+84946013633',
  servingCuisine: ['Coffee', 'Tea', 'Beverages'],
  address: {
    '@type': 'PostalAddress',
    streetAddress: '39 Nguyen Tat Thanh',
    addressLocality: 'Sa Dec',
    addressRegion: 'Dong Thap',
    addressCountry: 'VN',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 10.2908,
    longitude: 105.7568,
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '06:00',
      closes: '22:00',
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Saturday', 'Sunday'],
      opens: '06:00',
      closes: '23:00',
    },
  ],
  priceRange: 'VND 15,000 - 65,000',
  image: 'https://auraspace.cafe/images/night-4k.webp',
};

export function HomePage() {
  const { t } = useTranslation();
  return (
    <>
      <HelmetHead
        title={t('seoTitle', 'AURA CAFE — Container Caffe & Space Sa Đéc')}
        description={t('seoDescription', 'Quán cà phê container industrial-luxury tại Sa Đéc. 5 không gian độc đáo.')}
        canonical="/"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <StitchLandingNew />
    </>
  );
}
