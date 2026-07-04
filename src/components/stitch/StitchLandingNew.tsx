import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  ChevronRight,
  Coffee,
  ArmchairIcon as Seat,
  Truck,
  MapPin,
  Clock,
  Phone,
} from 'lucide-react';

export interface StitchLandingNewProps {
  heroBgUrl?: string;
  galleryMainUrl?: string;
  galleryInsetUrl?: string;
  locationMapUrl?: string;
}

const defaultHeroBgUrl =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA1OAFHunc-YO5r8iyjCW7TTf2MK-XdcgutPX_eey8ghAWImW0S6KKn_Z1dnR85Ak_jtnYcmOEBEgZOHmuafZnsfAufwSV2hYixBwFiizwwQyLsvy_8FmfTcP-JzUup1oY2B65sFUEf9Q1WOq_8JIVzcqsCfrU3kGmPb09M5ILa923u1sVvlQ3Nh256Oh_lUA6R15iJWP7VN5ktYR1-bfkT2DCJ7iAlvcn6XXxIAHosilS66Agqd4OBMg7hItzEatmu_n6WsQJ2EJs';

const defaultGalleryMainUrl =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAgug0PtrpcGPyiHsuxHnYB-yOrihQNAacf46Eh6qLSxFEzi9GW1TD1dodoVMPupKxcOlz7R8B3IMA0PS-fnOJlmnhWqD3vzZoxP6U4BPbf27qnrapBnJNnIMQmhDyNdyqd6UytVcpluJ85os_IkFvxTkLon2uUzBXDKJ_eVLbUjjUH10893ZJ9zfgBX2_0AsynA48IKa7teB1MYi3oEerHz323MeDeeU3rNWcMJGW3UxBrQLcF7M5HxV24Z5xX_7shRjYD9b2f0kk';

const defaultGalleryInsetUrl =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDnWwO-DRD9DD29TBd45cZMMkK9yQuQT0zqAhpg_bkHWkVrfJreFSFuhI6gZoq3cRwh1amiDpZpg7zBw07sr6R0oh-7wTYRv36GOUVrP7KHMplhjkuFK7FOD7cUcmlmTU6txaMh_lHRlNqZsa0xkk7vYPK-2g4wdW8y_1R3oioJKO-Wr3tGAtoQ96QzBsINHbSn7l922bmUPM6bMIk7hnW8CQ-FMEy2KLGZmJ3Z0evzve3HUPsZR_HxxCV52YdiwtumoTEFH9QknwI';

const defaultLocationMapUrl =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCCC8e6-10nBjxjAWVGqXQFsManel1ya-0792nwZj4jeemPqnXloh1hrpArWYh1IM0fv1RSwfl0HET7jRGprsBlWnnZHY3b36EBq5SiRFFvS4NPRdM5PjOT_3MCboTSOk97YT1Itp8kK8hDeYbEsXkI-mFWSEiccQXEoHSMNArH0ObyTa-wGvJAIVugGCFd4bdgk6SxdRZ5cHZgbuOpAJMsKUbVprqwGgz52nM-fv4C2zn5HcVlodbeD6fVZb48EGD1CDcv8bHTR08';

export function StitchLandingNew({
  heroBgUrl = defaultHeroBgUrl,
  galleryMainUrl = defaultGalleryMainUrl,
  galleryInsetUrl = defaultGalleryInsetUrl,
  locationMapUrl = defaultLocationMapUrl,
}: Readonly<StitchLandingNewProps>) {
  const { t } = useTranslation();

  return (
    <div
      className="relative min-h-screen bg-[var(--aura-bg-page, #0A1A2E)] text-[var(--aura-text-primary, #e8e8e8)] font-body overflow-x-hidden"
      aria-label={t('landing.pageAriaLabel')}
    >
      {/* Navigation */}
      <nav
        className="fixed top-0 w-full z-50 flex justify-between items-center px-5 md:px-16 py-4 bg-[var(--aura-bg-page, #0A1A2E)]/15 backdrop-blur-xl border-b border-[#44474d]/30"
        aria-label={t('landing.navAriaLabel')}
      >
        <div className="font-display text-[clamp(1.25rem,4vw,2rem)] text-[var(--aura-text-primary, #e8e8e8)] tracking-tight font-medium">
          AURA CAFE
        </div>
        <div className="hidden md:flex items-center gap-10">
          <a
            href="#menu"
            className="font-display text-[24px] leading-[1.4] font-semibold text-[#efbd8a] border-b-2 border-[var(--aura-tertiary,#d4a574)] pb-1"
          >
            {t('nav.menu')}
          </a>
          <a
            href="#reservation"
            className="font-display text-[24px] leading-[1.4] font-semibold text-[var(--aura-text-secondary, #a0a8b0)] hover:text-[var(--aura-text-primary, #e8e8e8)] transition-colors"
          >
            {t('landing.reservation')}
          </a>
          <a
            href="#location"
            className="font-display text-[24px] leading-[1.4] font-semibold text-[var(--aura-text-secondary, #a0a8b0)] hover:text-[var(--aura-text-primary, #e8e8e8)] transition-colors"
          >
            {t('landing.location')}
          </a>
          <a
            href="#about"
            className="font-display text-[24px] leading-[1.4] font-semibold text-[var(--aura-text-secondary, #a0a8b0)] hover:text-[var(--aura-text-primary, #e8e8e8)] transition-colors"
          >
            {t('landing.about')}
          </a>
        </div>
        <button
          className="bg-gradient-to-br from-[#D4A574] to-[#B48554] text-[#2c1700] px-6 py-2 text-xs tracking-[0.1em] font-semibold font-body uppercase active:opacity-80 active:scale-95 transition-all duration-300"
          aria-label={t('landing.orderNowAria')}
        >
          {t('landing.orderNow')}
        </button>
      </nav>

      {/* Main Content */}
      <main className="relative pt-24 min-h-screen">
        {/* Background Decorative Elements */}
        <div
          className="absolute inset-0 z-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(90deg, rgba(30, 41, 59, 0.5) 1px, transparent 1px)',
            backgroundSize: '80px 100%',
          }}
          aria-hidden="true"
        />
        <div
          className="absolute top-1/4 -right-24 w-96 h-96 bg-[#efbd8a]/10 rounded-full blur-[120px]"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-1/4 -left-24 w-96 h-96 bg-[var(--aura-primary, #c6c6c7)]/10 rounded-full blur-[120px]"
          aria-hidden="true"
        />

        {/* Hero Section */}
        <section
          className="relative z-10 px-5 md:px-16 py-20 flex flex-col items-center justify-center min-h-[870px] text-center"
          aria-label={t('landing.heroAriaLabel')}
        >
          <div className="relative bg-[rgba(148,163,184,0.1)] backdrop-blur-xl p-12 md:p-24 max-w-5xl w-full border border-transparent overflow-hidden">
            <div
              className="absolute inset-0 opacity-40 z-0"
              aria-hidden="true"
            >
              <div
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url('${heroBgUrl}')` }}
              />
            </div>
            <div className="relative z-10 flex flex-col items-center">
              <p className="text-xs tracking-[0.4em] uppercase text-[#efbd8a] mb-6 font-body font-semibold">
                {t('landing.heroTagline')}
              </p>
              <h1 className="font-display text-[clamp(2.5rem,10vw,4rem)] text-[var(--aura-text-primary, #e8e8e8)] mb-8 max-w-3xl leading-[1.1] tracking-[-0.02em] font-medium">
                {t('landing.heroTitle')}
              </h1>
              <p className="text-lg md:text-[18px] leading-[1.6] text-[var(--aura-text-secondary, #a0a8b0)] max-w-2xl mb-12 font-body">
                {t('landing.heroDescription')}
              </p>
              <div className="flex flex-col sm:flex-row gap-6">
                <button
                  className="bg-gradient-to-br from-[#D4A574] to-[#B48554] text-[#0c1c30] px-10 py-5 text-xs tracking-[0.1em] font-semibold font-body uppercase flex items-center gap-3 hover:shadow-[0_0_30px_rgba(212,165,116,0.35)] transition-all duration-500"
                  aria-label={t('landing.exploreNowAria')}
                >
                  {t('landing.exploreNow')}
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  className="bg-transparent border border-[#8e9097] px-10 py-5 text-xs tracking-[0.1em] font-semibold font-body uppercase text-[var(--aura-text-primary, #e8e8e8)] hover:bg-[#2a3548]/30 transition-all"
                  aria-label={t('landing.viewMenuAria')}
                >
                  {t('landing.viewMenu')}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Cards Section */}
        <section
          className="relative z-10 px-5 md:px-16 py-24 mb-32"
          aria-label={t('landing.featuresAriaLabel')}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Menu */}
            <div
              className="relative bg-[rgba(148,163,184,0.1)] backdrop-blur-xl p-10 border border-white/10 group hover:-translate-y-2 transition-transform duration-500"
              aria-label={t('landing.featureMenuCardAria')}
            >
              <div className="w-12 h-12 flex items-center justify-center mb-8 border border-[var(--aura-tertiary,#d4a574)]/30 shadow-[0_0_20px_rgba(212,165,116,0.15)]">
                <Coffee className="w-5 h-5 text-[#efbd8a]" aria-hidden="true" />
              </div>
              <h3 className="font-display text-[24px] leading-[1.4] font-semibold mb-4 text-[var(--aura-text-primary, #e8e8e8)]">
                {t('landing.featureMenuTitle')}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--aura-text-secondary, #a0a8b0)] mb-8 font-body">
                {t('landing.featureMenuDesc')}
              </p>
              <a
                href="#menu"
                className="text-xs tracking-[0.1em] uppercase font-semibold font-body text-[#efbd8a] group-hover:underline flex items-center gap-2"
                aria-label={t('landing.featureMenuLinkAria')}
              >
                {t('landing.featureMenuLink')}
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>

            {/* Card 2: Reservation */}
            <div
              className="relative bg-[rgba(148,163,184,0.1)] backdrop-blur-xl p-10 border border-white/10 group hover:-translate-y-2 transition-transform duration-500"
              aria-label={t('landing.featureReserveCardAria')}
            >
              <div className="w-12 h-12 flex items-center justify-center mb-8 border border-[var(--aura-tertiary,#d4a574)]/30 shadow-[0_0_20px_rgba(212,165,116,0.15)]">
                <Seat className="w-5 h-5 text-[#efbd8a]" aria-hidden="true" />
              </div>
              <h3 className="font-display text-[24px] leading-[1.4] font-semibold mb-4 text-[var(--aura-text-primary, #e8e8e8)]">
                {t('landing.featureReserveTitle')}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--aura-text-secondary, #a0a8b0)] mb-8 font-body">
                {t('landing.featureReserveDesc')}
              </p>
              <a
                href="#reservation"
                className="text-xs tracking-[0.1em] uppercase font-semibold font-body text-[#efbd8a] group-hover:underline flex items-center gap-2"
                aria-label={t('landing.featureReserveLinkAria')}
              >
                {t('landing.featureReserveLink')}
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>

            {/* Card 3: Delivery */}
            <div
              className="relative bg-[rgba(148,163,184,0.1)] backdrop-blur-xl p-10 border border-white/10 group hover:-translate-y-2 transition-transform duration-500"
              aria-label={t('landing.featureDeliveryCardAria')}
            >
              <div className="w-12 h-12 flex items-center justify-center mb-8 border border-[var(--aura-tertiary,#d4a574)]/30 shadow-[0_0_20px_rgba(212,165,116,0.15)]">
                <Truck className="w-5 h-5 text-[#efbd8a]" aria-hidden="true" />
              </div>
              <h3 className="font-display text-[24px] leading-[1.4] font-semibold mb-4 text-[var(--aura-text-primary, #e8e8e8)]">
                {t('landing.featureDeliveryTitle')}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--aura-text-secondary, #a0a8b0)] mb-8 font-body">
                {t('landing.featureDeliveryDesc')}
              </p>
              <a
                href="#order"
                className="text-xs tracking-[0.1em] uppercase font-semibold font-body text-[#efbd8a] group-hover:underline flex items-center gap-2"
                aria-label={t('landing.featureDeliveryLinkAria')}
              >
                {t('landing.featureDeliveryLink')}
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        {/* Gallery / Detail Section */}
        <section
          className="relative z-10 px-5 md:px-16 py-24 bg-[var(--aura-bg-surface, #071c33)]/50"
          aria-label={t('landing.galleryAriaLabel')}
        >
          <div className="flex flex-col md:flex-row gap-20 items-center">
            {/* Gallery Images */}
            <div className="w-full md:w-1/2 relative">
              <div className="relative bg-[rgba(148,163,184,0.1)] backdrop-blur-xl p-2 shadow-[0_0_20px_rgba(212,165,116,0.15)]">
                <div
                  className="w-full h-[300px] md:h-[500px] bg-cover bg-center"
                  style={{ backgroundImage: `url('${galleryMainUrl}')` }}
                  role="img"
                  aria-label={t('landing.galleryMainAlt')}
                />
              </div>
              <div className="absolute -bottom-10 -right-10 w-48 h-48 hidden md:block bg-[rgba(148,163,184,0.1)] backdrop-blur-xl p-4 border-t border-[var(--aura-tertiary,#d4a574)]/20">
                <div
                  className="w-full h-full bg-cover bg-center"
                  style={{ backgroundImage: `url('${galleryInsetUrl}')` }}
                  role="img"
                  aria-label={t('landing.galleryInsetAlt')}
                />
              </div>
            </div>

            {/* Gallery Text */}
            <div className="w-full md:w-1/2">
              <p className="text-xs tracking-[0.4em] uppercase text-[#efbd8a] mb-4 font-body font-semibold">
                {t('landing.gallerySubtitle')}
              </p>
              <h2 className="font-display text-[clamp(2rem,5vw,3rem)] leading-[1.2] tracking-[-0.01em] font-medium text-[var(--aura-text-primary, #e8e8e8)] mb-8">
                {t('landing.galleryTitle')}
              </h2>
              <p className="text-lg leading-[1.6] text-[var(--aura-text-secondary, #a0a8b0)] mb-10 font-body">
                {t('landing.galleryDescription')}
              </p>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div
                    className="mt-1 w-2 h-2 bg-[#efbd8a] shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <h4 className="text-xs tracking-[0.1em] uppercase font-semibold font-body text-[var(--aura-text-primary, #e8e8e8)] mb-1">
                      {t('landing.galleryBullet1Title')}
                    </h4>
                    <p className="text-sm text-[var(--aura-text-secondary, #a0a8b0)] font-body">
                      {t('landing.galleryBullet1Desc')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div
                    className="mt-1 w-2 h-2 bg-[#efbd8a] shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <h4 className="text-xs tracking-[0.1em] uppercase font-semibold font-body text-[var(--aura-text-primary, #e8e8e8)] mb-1">
                      {t('landing.galleryBullet2Title')}
                    </h4>
                    <p className="text-sm text-[var(--aura-text-secondary, #a0a8b0)] font-body">
                      {t('landing.galleryBullet2Desc')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Location Section */}
        <section
          className="relative z-10 px-5 md:px-16 py-24 mb-16"
          aria-label={t('landing.locationAriaLabel')}
        >
          <div className="relative bg-[rgba(148,163,184,0.1)] backdrop-blur-xl p-8 md:p-12 border border-white/10">
            <div className="flex flex-col md:flex-row justify-between items-center gap-12">
              <div className="max-w-md w-full">
                <h2 className="font-display text-[clamp(1.5rem,4vw,2rem)] leading-[1.3] font-medium text-[var(--aura-text-primary, #e8e8e8)] mb-6">
                  {t('landing.locationTitle')}
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-[var(--aura-text-secondary, #a0a8b0)]">
                    <MapPin className="w-5 h-5 text-[#efbd8a] shrink-0" aria-hidden="true" />
                    <span className="text-base leading-[1.6] font-body">
                      {t('landing.locationAddress')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[var(--aura-text-secondary, #a0a8b0)]">
                    <Clock className="w-5 h-5 text-[#efbd8a] shrink-0" aria-hidden="true" />
                    <span className="text-base leading-[1.6] font-body">
                      {t('landing.locationHours')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[var(--aura-text-secondary, #a0a8b0)]">
                    <Phone className="w-5 h-5 text-[#efbd8a] shrink-0" aria-hidden="true" />
                    <span className="text-base leading-[1.6] font-body">
                      {t('landing.locationPhone')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="w-full md:w-1/2 h-48 md:h-64 relative bg-[rgba(148,163,184,0.1)] backdrop-blur-xl overflow-hidden border border-[#8e9097]/30">
                <div
                  className="w-full h-full bg-cover bg-center"
                  style={{ backgroundImage: `url('${locationMapUrl}')` }}
                  role="img"
                  aria-label={t('landing.locationMapAlt')}
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        className="w-full border-t border-[#44474d]/20 bg-[var(--aura-bg-page, #0A1A2E)] mt-20"
        aria-label={t('landing.footerAriaLabel')}
      >
        <div className="flex flex-col md:flex-row justify-between items-center px-5 md:px-16 py-12 w-full gap-8">
          <div className="flex flex-col gap-4">
            <div className="font-display text-[24px] leading-[1.4] font-semibold text-[var(--aura-text-primary, #e8e8e8)]">
              AURA CAFE
            </div>
            <p className="text-sm leading-relaxed text-[var(--aura-text-secondary, #a0a8b0)] max-w-xs uppercase tracking-widest opacity-60">
              {t('landing.footerTagline')}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            <a
              href="#contact"
              className="text-sm leading-relaxed text-[var(--aura-text-secondary, #a0a8b0)] hover:text-[#efbd8a] transition-colors uppercase tracking-wider font-body"
              aria-label={t('landing.footerContactAria')}
            >
              {t('landing.footerContact')}
            </a>
            <a
              href="#privacy"
              className="text-sm leading-relaxed text-[var(--aura-text-secondary, #a0a8b0)] hover:text-[#efbd8a] transition-colors uppercase tracking-wider font-body"
              aria-label={t('landing.footerPrivacyAria')}
            >
              {t('landing.footerPrivacy')}
            </a>
            <a
              href="#terms"
              className="text-sm leading-relaxed text-[var(--aura-text-secondary, #a0a8b0)] hover:text-[#efbd8a] transition-colors uppercase tracking-wider font-body"
              aria-label={t('landing.footerTermsAria')}
            >
              {t('landing.footerTerms')}
            </a>
            <a
              href="#instagram"
              className="text-sm leading-relaxed text-[var(--aura-text-secondary, #a0a8b0)] hover:text-[#efbd8a] transition-colors uppercase tracking-wider font-body"
              aria-label={t('landing.footerInstagramAria')}
            >
              {t('landing.footerInstagram')}
            </a>
            <a
              href="#facebook"
              className="text-sm leading-relaxed text-[var(--aura-text-secondary, #a0a8b0)] hover:text-[#efbd8a] transition-colors uppercase tracking-wider font-body"
              aria-label={t('landing.footerFacebookAria')}
            >
              {t('landing.footerFacebook')}
            </a>
          </div>
          <div className="text-sm leading-relaxed text-[var(--aura-text-secondary, #a0a8b0)] opacity-60 text-center md:text-left">
            {t('landing.copyright', { year: new Date().getFullYear() })}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default StitchLandingNew;
