/**
 * Default menu data and category definitions for AURA CAFE mobile ordering.
 */
import type { MenuItem } from './StitchMobileOrderNew-types';

export const DEFAULT_ITEMS: MenuItem[] = [
  {
    id: '1',
    name: 'Midnight Espresso',
    description: 'Double shot of reserve beans, notes of dark cocoa and star anise.',
    price: 6.5,
    priceLabel: '$6.50',
    category: 'coffee',
    badge: 'Signature',
    featured: true,
    imageSrc:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCwdsFH89n5qOne2pC5RLJOugzRVNz_2K7TiYtIwSBFa_o2fTRtUdH0v3HZuxfIH4qSRynBF5k98BQek1PnbvU5bfnCA3RNz8TP9OgytrC9t9rR0N2uOFIa_yVN95yxowo_xspC10KiuymqoVK1VsU6RE4awCLAlWQqf5lN4etscE_1bWpMy6pKhg6wyxQe9u07flyVAWUvGx_LMd3ndty3GfG1XJZsqAJMrUFEq3erkUiT9v7YN9s_jMhKA_iuVfhd1739-cl_LHY',
    imageAlt:
      'Cinematic close-up of a Midnight Espresso in a minimalist glass cup against a dark industrial cafe background with subtle blue neon accents',
  },
  {
    id: '2',
    name: 'Chrome Velvet Latte',
    description: 'Silky texture with a hint of vanilla and silver-dusted topping.',
    price: 7.25,
    priceLabel: '$7.25',
    category: 'coffee',
    featured: true,
    imageSrc:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDW4_mtBXw9yFcpHcU0qYN7ITB4vUmRIfuNsNaGMxab_GB2MLIMgw2NCiGyE2yio81jNy2hRNByMHlI-AqOdCPR1A93RA4EM5uZp_BYVw8SChv6NpvdTOG4xEYQwpwPGxNrDk8aY8wSIelzJLltcTSyCH7_XQwtud2XV03XmfWQwilm5jPN2_98oEb56nAhoxMfbz3c39hZxhqbpaRG3cueTQKmZFVDBQkunCL6AL68YpaoQb-IfivMl_NJrQZJvMSAZ7dhuhsUS0o',
    imageAlt:
      'Premium Chrome Velvet Latte with intricate latte art in a textured ceramic mug set against metallic silver and navy blue accents',
  },
  {
    id: '3',
    name: 'Smoky Amber Cold Brew',
    description: '18-hour cold steeped with smoked cedar infusion.',
    price: 8.0,
    priceLabel: '$8.00',
    category: 'cold-brew',
    badge: 'Signature',
    imageSrc:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDCjEHWXhk-wZ78ADsOLT2qxDEb7cEFtonZe8IBVBaA8dSYj2XfRa55YmkQC_91xBwEn8TxfQ14l-u0PtB80LNcraAoxMjH-EmQfMrHe6z_uUXLH7Tu7LOF7Nj3vcNUzWNoz51aXJbwa2ZyvRDwRsyuh81QWET7tvv5nc-RHd9UsOgCCblDMLh5ASp0ZnPlhoQgPRDqvSiQje115mX2lH7LrjRkw-IRjybvD8aBzfdsv_s0ignn1QZ7rZYQoQH0PsxUuaex9BIAsmc',
    imageAlt:
      'Sophisticated presentation of a Smoky Amber Cold Brew in a tall crystal glass with large clear ice spheres against blurred high-end lounge background',
  },
  {
    id: '4',
    name: 'Jasmine Pearl Tea',
    description: 'Hand-rolled jasmine pearls steeped to perfection.',
    price: 5.5,
    priceLabel: '$5.50',
    category: 'tea',
    imageSrc:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCzY8QDxMfEFkPH6YDIM7_6MfFMgYD_aDAs7VnSoMyaQys0_ekK1s1VCP0mmqRKxF9x_bqDqNGWYxE-0bHFJY5Whntq9jsqj6DP1y_ZM_mjHjOCf9qwXFn_0FlOBoGY1C3yAWn6V8nD9WrhIn8nIYj3GGtMoF9cCXCCF_qIGdMojz3qC6t5I-JhctPSy6v7MgVNZUQTQzUUKGYysV5ld9GQ3v8_vJCVu7tBfCcncCgW4zV4iGEZQjH3xhWlmpAF4wdcbWFCY5w',
    imageAlt:
      'Delicate jasmine pearl tea in a clear glass teapot with steam rising against a warm ambient background',
  },
  {
    id: '5',
    name: 'Golden Turmeric Latte',
    description: 'Plant-based golden milk with ginger, honey, and black pepper.',
    price: 6.75,
    priceLabel: '$6.75',
    category: 'signature',
    badge: 'Signature',
    featured: true,
    imageSrc:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA_sYBGC9BpGTJP8c-2TfgTzvBqOznOcFP1iUFWIGyFnK6EVsRMr8Y3UfoDjBd6gWDWEl-JACrV6IG8V3-SlYN3XeC_j2zUehDo7D85mdG6YbjV4gX03tDzGnLByAt9iQjVQ2Mr5ceGVpKRE6pZGNyVssPBQzTpSaN9FT2uUNSwmqgQ8_8vnAp2fV3GDFQvNb6tS6XZgBdQBQLYVmDDKX7tW8GRHBBrv_BRHC9vd4DJFP7Qq3vA_ORw3CpjYyPjH-pIe6D0',
    imageAlt:
      'Vibrant golden turmeric latte in a ceramic cup with artistic foam pattern on a dark wooden surface',
  },
];

export const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'coffee', label: 'Coffee' },
  { key: 'tea', label: 'Tea' },
  { key: 'signature', label: 'Signature' },
  { key: 'cold-brew', label: 'Cold Brew' },
] as const;
