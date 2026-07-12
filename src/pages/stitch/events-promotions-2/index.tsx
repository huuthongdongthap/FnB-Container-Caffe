import { useState, useRef } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

/* ── Data ─────────────────────────────────────────────────────────────── */

const MONTHS = ['OCT', 'NOV', 'DEC', 'JAN'] as const;

const EVENTS = [
  {
    id: 1,
    date: 'OCT 14',
    title: 'Aura Mixology Masterclass',
    description:
      'Uncover the secrets behind our signature nocturnal infusions with our lead mixologist.',
    time: '19:00 - 21:00',
    timeIcon: '🕐',
    tag: 'WORKSHOP',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDArV05s4bg-ehkkouTASvhXigAIWBNNSiyeh-2aXFy9_I0YIX9dby9vcSBVh96T_sg_RZU6yFsm9-siWe_MMgo0JUUrMK55O8VKw0lDGdjJ9tYHmG3ehmjpGI74JAEsNmhuIVbkJ7SwECnMGsD27WAd9DOT0mgNzOjAZYh-uvMSWnXdg9Iqh_tH6pNc-9ssvd2n7hQA02-azKO4qRrtKx0KMvcKRGqxs6qRDa9qd2SFD-yV_3y2aiJAZzvuOIiJzSIac6-A4lEwvQ',
    alt: 'Cocktail preparation in dark industrial bar with dry ice vapor in crystal coupe glass',
  },
  {
    id: 2,
    date: 'OCT 21',
    title: 'Industrial Degustation',
    description:
      'A curated 7-course culinary journey inspired by raw industrial elements and rare botanicals.',
    time: 'VIP LOUNGE',
    timeIcon: '🍽️',
    tag: 'DINING',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDyQt6Cr8A_YQeCu9rB_g3rAlg8eYTXwHYBfACraXep5zt6-32Eoz7rnP4w__MYoAFekQVuduS8aBoLFTUecWLwA83wIsD0F1zCbx0DXwhJQD0Qw0ySZSJizG99tABqtCs7rkiV3dB8h-AX0tGSBtMKtpWBVgHqWKSqf48zgbA0IWjUD-0iXfCjEs8AwDRs4mTgFrYyENpfb9izSzC_hnNnP8tqCjYJX_XWfVHO1EjZZYjz7eOcH3VshbxXfhG4IWrqhOugzn5CGHE',
    alt: 'Exclusive tasting menu set on dark charcoal stone table in industrial loft',
  },
  {
    id: 3,
    date: 'OCT 28',
    title: 'Echoes: Digital Art Night',
    description:
      'A sensory immersion combining generative digital art with experimental electronic soundscapes.',
    time: '22:00 - LATE',
    timeIcon: '🎫',
    tag: 'EXHIBITION',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBtLIALh8AfaCbn2IG6TIK4CG3C78jLtLkUXrI0NNm-afGt0U_jML5W4A_KifeTUgb524UhXEtevHjgxko8a0zt-FXmBAb1nFk-NK6bfGVg7P1o_hmkSNnnPto3YvtVKioTGTDYYjC9W0y1egUQU5sKJBdl8dwuMTNCydjT0jlWgAbUji7U0VCtgkdaXGPbPaupTcLu1GabqjwX7KFQdwDKQbrWakY_gpkWSVFKhe_FwkqI3P2FP3XBa3MC95tP2Iel_Yeg0rMnsjs',
    alt: 'Private art gallery with digital art neon glow on polished dark floor during nocturnal exhibition',
  },
] as const;

const ARCHIVES = [
  {
    title: 'Vinyl & Cognac',
    month: 'SEPTEMBER',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD4aLtsQZNIKe4bt9ny41tokhubrryL9ufhaItSy79jiR2doe4ycWGXZYxE_gyzLOXL7cELCtna355cSaxXlVjxcOaCZqLe4lmwwgnTT0UvHL0VuEfhciwsMfvgp3EXjRjV_1ZhxptyX6ohcapEKgNmQZVUqDK9mwnzAc6dicwRvHtZYVejgq-Hgj1X-e28e5ZbAax6uyAUtkYZS2-ZJ5VJmdBBMFxX3WcgbvUiCC7KTjpDaLHNoccr1YIBCMn-gObDgFJ-lxrUvQE',
  },
  {
    title: 'Velvet Cinema Night',
    month: 'SEPTEMBER',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCRwUZrKfKMQBMJ7_27QmlHYjUbgt-a-4kVShwRVD3QZ8EIsV4xBmNNknl6jraXFMF_ml-p11DJjUFeqU4sNBtexaW8yvKzt33S7YUhRiAi_QBC-zjzbcaD_2-lWKQUK-9d3LxyThr3i6S3oQ0o2FNjgyaz75tpVqJqenIXmVRWE4wKnlY0M7hP-YYU6cHnXEGLScM-ffP9IONGT98newMgqvFn1qZrmqzhJ8VScExyf4g8pf4TRK0qAc6HfFzMMmmgOGQgKLWOC2s',
  },
  {
    title: 'Cyber-Lounge Launch',
    month: 'AUGUST',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCS9SO54RS39npGil7TyjXO-nRFBFK1aow6IbtiI6lSE5pNXh9eyUXAzrn3AV7FYiRDeAWbcTbKvErPQnSTHCsG0xmeixmh_u8Sr4j362AjWRlFCd2voHtefnbJVcsswsSFgmrjDlG3hNq84NtpyvMkCtVF6Q5bIxzKmeWJSY6s2AInaV5Qahn7eUxEt5j24bZhkneZs_z5L0UPMEHqZO4bullFoQbEghq1DdozmZ_ZkzUkyUIzVOjhyIPVEg9OgxDJdZZ8n_pGmbI',
  },
] as const;

/* ── Sub-components ──────────────────────────────────────────────────── */

function EventCard({ event }: { event: (typeof EVENTS)[number] }) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className="glass-panel glass-panel-hover rounded-[32px] overflow-hidden flex flex-col group transition-all duration-500"
    >
      {/* Image */}
      <div className="relative h-64 overflow-hidden">
        <div
          className="w-full h-full bg-cover bg-center group-hover:scale-110 transition-transform duration-700"
          style={{ backgroundImage: `url('${event.image}')` }}
          role="img"
          aria-label={event.alt}
        />
        <div className="absolute top-4 left-4 bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] px-3 py-1 rounded-full font-body text-[10px] font-semibold uppercase tracking-widest">
          {event.date}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex-grow flex flex-col">
        <h3 className="font-display text-2xl text-white mb-2 italic">{event.title}</h3>
        <p className="font-body text-sm text-[var(--aura-chrome-mid)] mb-4 flex-grow">
          {event.description}
        </p>
        <div className="mt-auto flex items-center justify-between">
          <span className="flex items-center gap-1 font-body text-[10px] uppercase tracking-widest text-[var(--aura-chrome-dark)]">
            <span className="text-sm">{event.timeIcon}</span>
            {event.time}
          </span>
          <button className="btn-chrome px-4 py-2 rounded-lg font-body text-[10px] uppercase tracking-widest">
            Book Table
          </button>
        </div>
      </div>
    </div>
  );
}

function ArchiveItem({ item }: { item: (typeof ARCHIVES)[number] }) {
  return (
    <div className="flex gap-4 items-center p-4 glass-panel rounded-2xl">
      <div
        className="w-16 h-16 rounded-lg bg-[var(--aura-surface-variant)] flex-shrink-0 bg-cover"
        style={{ backgroundImage: `url('${item.image}')` }}
        role="img"
        aria-label={item.title}
      />
      <div>
        <span className="block font-body text-[9px] uppercase tracking-[0.15em] text-[var(--aura-chrome-dark)]">
          {item.month}
        </span>
        <h4 className="font-display text-lg text-white">{item.title}</h4>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────────── */

export default function EventsPromotions2() {
  const [activeMonth, setActiveMonth] = useState(0);

  return (
    <StitchShell>
      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-5 md:px-16 py-4 bg-white/5 backdrop-blur-xl border-b border-[var(--aura-border-chrome)]/30">
        <span className="font-display text-lg md:text-xl text-[var(--aura-chrome-bright)] tracking-widest uppercase">
          AURA CAFE
        </span>
        <div className="hidden md:flex items-center gap-10">
          <a href="#" className="font-body text-base text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors">
            Menu
          </a>
          <a href="#" className="font-body text-base text-[var(--aura-tertiary)] border-b border-[var(--aura-tertiary)] pb-1">
            Events
          </a>
          <a href="#" className="font-body text-base text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors">
            Reservations
          </a>
          <a href="#" className="font-body text-base text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors">
            Location
          </a>
        </div>
        <button className="bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] px-6 py-2 font-body text-xs font-semibold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all">
          Book Table
        </button>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative min-h-[870px] flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div
            className="w-full h-full bg-cover bg-center transition-transform duration-[10s] scale-110 hover:scale-100"
            style={{
              backgroundImage:
                "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDlmjmyOnjgZOt4V18ClaqGfhQ_r0HMirAh8VM5O_hIQ1sTpZ6oosG3oDxnhFsFugi2q5EerPpl5lfFhl1NSUJJTiW1Q-XbjjbyMy0AUccp-uZBZO0pRf9purCQ7jAci8IPzR-Wkh2N9pmD-AGIgTt2T3O3d5qel--M4Myq4EIDioeuEHRxz6mOhiyiJzIppQlKa7MoXQzCTZVkZznyFTcalEDKgDLqr0rZnZzzDfu8t1vXTQVpYBenN1RVPicJCT3rFq9QShz7W_U')",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-noir-void)] via-[var(--aura-noir-void)]/40 to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 w-full max-w-[1280px] px-5 md:px-16">
          <div className="md:w-7/12 glass-panel p-12 rounded-[32px] border-l-2 border-[var(--aura-tertiary)]/50">
            <span className="font-body text-xs uppercase tracking-[0.3em] text-[var(--aura-tertiary)] mb-3 block">
              Featured Event
            </span>
            <h1 className="font-display text-5xl md:text-7xl leading-tight text-white italic mb-6">
              Midnight Saxophone Sessions
            </h1>
            <p className="font-body text-lg text-[var(--aura-chrome-mid)] mb-8 max-w-xl">
              Experience an evocative evening of smooth jazz and experimental rhythms. Featuring
              world-renowned soloists in our intimate industrial-chic gallery space. Limited
              reservations available for the velvet lounge.
            </p>
            <div className="flex flex-wrap gap-4">
              <button className="bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] px-8 py-4 rounded-lg font-body text-xs font-semibold uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2">
                Reserve a Spot <span className="text-base">📅</span>
              </button>
              <button className="btn-chrome px-8 py-4 rounded-lg font-body text-xs uppercase tracking-widest">
                View Details
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Filter Tabs ─────────────────────────────────────────────── */}
      <section className="py-12 bg-[var(--aura-noir-deep)]">
        <div className="max-w-[1280px] mx-auto px-5 md:px-16">
          <div className="flex items-center justify-between border-b border-[var(--aura-chrome-dark)]/20 pb-4 overflow-x-auto">
            <div className="flex space-x-8 min-w-max">
              {MONTHS.map((m, i) => (
                <button
                  key={m}
                  onClick={() => setActiveMonth(i)}
                  className={`font-body text-xs uppercase tracking-widest relative pb-4 transition-all ${
                    i === activeMonth
                      ? 'text-[var(--aura-tertiary)]'
                      : 'text-[var(--aura-chrome-mid)] hover:text-white'
                  }`}
                >
                  {m}
                  {i === activeMonth && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[var(--aura-tertiary)]" />
                  )}
                </button>
              ))}
            </div>
            <div className="hidden md:flex items-center gap-2 font-body text-[10px] uppercase tracking-widest text-[var(--aura-chrome-mid)]">
              <span className="text-base">⚙️</span>
              Filter by Type
            </div>
          </div>
        </div>
      </section>

      {/* ── Events Grid ─────────────────────────────────────────────── */}
      <section className="py-12">
        <div className="max-w-[1280px] mx-auto px-5 md:px-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {EVENTS.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Past Archives ───────────────────────────────────────────── */}
      <section className="py-20 border-t border-[var(--aura-chrome-dark)]/10">
        <div className="max-w-[1280px] mx-auto px-5 md:px-16">
          <div className="flex items-center gap-6 mb-8">
            <h2 className="font-display text-2xl text-[var(--aura-chrome-dark)]">Past Archives</h2>
            <div className="h-px bg-[var(--aura-chrome-dark)]/30 flex-grow" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
            {ARCHIVES.map((item) => (
              <ArchiveItem key={item.title} item={item} />
            ))}
          </div>
          <div className="mt-8 text-center">
            <button className="font-body text-xs uppercase tracking-widest text-[var(--aura-tertiary)] hover:underline transition-all">
              View Full Archive
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
<PageFooter
  brand="AURA CAFE"
  socialLinks={["IG", "FB", "TT"].map(s => ({ label: s }))}
  socialSize="sm"
  copyLine="© 2024 AURA CAFE. ALL RIGHTS RESERVED."
/>
    </StitchShell>
  );
}
