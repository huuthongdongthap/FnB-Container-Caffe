export interface TimelineItem {
  readonly phase: string;
  readonly title: string;
  readonly desc: string;
  readonly img: string;
  readonly alt: string;
}

export interface TeamMember {
  readonly name: string;
  readonly role: string;
  readonly img: string;
  readonly alt: string;
}

export const TIMELINE: readonly TimelineItem[] = [
  {
    phase: 'PHASE 01: 2022',
    title: 'The Concept Blueprint',
    desc: 'Initial visioning of a cafe that exists at the intersection of container architecture and technical brewing precision.',
    img: '/photos/IMG_6698.webp',
    alt: 'Technical architectural drawings of a shipping container cafe layout on a dark metal desk with chrome pens and a matte black coffee cup.',
  },
  {
    phase: 'PHASE 02: 2023',
    title: 'Structural Assembly',
    desc: 'Salvaging three high-cube containers and re-engineering them with reinforced frames and panoramic glass panels.',
    img: '/photos/IMG_6703.webp',
    alt: 'Macro photo of a welding spark flying from a steel container frame in a dark industrial workshop.',
  },
  {
    phase: 'PHASE 03: 2024',
    title: 'Activation',
    desc: 'Aura Cafe opens its doors, establishing a new standard for the nocturnal coffee experience in the city center.',
    img: '/photos/IMG_6631.webp',
    alt: 'The finished Aura Cafe at night, a glowing glass and steel structure against a dark urban background.',
  },
] as const;

export const TEAM: readonly TeamMember[] = [
  {
    name: 'Elias Thorne',
    role: 'Principal Architect',
    img: '/photos/IMG_6593.webp',
    alt: 'Portrait of Elias Thorne, male architectural designer in a minimalist black turtleneck.',
  },
  {
    name: 'Sarah Chen',
    role: 'Extraction Engineer',
    img: '/photos/IMG_6581.webp',
    alt: 'Portrait of Sarah Chen, female coffee scientist in a lab setting.',
  },
  {
    name: 'Marcus Vane',
    role: 'Head of Roast',
    img: '/photos/IMG_6554-frame.webp',
    alt: 'Portrait of Marcus Vane, master roaster with a well-groomed beard in a warehouse.',
  },
  {
    name: 'Lena Rossi',
    role: 'Operations Lead',
    img: '/photos/IMG_6555-frame.webp',
    alt: 'Portrait of Lena Rossi, professional operations manager in a modern cafe.',
  },
] as const;

export const HERO_BG =
  '/photos/IMG_6699.webp';
