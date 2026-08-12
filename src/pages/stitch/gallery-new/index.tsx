import { useState } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

type GalleryFilter = 'ALL' | 'INDUSTRIAL' | 'LUXURY' | 'TECH';

const ICON_ARROW = '➔';
const ICON_HOME = '\u{1F3E0}';
const ICON_GRID = '\u{1F5C2}️';
const ICON_MENU = '\u{1F4D6}';
const ICON_RESERVE = '\u{1F4CB}';

const FILTERS: readonly { label: GalleryFilter; color?: string }[] = [
  { label: 'ALL', color: 'text-accent-bronze' },
  { label: 'INDUSTRIAL' },
  { label: 'LUXURY' },
  { label: 'TECH' },
] as const;

const GALLERY_ITEMS = [
  {
    id: 1,
    module: 'MODULE 01' as const,
    title: 'PRECISION POS' as const,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAEiV-QAGkavYocOjVe1OiC9HYLEpUnS0hSnLtZbMFXjgvWa6u5eiGCHFJJaye-088uZG7LRRU-VkmqQWcV235vxTA1dWAvxGqDZwB9tiqBI3X7ZpgE9tr1A9cxvTnZ6NmXXZlOGq2pJVMrHwwty_fZ2ZbASVwt9MzFrKf2eMIHvRVEQ-CHRGS6HtlXatduxF9KLZ3cD6nsFvFpEnY5tAfyD3PmJiBqWuh8XnYftXlveecAFs3i26x98_2vGIJEsnWyYVg5er6h6QI',
    alt: 'Precision POS terminal in industrial luxury setting with chrome finishes',
  },
  {
    id: 2,
    module: 'MODULE 02' as const,
    title: 'KINETIC KITCHEN' as const,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBnUMUlDrK3em7MDLGcWVEJHE4Anrrf5ChGIZrUB1W12deXrNKzyW1PhN429aEFKkeBDY4WwURMNWG5H1smPIZbPHZ1LYlrmo9ZgztN442qNawaYIomsr3YZXEtZrFBeJxG_B3CFIq79ZMEIg154EtM1EXzPCSQ7nviuDoh4DgkRCzwMAlB8rVzu_0NNXqV8LHgJgYf7Xv_6Q-9OFWCA7U64Bj73gxVZ4hbWZx8FS4G_-PvzS7ECq2XlagiTGso0GXATKzGaqocCM4',
    alt: 'Kinetic kitchen dashboard with live order tracking holographic interface',
  },
  {
    id: 3,
    module: 'MODULE 03' as const,
    title: 'NOCTURNAL LOYALTY' as const,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCEnI_-206HaL0xOKv9qDtOdHOg-O9423VqXdO_DElBPLmV76Ehu_GObW1TinmAr-7wbOqnY73qypOaYI1PWClhDNSNFXZ7RoyXmvLqcLvDB3HmXIKJGeeN36-vWAZTpEWNzYuNOHW8563HIMo4HxvEDnFS5wjzefau9HWPKSHskH4DgUU_7PKRUZ4nMahxhChoej4z7gGoW3aIBMfO_EifWn-6UHcLo-T7xViZTm-BqjJPR32K2tf2ExAyqQyoniO1VMvUtBJxh4w',
    alt: 'Nocturnal loyalty rewards holographic display with glowing bronze tier indicators',
  },
  {
    id: 4,
    module: 'MODULE 04' as const,
    title: 'ATMOSPHERIC GRID' as const,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDfhArIIay07cNLaryaJFYmvycJddJwvti9hFfFCneAC6OvU6JzjVcUSCdKaE1nkVicGJhyh7fyRX8hOgMdk1BFF_-hPBrCGDDpu-FC-i4vhfeQC3JNuG-EuJTbDP_mzqHkLK28CHbcex10kYg8mJi68L4UdvnWb4UxLpwqGPq7hZP2QDLBO0yL_4EiIPX5SsxFhuzC5hOAOmgv7crYbYO7_mv51auc8j9BI4Aqw2TchwXyWJNtKKepfK98I7EQWAuctJPgtv6hJpY',
    alt: 'Atmospheric dining grid layout with industrial chic booth configurations',
  },
] as const;

type GalleryItem = (typeof GALLERY_ITEMS)[number];

export default function GalleryNew() {
  const [activeFilter, setActiveFilter] = useState<GalleryFilter>('ALL');
  const [activeItem, setActiveItem] = useState<number | null>(null);

  const handleSetFilter = (filter: GalleryFilter) => {
    setActiveFilter(filter);
  };

  const handleToggleActive = (id: number) => {
    setActiveItem(prev => prev === id ? null : id);
  };

  return (
    <StitchShell>
      {/* TopAppBar */}
<PageHeader brand="AURA CAFE" scrollEffect />

      <main className="pt-32 pb-32 px-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h2 className="font-headline-lg text-primary-fixed-dim uppercase tracking-widest border-l-4 border-[var(--aura-tertiary)] pl-4">
            Design Showcase
          </h2>
          <p className="font-body-md text-on-surface-variant mt-4 opacity-70">
            Exploring the industrial luxury and visual language of AURA.
          </p>
        </div>

        {/* Filter Nav */}
        <nav className="flex gap-8 mb-12 overflow-x-auto pb-4 border-b border-outline-variant/20">
          {FILTERS.map(f => (
            <button
              key={f.label}
              type="button"
              onClick={() => handleSetFilter(f.label)}
              className={`relative group flex flex-col items-start focus:outline-none ${
                activeFilter === f.label ? '' : 'opacity-50 hover:opacity-100 transition-opacity'
              }`}
              aria-pressed={activeFilter === f.label}
            >
              <span className={`font-label-caps tracking-widest uppercase mb-2 ${
                activeFilter === f.label ? (f.color || 'text-[var(--aura-tertiary)]') : 'text-primary-fixed-dim'
              }`}>
                {f.label}
              </span>
              <div className={`h-[2px] w-full ${activeFilter === f.label ? 'bg-[var(--aura-tertiary)]' : 'bg-transparent group-hover:bg-outline-variant/30 transition-colors'}`} />
            </button>
          ))}
        </nav>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {GALLERY_ITEMS.map((item, index) => (
            <div
              key={item.id}
              className={`gallery-item group cursor-pointer border border-outline-variant/20 transition-all duration-500 ${
                activeItem === item.id ? 'active' : ''
              }`}
              style={{
                opacity: 0,
                transform: 'translateY(20px)',
                transition: `all 0.6s cubic-bezier(0.23, 1, 0.32, 1) ${index * 0.1}s`,
              }}
              onClick={() => handleToggleActive(item.id)}
            >
              <div className="relative overflow-hidden aspect-[4/3] bg-surface-container-highest">
                <img
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 scale-105 group-hover:scale-100"
                  alt={item.alt}
                  src={item.image}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" aria-hidden="true" />
                <div className="absolute bottom-4 left-4">
                  <span className="font-label-caps text-xs text-[var(--aura-tertiary)] bg-[var(--aura-noir-deep)]/80 px-2 py-1 border border-[var(--aura-tertiary)]/30">
                    {item.module}
                  </span>
                </div>
              </div>
              <div className="p-6 border-t border-outline-variant/20 flex justify-between items-center bg-surface-container-lowest">
                <h3 className="font-label-caps text-primary-fixed-dim tracking-widest">{item.title}</h3>
                <span className="material-symbols-outlined text-outline text-sm">{ICON_ARROW}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Load More */}
        <div className="mt-20 flex justify-center">
          <button type="button" className="border border-outline-variant px-12 py-4 font-label-caps text-primary-fixed-dim hover:bg-primary-fixed-dim hover:text-on-primary transition-all duration-300">
            LOAD MORE ARCHIVES
          </button>
        </div>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full z-50 flex justify-around items-center bg-[var(--aura-surface-container)]/95 backdrop-blur-lg border-t border-primary-container/20" aria-label="Gallery navigation">
        <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant/60 pt-2 pb-4 hover:text-[var(--aura-tertiary)] transition-all">
          <span className="material-symbols-outlined mb-1">{ICON_HOME}</span>
          <span className="font-label-caps text-[10px] tracking-widest uppercase">HOME</span>
        </a>
        <a href="#" className="flex flex-col items-center justify-center text-[var(--aura-tertiary)] border-t-2 border-[var(--aura-tertiary)] pt-2 pb-4 scale-95 transition-all">
          <span className="material-symbols-outlined mb-1">{ICON_GRID}</span>
          <span className="font-label-caps text-[10px] tracking-widest uppercase">GALLERY</span>
        </a>
        <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant/60 pt-2 pb-4 hover:text-[var(--aura-tertiary)] transition-all">
          <span className="material-symbols-outlined mb-1">{ICON_MENU}</span>
          <span className="font-label-caps text-[10px] tracking-widest uppercase">MENU</span>
        </a>
        <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant/60 pt-2 pb-4 hover:text-[var(--aura-tertiary)] transition-all">
          <span className="material-symbols-outlined mb-1">{ICON_RESERVE}</span>
          <span className="font-label-caps text-[10px] tracking-widest uppercase">RESERVE</span>
        </a>
      </nav>
    </StitchShell>
  );
}
