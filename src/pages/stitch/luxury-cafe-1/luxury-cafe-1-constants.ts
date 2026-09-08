import type { MenuItem, LoungeFeature } from './luxury-cafe-1-types';

export const MENU_ITEMS: readonly MenuItem[] = [
  {
    name: 'Aura Black',
    desc: 'Double Ristretto + Dark Truffle',
    price: '$12',
    img: '/photos/IMG_6554-frame.webp',
    alt: 'A top-down artistic photograph of a premium espresso served in a handcrafted ceramic matte black cup. Beside it sits a single dark chocolate truffle with a dust of edible gold leaf. The composition is set on a brushed metal surface with subtle reflections of blue neon light, embodying the industrial luxury brand aesthetic.',
  },
  {
    name: 'Midnight Cold',
    desc: 'Nitrogen Infused + Botanical Hint',
    price: '$14',
    img: '/photos/IMG_6555-frame.webp',
    alt: 'A sophisticated cold brew coffee cocktail served in a tall glass with a single oversized clear ice cube. A sprig of dried lavender and a thin strip of orange zest garnish the drink. The background shows the blurred industrial textures of a container cafe with subtle bronze lighting, highlighting the premium nocturnal vibe.',
  },
  {
    name: 'Chrome Velvet',
    desc: 'Smoked Vanilla + Oat Silk',
    price: '$11',
    img: '/photos/IMG_6564.webp',
    alt: 'A minimalist presentation of a smoked vanilla latte in a clear heat-resistant glass. A faint swirl of steam rises from the cup, and a small cinnamon stick rests on a chrome saucer. The scene is lit by a warm bronze glow from the side, creating long elegant shadows against a navy blue backdrop.',
  },
] as const;

export const LOUNGE_FEATURES: readonly LoungeFeature[] = [
  { num: '01', title: 'Curated Soundscapes', desc: 'Deep ambient and minimalist electronic beats.' },
  { num: '02', title: 'Artisanal Brews', desc: 'Single-origin beans roasted specifically for evening consumption.' },
] as const;
