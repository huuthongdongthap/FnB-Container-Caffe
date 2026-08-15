import type { MenuItem, LoungeFeature } from './luxury-cafe-1-types';

export const MENU_ITEMS: readonly MenuItem[] = [
  {
    name: 'Aura Black',
    desc: 'Double Ristretto + Dark Truffle',
    price: '$12',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDp4XjinRclf8CqNnLmIYewjeHbcjniV5nJGvxoD2IjrlUbmkrMcDC_ONgYpcefGbGkMdlu2L4_UqAXjPyez25KFnXUE9J_IY16PganHo5aQ-fIN4adFW5hg3qRq3olg3BCvt8e2JMw55xa1TRDKCVHel6KyODuNzsV9-0uYYZR-c21TyiUrtRkzSSfzWNQBPuHgpQeAibKB0Yy4pCJdLqIExztWIOq3ZSKhKWsJ4bfw3yeK_5l934xHQ9J0JUwEorAHNNnESrw_Go',
    alt: 'A top-down artistic photograph of a premium espresso served in a handcrafted ceramic matte black cup. Beside it sits a single dark chocolate truffle with a dust of edible gold leaf. The composition is set on a brushed metal surface with subtle reflections of blue neon light, embodying the industrial luxury brand aesthetic.',
  },
  {
    name: 'Midnight Cold',
    desc: 'Nitrogen Infused + Botanical Hint',
    price: '$14',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBUzS7x7cFXOR5vzWdE_sSz2STpDN5tNUhDp9WBaIkJ7OpLNpl_ScnMKMmUcvpYc_0LdudBNyGyAJ7r3fVFjVdLjfLDDq4Cg9EO8tgbuZxfMAVCUAXFykHWzPL68JAXnbdCg2tm9rdW7iVavzyYdxEILW-5QfgQ_M2uOOuTd2ZteQHCJI_iAQK8HZ_hQsd7oK_WoWIY5I1yzWiOIyXm1QLIr8E_OKMzNasmpOsiL-oO4exyXNvFrRVPlYKye2ZkGOnom5ONrV2VQx4',
    alt: 'A sophisticated cold brew coffee cocktail served in a tall glass with a single oversized clear ice cube. A sprig of dried lavender and a thin strip of orange zest garnish the drink. The background shows the blurred industrial textures of a container cafe with subtle bronze lighting, highlighting the premium nocturnal vibe.',
  },
  {
    name: 'Chrome Velvet',
    desc: 'Smoked Vanilla + Oat Silk',
    price: '$11',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAlc7BYI9NI0PGTmim_5GHC-P_uKaVfNMXUPfsNaXXLQYoqqeRPHA-fMzA32yhTH41h_sMNFkL0gTjPJewjllQw3Inyy3HEZMxPVxMLw2AP0S1Vd-140Tsr8vG6bKu6XREidhYfDlgWetla_Au3nEXBWaSw40-Pci30e-gGXtBMO7VzD4Z-fOy6U0OyN03XE1hYacQT3bmVGS-vjyPFzmEO2eqClIWqLmffgOHNAzW-q_qTv9qz5ORsM7vLFHnbFDOEHAAPLQySrwo',
    alt: 'A minimalist presentation of a smoked vanilla latte in a clear heat-resistant glass. A faint swirl of steam rises from the cup, and a small cinnamon stick rests on a chrome saucer. The scene is lit by a warm bronze glow from the side, creating long elegant shadows against a navy blue backdrop.',
  },
] as const;

export const LOUNGE_FEATURES: readonly LoungeFeature[] = [
  { num: '01', title: 'Curated Soundscapes', desc: 'Deep ambient and minimalist electronic beats.' },
  { num: '02', title: 'Artisanal Brews', desc: 'Single-origin beans roasted specifically for evening consumption.' },
] as const;
