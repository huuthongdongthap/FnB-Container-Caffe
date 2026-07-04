import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/shared/SEOHead';

export function NotFound() {
  const { t } = useTranslation();

  return (
    <>
      <SEOHead
        title={t('notFound.seoTitle')}
        description={t('notFound.seoDescription')}
        noindex
      />

      <main
        id="main-content"
        className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center"
      >
        <div
          data-testid="not-found-decoration"
          className="mb-6 text-8xl font-display font-bold text-[#b8c7e2]/20 md:text-9xl"
          aria-hidden="true"
        >
          404
        </div>

        <h1 className="font-display text-4xl font-bold text-[#e4e2e4] md:text-5xl">
          {t('notFound.heading')}
        </h1>

        <p className="mt-4 max-w-md text-[#b8c7e2]">
          {t('notFound.message')}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            to="/"
            className="rounded-xl bg-[#0A1A2E] px-6 py-3 font-semibold text-[#e4e2e4] transition-colors hover:bg-secondary"
          >
            {t('notFound.backHome')}
          </Link>
          <Link
            to="/menu"
            className="rounded-xl border border-white/[0.08] px-6 py-3 font-semibold text-[#e4e2e4] transition-colors hover:bg-[#b8c7e2]/10"
          >
            {t('notFound.viewMenu')}
          </Link>
        </div>
      </main>
    </>
  );
}
