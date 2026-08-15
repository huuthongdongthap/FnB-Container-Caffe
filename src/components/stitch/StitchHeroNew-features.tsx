import { useTranslation } from 'react-i18next';
import { Factory, Coffee, Moon } from 'lucide-react';
import { SPACE_GROTESK, LIBRE_CASLON, GLASS_PANEL, CHROME_LINE } from './StitchHeroNew-types';

interface StitchHeroNewFeaturesProps {
  setGlassRef: (i: number) => (el: HTMLDivElement | null) => void;
}

function FeatureCard({
  icon,
  title,
  description,
  footerLabel,
  badge,
  glassRef,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  footerLabel: string;
  badge?: string;
  glassRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={glassRef}
      className="relative flex flex-col items-start gap-6 overflow-hidden p-6 transition-transform duration-500 hover:-translate-y-2"
      style={GLASS_PANEL}
    >
      {badge && (
        <div className="absolute right-0 top-0 p-4">
          <span
            style={{
              fontFamily: SPACE_GROTESK,
              fontSize: '10px',
              lineHeight: '16px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              border: '1px solid color-mix(in srgb, var(--aura-chrome-bright) 20%, transparent)',
              backgroundColor: 'color-mix(in srgb, var(--aura-chrome-bright) 10%, transparent)',
            }}
            className="px-2 py-1 text-[var(--aura-chrome-bright)]"
          >
            {badge}
          </span>
        </div>
      )}
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--aura-chrome-bright)_30%,transparent)] text-[var(--aura-chrome-bright)]">
        {icon}
      </div>
      <h3
        style={{ fontFamily: LIBRE_CASLON, fontSize: '24px', lineHeight: '32px', fontWeight: 400 }}
        className="text-[var(--aura-chrome-bright)]"
      >
        {title}
      </h3>
      <p
        style={{ fontFamily: SPACE_GROTESK, fontSize: '16px', lineHeight: '24px', fontWeight: 400 }}
        className="text-[var(--aura-chrome-soft)]"
      >
        {description}
      </p>
      <div className="mt-auto w-full pt-8">
        <div style={CHROME_LINE} className="mb-4" />
        <span
          style={{
            fontFamily: SPACE_GROTESK,
            fontSize: '12px',
            lineHeight: '16px',
            fontWeight: 600,
            letterSpacing: '0.1em',
          }}
          className="text-[rgba(198,198,199,0.4)]"
        >
          {footerLabel}
        </span>
      </div>
    </div>
  );
}

export function StitchHeroNewFeatures({ setGlassRef }: StitchHeroNewFeaturesProps) {
  const { t } = useTranslation();

  return (
    <section className="bg-[#000e23] px-5 py-16 md:px-16">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-6 md:grid-cols-3">
        <FeatureCard
          glassRef={setGlassRef(0)}
          icon={<Factory className="h-6 w-6" />}
          title={t('home.industrialRoots', 'Industrial Roots')}
          description={t(
            'home.industrialRootsDesc',
            'Housed in repurposed steel vessels, our space celebrates raw materials—polished concrete, exposed beams, and matte metal finishes.',
          )}
          footerLabel={t('home.architecturalConcept', 'Architectural Concept')}
        />
        <FeatureCard
          glassRef={setGlassRef(1)}
          icon={<Coffee className="h-6 w-6" />}
          title={t('home.artisanRoasts', 'Artisan Roasts')}
          description={t(
            'home.artisanRoastsDesc',
            'Small-batch beans sourced from volcanic highlands, roasted specifically to enhance the depth of night-time caffeine rituals.',
          )}
          footerLabel={t('home.theCraft', 'The Craft')}
          badge={t('home.signature', 'Signature')}
        />
        <FeatureCard
          glassRef={setGlassRef(2)}
          icon={<Moon className="h-6 w-6" />}
          title={t('home.loungeAtmosphere', 'Lounge Atmosphere')}
          description={t(
            'home.loungeAtmosphereDesc',
            'Transitioning as the sun sets, our lighting shifts to a warm bronze glow, complemented by a curated lo-fi industrial soundscape.',
          )}
          footerLabel={t('home.experience', 'Experience')}
        />
      </div>
    </section>
  );
}
