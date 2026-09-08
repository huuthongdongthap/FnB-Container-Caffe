'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AboutPageData, StoryCard, TimelinePhase, ValueCard, Zone } from './stitch-about-types';

/**
 * Custom hook that builds default AboutPageData using translation keys.
 * Must be called inside a React component.
 */
export function useDefaultAboutData(): AboutPageData {
  const { t } = useTranslation();

  const defaultStoryCards: StoryCard[] = useMemo(
    () => [
      {
        id: 's1',
        icon: 'architecture',
        title: t('about.card1Title'),
        description: t('about.card1Desc'),
        span: 'md:col-span-7',
        imageUrl:
          '/photos/IMG_6696.webp',
        imageAlt: 'Container architecture at AURA CAFE showing steel and glass design',
      },
      {
        id: 's2',
        icon: 'smartphone',
        title: t('about.card2Title'),
        description: t('about.card2Desc'),
        span: 'md:col-span-5',
      },
      {
        id: 's3',
        icon: 'star',
        title: t('about.card3Title'),
        description: t('about.card3Desc'),
        span: 'md:col-span-5',
      },
    ],
    [t],
  );

  const defaultTimeline: TimelinePhase[] = useMemo(
    () => [
      {
        id: 't1',
        phase: 'PHASE 01',
        year: '2022',
        title: t('about.phase1Title'),
        description: t('about.phase1Desc'),
        imageUrl:
          '/photos/IMG_6698.webp',
        imageAlt: 'Architectural sketches of AURA CAFE container layout',
      },
      {
        id: 't2',
        phase: 'PHASE 02',
        year: '2023',
        title: t('about.phase2Title'),
        description: t('about.phase2Desc'),
        imageUrl:
          '/photos/IMG_6703.webp',
        imageAlt: 'Construction progress of AURA CAFE container zones',
      },
      {
        id: 't3',
        phase: 'PHASE 03',
        year: '2024',
        title: t('about.phase3Title'),
        description: t('about.phase3Desc'),
        imageUrl:
          '/photos/IMG_6631.webp',
        imageAlt: t('about.grandOpeningAlt'),
        isActive: true,
      },
      {
        id: 't4',
        phase: 'PHASE 04',
        year: '2025',
        title: t('about.phase4Title'),
        description: t('about.phase4Desc'),
        imageUrl:
          '/photos/IMG_6696.webp',
        imageAlt: 'QR ordering system at AURA CAFE',
      },
      {
        id: 't5',
        phase: 'PHASE 05',
        year: '2026',
        title: t('about.phase5Title'),
        description: t('about.phase5Desc'),
        imageUrl:
          '/photos/IMG_6631.webp',
        imageAlt: 'AURA CAFE full experience with digital ecosystem',
      },
    ],
    [t],
  );

  const defaultValues: ValueCard[] = useMemo(
    () => [
      {
        id: 'v1',
        icon: 'settings_input_component',
        title: t('about.value1Title'),
        description: t('about.value1Desc'),
      },
      {
        id: 'v2',
        icon: 'map_pin',
        title: t('about.value2Title'),
        description: t('about.value2Desc'),
      },
      {
        id: 'v3',
        icon: 'qr_code',
        title: t('about.value3Title'),
        description: t('about.value3Desc'),
      },
    ],
    [t],
  );

  const defaultZones: Zone[] = useMemo(
    () => [
      {
        id: 'z1',
        name: t('about.zone1Name'),
        role: t('about.zone1Desc'),
        imageUrl:
          '/photos/IMG_6593.webp',
        imageAlt: 'Jade Counter bar at AURA CAFE',
      },
      {
        id: 'z2',
        name: t('about.zone2Name'),
        role: t('about.zone2Desc'),
        imageUrl:
          '/photos/IMG_6581.webp',
        imageAlt: 'Sky Deck rooftop at AURA CAFE',
      },
      {
        id: 'z3',
        name: t('about.zone3Name'),
        role: t('about.zone3Desc'),
        imageUrl:
          '/photos/IMG_6554-frame.webp',
        imageAlt: 'Noir Cabin at AURA CAFE',
      },
      {
        id: 'z4',
        name: t('about.zone4Name'),
        role: t('about.zone4Desc'),
        imageUrl:
          '/photos/IMG_6555-frame.webp',
        imageAlt: 'Aura Lounge silver-themed lounge at AURA CAFE',
      },
      {
        id: 'z5',
        name: t('about.zone5Name'),
        role: t('about.zone5Desc'),
        imageUrl:
          '/photos/IMG_6696.webp',
        imageAlt: 'VIP Steel Nest premium zone at AURA CAFE',
      },
    ],
    [t],
  );

  return useMemo(
    () => ({
      heroTitle: t('hero.title'),
      heroSubtitle: t('about.heroSubtitle'),
      storyTitle: t('about.storyTitle'),
      storyLead: t('about.storyLead'),
      storyCards: defaultStoryCards,
      timelinePhases: defaultTimeline,
      values: defaultValues,
      zones: defaultZones,
    }),
    [t, defaultStoryCards, defaultTimeline, defaultValues, defaultZones],
  );
}
