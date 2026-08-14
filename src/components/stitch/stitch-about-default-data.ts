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
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCPfD_Jmk4XFRuVxW23V1fnlA6_1Qu-BNqDWJ2dpYOrn8KE3OveBmrH_EZjrTYFUye1O7Z7Gj2F4NBEqEUsDLx1urd5bqF8rfNfm__g3buZH-uLov62E2-ARnhpxV7zv_x_p4WMOBdCM_TGrZxa3MiOWyeKRL_W2uZj1KDk010YbY7YToBkm21ofLeEpe8RYO1cr4GNwf5WRzOjmdu22tBl8Js-tyfMD_Dri79MVsa3HrV0_T72l6Fzl0P1IKoO4OU5b6MB5KPfGas',
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
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDrhST6weshnMyYXw_5Rn-ORCRUIsoDhbpt4ajVNC7rffHA7Ygn2Lpa6AvG4KEuHwCqsSAEeeXovAV2kvEOJVctf2y3oKYBKE3mSnN9kti5v0Y5bjMx7-cUNU8j6uBXF8SQFINn5nnN1uEv0-2r8_VKIWVen676wqEQwPLD3O1XQftQ-ZC6qbCN7BS2ejgf7UYM5aY4r-Qft1c6Y8dcrXqOClP6hxQ2bXEl0kNiy5wulHktiPGAbZzf1SyVlodxcRjyu3dp56PIh6Y',
        imageAlt: 'Architectural sketches of AURA CAFE container layout',
      },
      {
        id: 't2',
        phase: 'PHASE 02',
        year: '2023',
        title: t('about.phase2Title'),
        description: t('about.phase2Desc'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDzYD6fZHQNR0tpkcoeWVdrTHNO7Y5o9j3mUU_OcfTKuY8u_hRj88Y6WeI0Y9qNb0gIdAw68wpMJm5mrk_c1K-9UC7xUHbRF3vRCjta0kLR-JE5ndeoDbWXyP-4ZiHQepOstt1XmmosLdZpMLCtM9X878CPMNhUhFI6sf241zxJROvJcMbZCYfQAGwjg_J9VVdKNfzURrMsBqsh4kAzEIXf1lx9w96rLKTI9iqa7s-mmymcJcRo4--IXyE1IbVTvr1E_IZUKL2GMso',
        imageAlt: 'Construction progress of AURA CAFE container zones',
      },
      {
        id: 't3',
        phase: 'PHASE 03',
        year: '2024',
        title: t('about.phase3Title'),
        description: t('about.phase3Desc'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuBYYcihYurow2nJrdoCiHePwHUYCxmNt1zlg0kMou4a5zFHuyLbwQbY5OqQJvPLeWaXqn_hUV5V6sJGl9OzUToekQCxgn1IDMC0Nsxy0Q9Gu-YJEM1SR8S5J4eWTQicX2ZwTPYqukPe2j6qMM2zMjs7HRbj5jRVAbKJeSiAe-bdslvZUWzABh6QeSjANkXYIi-OoMoLF6-PYx2GmL2oFp4rc89l3xVNJlUmH1ZsIYlcea3ho3bcBNH6oIX6hCInznM0NKWjqiSLwHc',
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
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCPfD_Jmk4XFRuVxW23V1fnlA6_1Qu-BNqDWJ2dpYOrn8KE3OveBmrH_EZjrTYFUye1O7Z7Gj2F4NBEqEUsDLx1urd5bqF8rfNfm__g3buZH-uLov62E2-ARnhpxV7zv_x_p4WMOBdCM_TGrZxa3MiOWyeKRL_W2uZj1KDk010YbY7YToBkm21ofLeEpe8RYO1cr4GNwf5WRzOjmdu22tBl8Js-tyfMD_Dri79MVsa3HrV0_T72l6Fzl0P1IKoO4OU5b6MB5KPfGas',
        imageAlt: 'QR ordering system at AURA CAFE',
      },
      {
        id: 't5',
        phase: 'PHASE 05',
        year: '2026',
        title: t('about.phase5Title'),
        description: t('about.phase5Desc'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuBYYcihYurow2nJrdoCiHePwHUYCxmNt1zlg0kMou4a5zFHuyLbwQbY5OqQJvPLeWaXqn_hUV5V6sJGl9OzUToekQCxgn1IDMC0Nsxy0Q9Gu-YJEM1SR8S5J4eWTQicX2ZwTPYqukPe2j6qMM2zMjs7HRbj5jRVAbKJeSiAe-bdslvZUWzABh6QeSjANkXYIi-OoMoLF6-PYx2GmL2oFp4rc89l3xVNJlUmH1ZsIYlcea3ho3bcBNH6oIX6hCInznM0NKWjqiSLwHc',
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
          'https://lh3.googleusercontent.com/aida-public/AB6AXuD0hTVOW-2T_HSEmq53Pb7AEZBFR8ae8eJMY3PL54yKWKRtc9WanD14EXEJmov3uC1btKTebvh8xQr1BkheLr9GnPYtaEBtln5SEecxLVz75JiU8Vf8wo3BAP4bFUXL1UXQ0_6CQvlvck3-HkAQYzX8mY-oOAV22qfADhgusqex-eb2bG3SQn2AJy-XJd76e8LG4atTMmuXQT6JPgVHZgbR7j4Ubp6es3ijUYIvxBCCuJQAtEFlMdccyJJvlYFvABHqRhDKBmx3OMM',
        imageAlt: 'Jade Counter bar at AURA CAFE',
      },
      {
        id: 'z2',
        name: t('about.zone2Name'),
        role: t('about.zone2Desc'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDgfqivZ4J9F9ALO0GTgB_Z0rbCTmUEawwAR3hXr_VRk1h6IR3BcDC7KAMutiNOeRpxmwZlgVDY9V8_iYr-v8hJTfrkRWNkfvJyXcgKUWI8yIFHdLiIvcMo4yHk2tdaNRNoSaAzwEdjqWEjTb-i7e3RHKgN-kPRcwmfCV8kTbD-TrKGj_D2r2ogO-xEtstKWc1OOuYtLFJvj1HHJnyixp68v0NvphBEmertvS1t0AVjjT7VhuWtaE1O4KS0Bq0vOqpCySKxJhslSZQ',
        imageAlt: 'Sky Deck rooftop at AURA CAFE',
      },
      {
        id: 'z3',
        name: t('about.zone3Name'),
        role: t('about.zone3Desc'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuAYaFzAQnHsBcweMI-ofjrDs7pX4coYiiouhaKBmGvhfibi7v8L2wPAZeTwkZXBTP4cY_eXb8wzqxzepG385zAsb1cEEzk-McHQF4m6D9Yr8YD1MTNJYKUoXxSuIc3hyozLHE0Ck2TDPqBtEWrtdsJUm8rLq2l231MGOHD9F1_xaK2lOX5tjqYa3Jq7m8_IcWvwCUq8CrzObjAiWVByuImnMtQET04w32DqQM8o7HvfEqzJoOo2RI_SOsfCvgxcx_7QpleGgYWcpvE',
        imageAlt: 'Noir Cabin at AURA CAFE',
      },
      {
        id: 'z4',
        name: t('about.zone4Name'),
        role: t('about.zone4Desc'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuAvoHrNnq13Jbj-7p-DBqbVcqXI9vg6xDFaroJ0sK8Zvc0Li1IF7NgFOyRLz2rnimLmKipejw4MNY5SZgXDYR03xCNQGAqpPH7Ttw8pJSmuKZnrCLOYc0_EBUFmoh8r-I-FUbFQMw92vfpXcDpNQEJslu9GtwTeSmGcdfwLpB2211lwtVhxf70G8lbF2zyApMwot3LtykT5pEsDMSo-eqJ3N7Tuddj-_LhtDWgEfK14MidFI2_NBcTDU3c6YoQSoQtResKGGhdknV8',
        imageAlt: 'Aura Lounge silver-themed lounge at AURA CAFE',
      },
      {
        id: 'z5',
        name: t('about.zone5Name'),
        role: t('about.zone5Desc'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCPfD_Jmk4XFRuVxW23V1fnlA6_1Qu-BNqDWJ2dpYOrn8KE3OveBmrH_EZjrTYFUye1O7Z7Gj2F4NBEqEUsDLx1urd5bqF8rfNfm__g3buZH-uLov62E2-ARnhpxV7zv_x_p4WMOBdCM_TGrZxa3MiOWyeKRL_W2uZj1KDk010YbY7YToBkm21ofLeEpe8RYO1cr4GNwf5WRzOjmdu22tBl8Js-tyfMD_Dri79MVsa3HrV0_T72l6Fzl0P1IKoO4OU5b6MB5KPfGas',
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
