/**
 * Default gallery items and filter options for StitchGalleryNew
 */

import type { FilterId, GalleryItem } from './StitchGalleryNew-types';

export const defaultItems: GalleryItem[] = [
  {
    id: 'precision-pos',
    label: 'MODULE 01',
    title: 'PRECISION POS',
    filter: 'tech',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAEiV-QAGkavYocOjVe1OiC9HYLEpUnS0hSnLtZbMFXjgvWa6u5eiGCHFJJaye-088uZG7LRRU-VkmqQWcV235vxTA1dWAvxGqDZwB9tiqBI3X7ZpgE9tr1A9cxvTnZ6NmXXZlOGq2pJVMrHwwty_fZ2ZbASVwt9MzFrKf2eMIHvRVEQ-CHRGS6HtlXatduxF9KLZ3cD6nsFvFpEnY5tAfyD3PmJiBqWuh8XnYftXlveecAFs3i26x98_2vGIJEsnWyYVg5er6h6QI',
    imageAlt: 'A moody architectural detail shot of a modular industrial cafe POS terminal system',
  },
  {
    id: 'kinetic-kitchen',
    label: 'MODULE 02',
    title: 'KINETIC KITCHEN',
    filter: 'industrial',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBnUMUlDrK3em7MDLGcWVEJHE4Anrrf5ChGIZrUB1W12deXrNKzyW1PhN429aEFKkeBDY4WwURMNWG5H1smPIZbPHZ1LYlrmo9ZgztN442qNawaYIomsr3YZXEtZrFBeJxG_B3CFIq79ZMEIg154EtM1EXzPCSQ7nviuDoh4DgkRCzwMAlB8rVzu_0NNXqV8LHgJgYf7Xv_6Q-9OFWCA7U64Bj73gxVZ4hbWZx8FS4G_-PvzS7ECq2XlagiTGso0GXATKzGaqocCM4',
    imageAlt: 'A dramatic wide shot of a kinetic open kitchen layout with brushed chrome surfaces and warm bronze hood lighting',
  },
  {
    id: 'nocturnal-loyalty',
    label: 'MODULE 03',
    title: 'NOCTURNAL LOYALTY',
    filter: 'luxury',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCEnI_-206HaL0xOKv9qDtOdHOg-O9423VqXdO_DElBPLmV76Ehu_GObW1TinmAr-7wbOqnY73qypOaYI1PWClhDNSNFXZ7RoyXmvLqcLvDB3HmXIKJGeeN36-vWAZTpEWNzYuNOHW8563HIMo4HxvEDnFS5wjzefau9HWPKSHskH4DgUU_7PKRUZ4nMahxhChoej4z7gGoW3aIBMfO_EifWn-6UHcLo-T7xViZTm-BqjJPR32K2tf2ExAyqQyoniO1VMvUtBJxh4w',
    imageAlt: 'An elegant nocturnal loyalty program interface displayed on a sleek tablet surrounded by dark navy velvet textures',
  },
  {
    id: 'atmospheric-grid',
    label: 'MODULE 04',
    title: 'ATMOSPHERIC GRID',
    filter: 'tech',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDfhArIIay07cNLaryaJFYmvycJddJwvti9hFfFCneAC6OvU6JzjVcUSCdKaE1nkVicGJhyh7fyRX8hOgMdk1BFF_-hPBrCGDDpu-FC-i4vhfeQC3JNuG-EuJTbDP_mzqHkLK28CHbcex10kYg8mJi68L4UdvnWb4UxLpwqGPq7hZP2QDLBO0yL_4EiIPX5SsxFhuzC5hOAOmgv7crYbYO7_mv51auc8j9BI4Aqw2TchwXyWJNtKKepfK98I7EQWAuctJPgtv6hJpY',
    imageAlt: 'An abstract atmospheric grid visualization showing ambient cafe sensor data rendered in bronze and navy tones',
  },
];

export const filterOptions: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'industrial', label: 'INDUSTRIAL' },
  { id: 'luxury', label: 'LUXURY' },
  { id: 'tech', label: 'TECH' },
];
