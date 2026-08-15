export const NAV_LINKS = [
  { label: 'Home', href: '#' },
  { label: 'Menu', href: '#menu' },
  { label: 'Location', href: '#location' },
] as const;

export const FEATURES = [
  {
    emoji: '🏗️',
    heading: 'Architectural Precision',
    body: 'Our space is built from repurposed industrial containers, refined with high-end glasswork and brushed metallic surfaces.',
  },
  {
    emoji: '☕',
    heading: 'Curated Brews',
    body: 'Sourcing only the finest specialty beans, our baristas craft each cup using technical precision and artisanal soul.',
  },
  {
    emoji: '🌙',
    heading: 'Nocturnal Ambience',
    body: 'Designed for the twilight hours, our lighting system creates a moody, sophisticated environment perfect for late-night inspiration.',
  },
] as const;

export const MENU_ITEMS = [
  { name: 'Nocturnal Espresso', desc: 'Dark roast, cacao nibs, smoked cedar', price: '$5.50' },
  { name: 'Chrome Cold Brew', desc: '12-hour filtration, silver-tip jasmine infusion', price: '$6.25' },
  { name: 'Bronze Latte', desc: 'Salted caramel honeycomb, oat silk base', price: '$6.50' },
] as const;

export const FOOTER_LINKS = [
  { label: 'Menu', href: '#' },
  { label: 'Our Story', href: '#' },
  { label: 'Reservation', href: '#' },
  { label: 'Privacy Policy', href: '#' },
  { label: 'Terms of Service', href: '#' },
  { label: 'Contact Us', href: '#' },
] as const;
