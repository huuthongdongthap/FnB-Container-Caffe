import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { StitchContainerNew1 } from '@/components/stitch/StitchContainerNew1';

export function ContainerPage() {
  const { t } = useTranslation('container');
  return (
    <>
      <HelmetHead
        title={t('seoTitle')}
        description={t('seoDescription')}
        canonical="/container"
      />
      <StitchContainerNew1 />
    </>
  );
}

export default ContainerPage;
