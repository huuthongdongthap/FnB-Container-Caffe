import type { TFunction } from 'i18next';
import type { ContainerCafeData } from './stitch-container-new1-types';

/**
 * Builds the default ContainerCafeData using translation keys.
 */
export function buildDefaultContainerData(t: TFunction): ContainerCafeData {
  return {
    heroTag: t('containerNew1.heroTag', { defaultValue: 'Industrial Luxury' }),
    heroTitle: t('containerNew1.heroTitle', { defaultValue: 'AURA CAFE —' }),
    heroSubtitle: t('containerNew1.heroSubtitle', { defaultValue: 'Container Caffe & Space' }),
    heroDescription: t('containerNew1.heroDescription', {
      defaultValue:
        'Experience the intersection of raw industrial aesthetics and premium nocturnal comfort. Our shipping container architecture creates an exclusive haven for the sophisticated coffee connoisseur.',
    }),
    heroImageUrl: '',
    heroImageAlt: t('containerNew1.heroImageAlt', {
      defaultValue:
        'A cinematic architectural shot of a sleek black shipping container cafe at night. The structure features floor-to-ceiling frosted glass panels that emit a soft blue glow.',
    }),
    sectionTitle: t('containerNew1.sectionTitle', { defaultValue: 'The Container Aesthetic' }),
    featureCardTitle: t('containerNew1.featureCardTitle', { defaultValue: 'Industrial Luxury Redefined' }),
    featureCardText: t('containerNew1.featureCardText', {
      defaultValue:
        'Constructed from repurposed high-cube shipping containers, our architecture celebrates the raw beauty of structural steel, softened by curated textures and ambient lighting. Each seam tells a story of global travel, now anchored in a premium urban setting.',
    }),
    featureImageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBsJ-aUIE708Rnn2voLZkj1EFSTKYm9uFUUsl4N8kkRvw0mUK2olfYxBo-dx3uuGmzr9Xbj65PpNiXX0qfIpjNj1pq6PMnY2wxKt3DZfqSENNPEwFwR51It_t46VXSlUL-LrfH-Mbui8y4QoLjmgREQQyp_1fwSZy8F-Wubv5T1C51YF_V2edIcW_VmwQOuqLsY_d5b5VsbqhzXau3kfE46n7Wgn4SAY-1dov0z-6Fa3Tvm5f_YVukHL82ZefgiIPbEDjZxYbCkmdk',
    featureImageAlt: t('containerNew1.featureImageAlt', {
      defaultValue:
        'A cinematic architectural shot of a sleek black shipping container cafe at night. Polished bronze accents and industrial chrome beams under dramatic spotlighting.',
    }),
    detailCards: [
      {
        id: 'frosted-glass',
        icon: 'layers',
        title: t('containerNew1.frostedGlassTitle', { defaultValue: 'Frosted Glass Modules' }),
        description: t('containerNew1.frostedGlassDesc', {
          defaultValue:
            'Translucent panels provide privacy while diffusing the nocturnal urban glow, creating an ethereal inner sanctum.',
        }),
      },
      {
        id: 'chrome-bronze',
        icon: 'precision_manufacturing',
        title: t('containerNew1.chromeBronzeTitle', { defaultValue: 'Chrome & Bronze' }),
        description: t('containerNew1.chromeBronzeDesc', {
          defaultValue:
            'Metallic accents provide a sharp contrast to the matte navy finishes, reflecting the precision of modern design.',
        }),
        highlight: true,
      },
    ],
    loungeTag: t('containerNew1.loungeTag', { defaultValue: 'The Experience' }),
    loungeTitle: t('containerNew1.loungeTitle', { defaultValue: 'Nocturnal Lounge' }),
    loungeDescription: t('containerNew1.loungeDescription', {
      defaultValue:
        'When the sun sets, Aura Cafe transforms. The atmosphere shifts to a sophisticated nocturnal lounge where shadows and light play across metallic surfaces. It’s a space for deep conversation, focused work, or solitary reflection.',
    }),
    loungeImageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCvEFA1n0gDJ7sY-7Kf08hzbSpUGSfNrJaB4u1K95Kd3SxOsBa8XqPdqOh5YFdoL24nY_UnuSGW0UIal6mxwS1EsohB4InWFDMvbaHx1VSHzFTlgQ5shAyGEXnc5dfQN_E_p-0td8GKICCe5jihht0-pKTrxDg-1jXyLytANRaea1_TQZJwUMuDSvhHgGnMFHW2YLoXz4FTQ0HAUcBDNXLHR3A_4Q1B6UOSESHqI5jPZ7plyVt_-SyBl7BKSNS1nEG7FdQ7Psa3eNM',
    loungeImageAlt: t('containerNew1.loungeImageAlt', {
      defaultValue:
        'A moody interior view of a premium nocturnal lounge inside an industrial container space with warm bronze desk lamps and subtle blue neon strips.',
    }),
    loungeFeatures: [
      {
        id: 'soundscapes',
        number: '01',
        title: t('containerNew1.soundscapesTitle', { defaultValue: 'Curated Soundscapes' }),
        description: t('containerNew1.soundscapesDesc', {
          defaultValue: 'Deep ambient and minimalist electronic beats.',
        }),
      },
      {
        id: 'artisanal-brews',
        number: '02',
        title: t('containerNew1.artisanalBrewsTitle', { defaultValue: 'Artisanal Brews' }),
        description: t('containerNew1.artisanalBrewsDesc', {
          defaultValue: 'Single-origin beans roasted specifically for evening consumption.',
        }),
      },
    ],
    menuSectionTitle: t('containerNew1.menuSectionTitle', { defaultValue: 'Evening Selections' }),
    menuSectionSubtitle: t('containerNew1.menuSectionSubtitle', { defaultValue: 'Signature Pairings' }),
    menuItems: [
      {
        id: 'aura-black',
        name: t('containerNew1.auraBlack', { defaultValue: 'Aura Black' }),
        description: t('containerNew1.auraBlackDesc', { defaultValue: 'Double Ristretto + Dark Truffle' }),
        price: '$12',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDp4XjinRclf8CqNnLmIYewjeHbcjniV5nJGvxoD2IjrlUbmkrMcDC_ONgYpcefGbGkMdlu2L4_UqAXjPyez25KFnXUE9J_IY16PganHo5aQ-fIN4adFW5hg3qRq3olg3BCvt8e2JMw55xa1TRDKCVHel6KyODuNzsV9-0uYYZR-c21TyiUrtRkzSSfzWNQBPuHgpQeAibKB0Yy4pCJdLqIExztWIOq3ZSKhKWsJ4bfw3yeK_5l934xHQ9J0JUwEorAHNNnESrw_Go',
        imageAlt: t('containerNew1.auraBlackAlt', {
          defaultValue:
            'A top-down artistic photograph of a premium espresso served in a handcrafted ceramic matte black cup with a dark chocolate truffle dusted with edible gold leaf.',
        }),
      },
      {
        id: 'midnight-cold',
        name: t('containerNew1.midnightCold', { defaultValue: 'Midnight Cold' }),
        description: t('containerNew1.midnightColdDesc', { defaultValue: 'Nitrogen Infused + Botanical Hint' }),
        price: '$14',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuBUzS7x7cFXOR5vzWdE_sSz2STpDN5tNUhDp9WBaIkJ7OpLNpl_ScnMKMmUcvpYc_0LdudBNyGyAJ7r3fVFjVdLjfLDDq4Cg9EO8tgbuZxfMAVCUAXFykHWzPL68JAXnbdCg2tm9rdW7iVavzyYdxEILW-5QfgQ_M2uOOuTd2ZteQHCJI_iAQK8HZ_hQsd7oK_WoWIY5I1yzWiOIyXm1QLIr8E_OKMzNasmpOsiL-oO4exyXNvFrRVPlYKye2ZkGOnom5ONrV2VQx4',
        imageAlt: t('containerNew1.midnightColdAlt', {
          defaultValue:
            'A sophisticated cold brew coffee cocktail served in a tall glass with a single oversized clear ice cube, dried lavender sprig, and orange zest garnish.',
        }),
      },
      {
        id: 'chrome-velvet',
        name: t('containerNew1.chromeVelvet', { defaultValue: 'Chrome Velvet' }),
        description: t('containerNew1.chromeVelvetDesc', { defaultValue: 'Smoked Vanilla + Oat Silk' }),
        price: '$11',
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuAlc7BYI9NI0PGTmim_5GHC-P_uKaVfNMXUPfsNaXXLQYoqqeRPHA-fMzA32yhTH41h_sMNFkL0gTjPJewjllQw3Inyy3HEZMxPVxMLw2AP0S1Vd-140Tsr8vG6bKu6XREidhYfDlgWetla_Au3nEXBWaSw40-Pci30e-gGXtBMO7VzD4Z-fOy6U0OyN03XE1hYacQT3bmVGS-vjyPFzmEO2eqClIWqLmffgOHNAzW-q_qTv9qz5ORsM7vLFHnbFDOEHAAPLQySrwo',
        imageAlt: t('containerNew1.chromeVelvetAlt', {
          defaultValue:
            'A minimalist presentation of a smoked vanilla latte in a clear heat-resistant glass with cinnamon stick, set on a chrome saucer with warm bronze side lighting.',
        }),
      },
    ],
  };
}
