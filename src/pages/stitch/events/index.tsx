import { useState } from 'react';
import { StitchShell } from '../StitchBase';

/* ── Data ─────────────────────────────────────────────────────────────── */

interface EventCard {
  id: string;
  category: string;
  icon: string;
  titleVn: string;
  titleEn: string;
  date: string;
  time: string;
  spots: number;
  price: string;
  descriptionVn: string;
  descriptionEn: string;
  image: string;
  ctaVn: string;
  ctaEn: string;
  ctaStyle: 'solid' | 'outline';
}

const EVENT_CARDS: EventCard[] = [
  {
    id: 'midnight-roast',
    category: 'Workshop',
    icon: '🎪',
    titleVn: 'Hội thảo Rang Đêm',
    titleEn: 'Midnight Roast Workshop',
    date: 'Jul 28',
    time: '7:00 PM',
    spots: 25,
    price: '$45',
    descriptionVn:
      'Khám phá nghệ thuật rang cà phê ban đêm với chuyên gia đầu ngành. Mỗi hạt cà phê có câu chuyện của riêng mình.',
    descriptionEn:
      'Explore the art of after-hours coffee roasting with master roasters. Every bean has its own story to tell.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuB_G8xW5eK_rUqNKtqePhbkH5m_vJrDvmyKSJqFWtxXK-mLvBTDRflKGExMk3N7ZWKsIYnq-Udo6xKIc4p8ijmxmQXbiG1U3_mHXb6L-p7KxksDL78hIqX_0d_eJ0iEc3j20M-hNgJjH92cq2WT3vPzNbB_9tKxCHKXqJZpd3h0cGuw1cb5Mg3-F1x8lQqz5mVP4uENveXSlQPDNomPMz4EVoTfJb63KS0WkAM94U1C5A_9g90TS5GpqVypGgS5GJYwqKk51GO7KI',
    ctaVn: 'Đặt chỗ',
    ctaEn: 'Reserve',
    ctaStyle: 'solid',
  },
  {
    id: 'bronze-tasting',
    category: 'Tasting',
    icon: '🍫',
    titleVn: 'Thử nghiệm Đồng',
    titleEn: 'Bronze Tasting Flight',
    date: 'Aug 3',
    time: '6:30 PM',
    spots: 15,
    price: '$35',
    descriptionVn:
      'Hành trình vị giác qua các loại socola và dessert kết hợp cà phê đặc trưng của AURA.',
    descriptionEn:
      'A sensory journey through artisan chocolates and desserts paired with AURA signature coffee blends.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCC1nb_nUo9P9Eiz_DjUbpDMrOkh0qShE-Pb1l3fZ7NMjeb_PpJFuBOmKE6FVQyK8x3ls2mb4aBnMVyCV9TMrM3zMwhcOC9bYnDPaJoIm2h4ur5bPKhy3z14d9o9pp-YGrKBZJVDoyLPGvl9mNymNh1Rxftr_7-_Xtj6mI5wDveq0wXhwHr492W-Plcpl8jCfmOBhIouXxPne9qKwf1DCJa7kbVzWEpcNISnLfQo0XPDemdtBF90BaBb-I-j0tGEMnItl72a6c9xw',
    ctaVn: 'Đặt chỗ',
    ctaEn: 'Reserve',
    ctaStyle: 'solid',
  },
  {
    id: 'industrial-night',
    category: 'Seasonal',
    icon: '🎵',
    titleVn: 'Đêm Công nghiệp',
    titleEn: 'Industrial Night',
    date: 'Aug 15',
    time: '8:00 PM',
    spots: 100,
    price: 'Free',
    descriptionVn:
      'Đêm nhạc sống trong không gian công nghiệp, ánh sáng đồng ấm áp. Trải nghiệm âm nhạc và cà phê đỉnh cao.',
    descriptionEn:
      'Live music in an industrial venue bathed in warm bronze light. An immersive audio and coffee experience.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDfEHLvxB1M_BDEwW50gq0d5VfKxp1qLd9lHzJZKfJpKJP9pPeBy7lUh8hIVrQen2wrLhFomPBgQa1xBj3fDHcxC6xDRryXMlPU19VFW_6faZ0bbGc4j--wNUPxGjCOUgyr7vFpKMTxsbV8urO0-ZnNznJWZBb3l8ZIauwsJ80IHRCPGpYqF2xf8W5zi6J_phb1mj0MLsURLqd4U9OHyNwgJkQLwnrN-5Si6JKjMgtgGTLGo6tnVhYAsAETQFv7eWcI6UgKljH5kF8',
    ctaVn: 'Đăng ký',
    ctaEn: 'RSVP',
    ctaStyle: 'outline',
  },
];

const FILTER_TABS = [
  { key: 'all', labelEn: 'All', labelVn: 'Tất cả' },
  { key: 'Workshop', labelEn: 'Workshop', labelVn: 'Hội thảo' },
  { key: 'Tasting', labelEn: 'Tasting', labelVn: 'Thử nghiệm' },
  { key: 'Seasonal', labelEn: 'Seasonal', labelVn: 'Theo mùa' },
];

/* ── Component ────────────────────────────────────────────────────────── */

export default function EventsPromotions() {
  const [activeFilter, setActiveFilter] = useState('all');

  const filteredCards =
    activeFilter === 'all'
      ? EVENT_CARDS
      : EVENT_CARDS.filter((card) => card.category === activeFilter);

  return (
    <StitchShell>
      {/* ── Fixed Header ─────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 w-full z-50 bg-[var(--aura-noir-deep)]/80 backdrop-blur-xl border-b border-[var(--aura-border-chrome)]/30">
        <div className="max-w-[1200px] mx-auto px-5 md:px-16 py-4 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Brand */}
          <span className="font-display text-lg md:text-xl text-[var(--aura-chrome-bright)] tracking-widest uppercase">
            AURA CAFE
          </span>

          {/* Filter Tabs */}
          <nav className="flex items-center gap-2 flex-wrap justify-center">
            {FILTER_TABS.map((tab) => {
              const isActive = activeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`
                    px-4 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider
                    transition-all duration-300
                    ${
                      isActive
                        ? 'bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] shadow-[0_0_16px_rgba(212,165,116,0.3)]'
                        : 'bg-transparent border border-[var(--aura-border-chrome)] text-[var(--aura-chrome-mid)] hover:border-[var(--aura-tertiary)] hover:text-[var(--aura-tertiary)]'
                    }
                  `}
                >
                  {tab.labelEn} / {tab.labelVn}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="pt-28 md:pt-24">
        {/* ── Hero Section ────────────────────────────────────────── */}
        <section className="relative py-16 md:py-24 overflow-hidden">
          {/* Ambient bg orbs */}
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-[var(--aura-tertiary)] opacity-[0.04] blur-[100px] pointer-events-none" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-[var(--aura-chrome-dark)] opacity-[0.05] blur-[120px] pointer-events-none" />

          <div className="relative z-10 max-w-[1200px] mx-auto px-5 md:px-16 text-center">
            <span className="font-body text-xs font-medium tracking-[0.3em] uppercase text-[var(--aura-tertiary)] mb-4 block">
              Upcoming / Sắp tới
            </span>
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl text-[var(--aura-chrome-bright)] leading-tight mb-6">
              Events &amp; Promotions
              <br />
              <span className="text-[var(--aura-tertiary)]">
                Sự kiện &amp; Khuyến mãi
              </span>
            </h1>
            <p className="font-body text-base md:text-lg text-[var(--aura-chrome-mid)] max-w-2xl mx-auto leading-relaxed">
              Curated experiences that blend craft, community, and the distinctive
              atmosphere of AURA CAFE &mdash;{' '}
              <span className="text-[var(--aura-chrome-light)]">
                Những trải nghiệm được tuyển chọn kết hợp thủ công, cộng đồng và
                không khí đặc trưng của AURA CAFE.
              </span>
            </p>
          </div>
        </section>

        {/* ── Event Cards Grid ────────────────────────────────────── */}
        <section className="py-8 pb-20">
          <div className="max-w-[1200px] mx-auto px-5 md:px-16">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
              {filteredCards.map((card) => (
                <article
                  key={card.id}
                  className="glass-panel overflow-hidden flex flex-col group"
                >
                  {/* Card Image */}
                  <div className="relative h-56 md:h-64 overflow-hidden">
                    <img
                      src={card.image}
                      alt={`${card.titleEn} — ${card.titleVn}`}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-noir-deep)] via-transparent to-transparent opacity-70" />

                    {/* Category badge */}
                    <span className="absolute top-4 left-4 font-label-caps px-3 py-1 rounded-full bg-[var(--aura-noir-deep)]/70 backdrop-blur-sm border border-[var(--aura-border-chrome)] text-[var(--aura-chrome-light)] uppercase tracking-wider">
                      {card.icon} {card.category}
                    </span>

                    {/* Price badge */}
                    <span className="absolute top-4 right-4 font-body text-sm font-semibold px-3 py-1 rounded-full bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)]">
                      {card.price === 'Free' ? '🎫 Free / Miễn phí' : `$${card.price.replace('$', '')}`}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="flex flex-col flex-1 p-6 md:p-8 gap-3">
                    {/* Title */}
                    <h3 className="font-headline-md text-xl md:text-2xl text-[var(--aura-chrome-bright)] leading-snug">
                      {card.titleVn}
                      <br />
                      <span className="text-[var(--aura-tertiary)]">
                        {card.titleEn}
                      </span>
                    </h3>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="font-body text-[var(--aura-chrome-mid)]">
                        📅 {card.date}
                      </span>
                      <span className="font-body text-[var(--aura-chrome-mid)]">
                        🕖 {card.time}
                      </span>
                    </div>
                    <span className="font-body text-xs text-[var(--aura-chrome-dark)] tracking-wide uppercase">
                      {card.spots} spots / chỗ
                    </span>

                    {/* Description */}
                    <p className="font-body text-sm text-[var(--aura-chrome-mid)] leading-relaxed flex-1">
                      {card.descriptionVn}{' '}
                      <span className="text-[var(--aura-chrome-dark)]">
                        {card.descriptionEn}
                      </span>
                    </p>

                    {/* CTA Button */}
                    <div className="mt-4 pt-4 border-t border-[var(--aura-border-chrome)]/40">
                      {card.ctaStyle === 'solid' ? (
                        <button className="w-full py-3 rounded-full bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-body text-xs font-semibold uppercase tracking-widest hover:opacity-90 active:scale-[0.97] transition-all">
                          {card.ctaVn} / {card.ctaEn}
                        </button>
                      ) : (
                        <button className="w-full py-3 rounded-full border border-[var(--aura-chrome-light)] text-[var(--aura-chrome-light)] font-body text-xs font-semibold uppercase tracking-widest hover:bg-[var(--aura-chrome-light)]/10 active:scale-[0.97] transition-all">
                          {card.ctaVn} / {card.ctaEn}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* Empty state */}
            {filteredCards.length === 0 && (
              <p className="text-center font-body text-[var(--aura-chrome-mid)] py-20">
                Không có sự kiện trong danh mục này / No events in this
                category.
              </p>
            )}
          </div>
        </section>

        {/* ── Special Offer Banner ────────────────────────────────── */}
        <section className="pb-20">
          <div className="max-w-[1200px] mx-auto px-5 md:px-16">
            <div className="glass-panel border-l-4 border-[var(--aura-tertiary)] p-6 md:p-8 flex flex-col md:flex-row items-center gap-4 md:gap-8">
              <span className="text-4xl">🏆</span>
              <div className="flex-1 text-center md:text-left">
                <h3 className="font-headline-md text-lg md:text-xl text-[var(--aura-chrome-bright)]">
                  Member Exclusive / Ưu đãi thành viên
                </h3>
                <p className="font-body text-sm md:text-base text-[var(--aura-chrome-mid)] mt-1">
                  Bring a friend, both get 20% off this Saturday
                  <span className="hidden md:inline">
                    {' '}
                    — Mời bạn bè, cả hai được giảm 20% thứ Bảy này
                  </span>
                </p>
              </div>
              <span className="font-body text-xs font-medium uppercase tracking-widest text-[var(--aura-tertiary)] whitespace-nowrap">
                Limited / Có hạn
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--aura-border-chrome)]/30 bg-[var(--aura-noir-deep)]/50">
        <div className="max-w-[1200px] mx-auto px-5 md:px-16 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <span className="font-display text-base md:text-lg text-[var(--aura-chrome-mid)] tracking-widest uppercase">
            AURA CAFE
          </span>

          {/* Social links */}
          <div className="flex items-center gap-6">
            <a
              href="#"
              className="font-body text-sm text-[var(--aura-chrome-dark)] hover:text-[var(--aura-chrome-bright)] transition-colors"
              aria-label="Instagram"
            >
              📷 IG
            </a>
            <a
              href="#"
              className="font-body text-sm text-[var(--aura-chrome-dark)] hover:text-[var(--aura-chrome-bright)] transition-colors"
              aria-label="Facebook"
            >
              📘 FB
            </a>
            <a
              href="#"
              className="font-body text-sm text-[var(--aura-chrome-dark)] hover:text-[var(--aura-chrome-bright)] transition-colors"
              aria-label="TikTok"
            >
              🎵 TT
            </a>
          </div>

          {/* Copyright */}
          <p className="font-body text-xs text-[var(--aura-chrome-dark)] tracking-wider">
            &copy; 2024 AURA CAFE. All rights reserved.
          </p>
        </div>
      </footer>
    </StitchShell>
  );
}
