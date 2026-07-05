import { HelmetHead } from '@/components/seo/HelmetHead';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function NotFound() {
  const { t } = useTranslation();

  return (
    <>
      <HelmetHead
        title="404 — Page Not Found — AURA CAFE"
        description="Page not found. Trang khong ton tai."
      />

      <main
        id="main-content"
        className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center"
      >
        <div
          data-testid="not-found-decoration"
          className="mb-6 text-8xl font-display font-bold text-[color:var(--aura-chrome-bright)]/20 md:text-9xl"
          aria-hidden="true"
        >
          404
        </div>

        <h1 className="font-display text-4xl font-bold text-[color:var(--aura-chrome-bright)] md:text-5xl">
          {t('notFound.heading')}
        </h1>

        <p className="mt-4 max-w-md text-[color:var(--aura-chrome-bright)]">
          {t('notFound.message')}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            to="/"
            className="rounded-xl bg-[color:var(--aura-noir-deep)] px-6 py-3 font-semibold text-[color:var(--aura-chrome-bright)] transition-colors hover:bg-secondary"
          >
            {t('notFound.backHome')}
          </Link>
          <Link
            to="/menu"
            className="rounded-xl border border-white/[0.08] px-6 py-3 font-semibold text-[color:var(--aura-chrome-bright)] transition-colors hover:bg-[color:var(--aura-chrome-bright)]/10"
          >
            {t('notFound.viewMenu')}
          </Link>
        </div>
      </main>
    </>
  );
}
