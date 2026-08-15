import { useTranslation } from 'react-i18next';
import { SPACE_GROTESK, LIBRE_CASLON } from './StitchHeroNew-types';

interface StitchHeroNewVisualTeaserProps {
  bgImageUrl: string;
}

export function StitchHeroNewVisualTeaser({ bgImageUrl }: StitchHeroNewVisualTeaserProps) {
  const { t } = useTranslation();

  return (
    <section className="relative flex h-[614px] w-full items-center overflow-hidden">
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center transition-transform duration-[10000ms] hover:scale-100"
        style={{ backgroundImage: `url('${bgImageUrl}')` }}
        role="img"
        aria-label="A cinematic, low-light photograph of a high-end industrial cafe interior at night. The setting features dark navy steel shipping container walls with warm bronze pendant lighting casting soft glows on chrome silver espresso machines. A single barista in a dark apron is silhouetted against a softly blurred background of industrial luxury furniture and frosted glass partitions."
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#00142c] via-[rgba(0,20,44,0.4)] to-transparent" />
      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-5 md:px-16">
        <div className="max-w-xl">
          <h2
            style={{ fontFamily: LIBRE_CASLON, fontSize: '32px', lineHeight: '40px', fontWeight: 400 }}
            className="mb-4 text-[var(--aura-chrome-bright)]"
          >
            {t('home.nightCanvas', 'The Night is Your Canvas')}
          </h2>
          <p
            style={{ fontFamily: SPACE_GROTESK, fontSize: '18px', lineHeight: '28px', fontWeight: 400 }}
            className="italic text-[var(--aura-chrome-soft)]"
          >
            {t('home.findClarity', 'Find clarity in the shadows.')}
          </p>
        </div>
      </div>
    </section>
  );
}
