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
      '/photos/IMG_6593.webp',
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
      '/photos/IMG_6581.webp',
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
          '/photos/IMG_6554-frame.webp',
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
          '/photos/IMG_6555-frame.webp',
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
          '/photos/IMG_6564.webp',
        imageAlt: t('containerNew1.chromeVelvetAlt', {
          defaultValue:
            'A minimalist presentation of a smoked vanilla latte in a clear heat-resistant glass with cinnamon stick, set on a chrome saucer with warm bronze side lighting.',
        }),
      },
    ],
  };
}
