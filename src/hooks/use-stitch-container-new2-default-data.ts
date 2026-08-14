/**
 * Provides default data for StitchContainerNew2 when no external data is passed.
 * All strings use i18n translations with fallback defaults.
 */
'use client';

import { useTranslation } from 'react-i18next';
import type { ContainerCafeNew2Data } from '@/components/stitch/stitch-container-new2-types';

export function useStitchContainerNew2DefaultData(): ContainerCafeNew2Data {
  const { t } = useTranslation();

  return {
    navLinks: [
      { id: 'home', label: t('containerNew2.home', { defaultValue: 'Home' }), href: '#', isActive: true },
      { id: 'menu', label: t('containerNew2.menu', { defaultValue: 'Menu' }), href: '#menu' },
      { id: 'location', label: t('containerNew2.location', { defaultValue: 'Location' }), href: '#location' },
    ],
    heroTag: t('containerNew2.heroTag', { defaultValue: 'Premium Specialty Coffee' }),
    heroTitle: t('containerNew2.heroTitle', { defaultValue: 'AURA CAFE —' }),
    heroSubtitle: t('containerNew2.heroSubtitle', { defaultValue: 'Container Caffe & Space' }),
    heroDescription: t('containerNew2.heroDescription', {
      defaultValue: 'An avant-garde architectural sanctuary in Sa Dec, Vietnam. Experience the intersection of industrial precision and nocturnal luxury through our curated brews.',
    }),
    reservationLabel: t('containerNew2.reservation', { defaultValue: 'Book a Table' }),
    viewGalleryLabel: t('containerNew2.viewGallery', { defaultValue: 'View Gallery' }),
    sectionTitle: t('containerNew2.sectionTitle', { defaultValue: 'The Container Aesthetic' }),
    featureCards: [
      {
        id: 'architectural-precision',
        icon: 'architecture',
        title: t('containerNew2.feature1Title', { defaultValue: 'Architectural Precision' }),
        description: t('containerNew2.feature1Desc', {
          defaultValue: 'Our space is built from repurposed industrial containers, refined with high-end glasswork and brushed metallic surfaces.',
        }),
      },
      {
        id: 'curated-brews',
        icon: 'coffee_maker',
        title: t('containerNew2.feature2Title', { defaultValue: 'Curated Brews' }),
        description: t('containerNew2.feature2Desc', {
          defaultValue: 'Sourcing only the finest specialty beans, our baristas craft each cup using technical precision and artisanal soul.',
        }),
      },
      {
        id: 'nocturnal-ambience',
        icon: 'nights_stay',
        title: t('containerNew2.feature3Title', { defaultValue: 'Nocturnal Ambience' }),
        description: t('containerNew2.feature3Desc', {
          defaultValue: 'Designed for the twilight hours, our lighting system creates a moody, sophisticated environment perfect for late-night inspiration.',
        }),
      },
    ],
    atmosphereTitle: t('containerNew2.atmosphereTitle', { defaultValue: 'A Symphony of Steel & Shadow' }),
    atmosphereQuote: t('containerNew2.atmosphereQuote', {
      defaultValue: '"The atmosphere at Aura isn\'t just about the coffee; it\'s about the deliberate tension between raw industrial materials and refined luxury comforts."',
    }),
    atmosphereAttribution: t('containerNew2.atmosphereAttribution', { defaultValue: 'Architectural Digest' }),
    atmosphereBgUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAs-j2Bs-ZKR94AwJJOXlEEcYcKrWo4SQbA9uu90c26nJ3JdaxSh5XVA4jIMiwR0YNlzVSaoVA70eEWhyTLCRItlpHBJp_Uss3xbqHhJWadWqwgIh0xBK9Fs0cB1eWFgjrjhkhuLQ7OPiuHleH7Bco-Rlf2dZzS2kF3QGvfr4OEGwTfLwxBa23tIOZ5xqQH2cJye5KS56kKqcSe_HXE-KIdAh3egsZpfIWeRNbhpZY9wP320ScttzefwxkPmkjNCyfiGv3dlONbiHM',
    atmosphereBgAlt: t('containerNew2.atmosphereBgAlt', {
      defaultValue: 'A cinematic, low-light photograph of a high-end container cafe interior at night.',
    }),
    menuSectionTitle: t('containerNew2.menuSectionTitle', { defaultValue: 'Signature Selection' }),
    menuSectionSubtitle: t('containerNew2.menuSectionSubtitle', {
      defaultValue: 'Our menu is a technical specification of flavor, balancing acidity and body with architectural balance.',
    }),
    signatureItems: [
      {
        id: 'nocturnal-espresso',
        name: t('containerNew2.item1Name', { defaultValue: 'Nocturnal Espresso' }),
        description: t('containerNew2.item1Desc', { defaultValue: 'Dark roast, cacao nibs, smoked cedar' }),
        price: '$5.50',
      },
      {
        id: 'chrome-cold-brew',
        name: t('containerNew2.item2Name', { defaultValue: 'Chrome Cold Brew' }),
        description: t('containerNew2.item2Desc', { defaultValue: '12-hour filtration, silver-tip jasmine infusion' }),
        price: '$6.25',
      },
      {
        id: 'bronze-latte',
        name: t('containerNew2.item3Name', { defaultValue: 'Bronze Latte' }),
        description: t('containerNew2.item3Desc', { defaultValue: 'Salted caramel honeycomb, oat silk base' }),
        price: '$6.50',
      },
    ],
    menuImageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDaoDbpEz_9buFiuoAiGaboZBYS98h_vTkxXdaX2E_Vx9YcJQUlCMJUGvLBMs6m37fG3_jvw48erczGoz-5L7jVr3V5H_pzpM6OJwZEgF5pd_fQxxc1vryfQQbqDMFl9p0C9CdbsDqrGmLnRvvVA9usTkW4CK0KEoqHEGWHkFScgt6dR-bzRlQHHrCAMpSe5cbIgw8F-e3_fPje9rOFSHaS6Sle0jIpTCxONV4KmYwAlEvckxwMYyyoNhmreQ2t7DayDLSlCmqqgvM',
    menuImageAlt: t('containerNew2.menuImageAlt', {
      defaultValue: 'A close-up, high-fashion shot of a signature latte in a minimalist glass cup, resting on a brushed steel counter.',
    }),
    footerLogo: t('containerNew2.brandName', { defaultValue: 'AURA CAFE' }),
    footerAddressLines: [
      t('containerNew2.address1', { defaultValue: '123 Architectural Way, Sa Dec' }),
      t('containerNew2.address2', { defaultValue: 'Dong Thap, Vietnam' }),
    ],
    footerEmail: 'contact@auracafe.vn',
    footerLinkGroups: [
      {
        id: 'explore',
        heading: t('containerNew2.exploreHeading', { defaultValue: 'Explore' }),
        links: [
          { id: 'explore-menu', label: t('containerNew2.exploreMenu', { defaultValue: 'Menu' }), href: '#menu' },
          { id: 'explore-story', label: t('containerNew2.ourStory', { defaultValue: 'Our Story' }), href: '#story' },
          { id: 'explore-reservation', label: t('containerNew2.reservation', { defaultValue: 'Reservation' }), href: '#reservation' },
        ],
      },
      {
        id: 'legal',
        heading: t('containerNew2.legalHeading', { defaultValue: 'Legal' }),
        links: [
          { id: 'legal-privacy', label: t('containerNew2.privacyPolicy', { defaultValue: 'Privacy Policy' }), href: '#privacy' },
          { id: 'legal-terms', label: t('containerNew2.termsOfService', { defaultValue: 'Terms of Service' }), href: '#terms' },
          { id: 'legal-contact', label: t('containerNew2.contactUs', { defaultValue: 'Contact Us' }), href: '#contact' },
        ],
      },
    ],
    legalLinks: [
      { id: 'legal-bottom-share', label: t('containerNew2.share', { defaultValue: 'Share' }), href: '#share' },
      { id: 'legal-bottom-location', label: t('containerNew2.location', { defaultValue: 'Location' }), href: '#location' },
    ],
    copyright: t('containerNew2.copyright', {
      defaultValue: '© {year} AURA CAFE. ALL RIGHTS RESERVED.',
      year: new Date().getFullYear(),
    }),
  };
}
