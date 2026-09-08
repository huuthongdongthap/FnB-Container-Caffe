import { useState } from 'react';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout';

const MONTHS = ['OCT', 'NOV', 'DEC', 'JAN'] as const;

const EVENT_TYPES = ['All', 'Cocktail', 'Tasting', 'Art'] as const;

const EVENTS = [
  { date: 'OCT 14', title: 'Aura Mixology Masterclass', desc: 'Uncover the secrets behind our signature nocturnal infusions with our lead mixologist. / Khám phá bí mật đồ uống đặc trưng cùng bartender trưởng.', time: '19:00 - 21:00', venue: 'Main Bar', img: '/photos/IMG_6702.webp' },
  { date: 'OCT 21', title: 'Industrial Degustation', desc: 'A curated 7-course culinary journey inspired by raw industrial elements and rare botanicals. / Hành trình 7 món được tuyển chọn lấy cảm hứng từ công nghiệp và thảo mộc quý.', time: 'VIP LOUNGE', venue: 'VIP Lounge', img: '/photos/IMG_6556-frame.webp' },
  { date: 'OCT 28', title: 'Echoes: Digital Art Night', desc: 'A sensory immersion combining generative digital art with experimental electronic soundscapes. / Trải nghiệm nghệ thuật số tạo sinh kết hợp âm thanh điện tử thử nghiệm.', time: '22:00 - LATE', venue: 'Gallery', img: '/photos/IMG_6699.webp' },
] as const;

const PAST_EVENTS = [
  { month: 'SEPTEMBER', title: 'Vinyl & Cognac', img: '/photos/IMG_6696.webp' },
  { month: 'SEPTEMBER', title: 'Velvet Cinema Night', img: '/photos/IMG_6698.webp' },
  { month: 'AUGUST', title: 'Cyber-Lounge Launch', img: '/photos/IMG_6703.webp' },
] as const;

export default function EventsPromotions1() {
  const [activeMonth, setActiveMonth] = useState<typeof MONTHS[number]>('OCT');
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[var(--aura-noir-deep)] text-[var(--aura-chrome-bright)]">
      {/* Top Nav */}
      <header className="fixed top-0 w-full z-50 bg-[var(--aura-surface-container)]/60 backdrop-blur-[8px] border-b border-white/20 h-14 flex items-center justify-between px-5">
        <div className="font-display text-headline-sm text-[var(--aura-tertiary)] tracking-wider">AURA CAFE</div>
        <nav className="hidden md:flex gap-6">
          {['Menu / Thực đơn', 'Reservations / Đặt bàn', 'Events / Sự kiện', 'Gallery / Thư viện'].map(link => (
            <a key={link} href="#" className="font-label-caps text-label-caps text-[var(--aura-chrome-mid)] hover:text-[var(--aura-tertiary)] transition-colors text-xs uppercase tracking-widest">{link}</a>
          ))}
        </nav>
        <button className="bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] px-4 py-1.5 rounded-full font-headline-sm uppercase tracking-widest text-xs hover:brightness-110 active:scale-95 transition-all">
          Book Table / Đặt bàn
        </button>
      </header>

      <main>
        {/* Hero */}
        <section className="relative h-[70vh] min-h-[500px] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0">
            <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url('/photos/IMG_6556-frame.webp')` }} role="img" aria-label="Cinematic event background of Aura Cafe with warm bronze lighting" />
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--aura-noir-deep)]/70 via-[var(--aura-noir-deep)]/40 to-[var(--aura-noir-deep)]" />
          </div>
          <div className="relative z-10 text-center px-6 max-w-3xl">
            <div className="glass-panel rounded-2xl p-8 md:p-12">
              <span className="font-label-caps text-label-caps text-[var(--aura-tertiary)] uppercase tracking-[0.2em] block mb-4">Featured / Nổi bật</span>
              <h1 className="font-display text-4xl md:text-6xl text-[var(--aura-chrome-bright)] italic mb-4" style={{ fontFamily: 'var(--font-display, "Libre Caslon Text", serif)' }}>
                Midnight Saxophone Sessions
              </h1>
              <p className="font-body text-body text-[var(--aura-chrome-mid)] max-w-xl mx-auto">
                An intimate evening of live jazz saxophone paired with our signature nocturnal cocktails. / Tối nhạc sống saxophone jazz kết hợp cocktail đặc trưng.
              </p>
            </div>
          </div>
        </section>

        {/* Month Filter */}
        <section className="bg-[var(--aura-surface-container-lowest)] border-b border-white/5">
          <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between">
            <div className="flex gap-6 min-w-max">
              {MONTHS.map(m => (
                <button key={m} onClick={() => setActiveMonth(m)} className={`font-label-caps text-label-caps pb-3 relative transition-all ${activeMonth === m ? 'text-[var(--aura-tertiary)]' : 'text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)]'}`}>
                  {m}
                  {activeMonth === m && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[var(--aura-tertiary)]" />}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Events Grid */}
        <section className="py-12 max-w-7xl mx-auto px-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {EVENTS.map((evt, i) => (
              <div key={evt.title} className="glass-panel rounded-xl overflow-hidden flex flex-col group transition-all duration-500 hover:-translate-y-1" onMouseEnter={() => setHoveredCard(i)} onMouseLeave={() => setHoveredCard(null)}>
                <div className="relative h-60 overflow-hidden">
                  <div className="w-full h-full bg-cover bg-center group-hover:scale-110 transition-transform duration-700" style={{ backgroundImage: `url(${evt.img})` }} role="img" aria-label={evt.title} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute top-4 left-4 bg-[var(--aura-primary)] text-[var(--aura-noir-deep)] px-3 py-1 rounded-full font-label-caps text-[10px] font-bold" style={{ boxShadow: '0 0 12px color-mix(in srgb, var(--aura-primary) 40%, transparent)' }}>
                    {evt.date}
                  </div>
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-display text-xl text-[var(--aura-chrome-bright)] mb-2 italic" style={{ fontFamily: 'var(--font-display, "Libre Caslon Text", serif)' }}>{evt.title}</h3>
                  <p className="font-body text-sm text-[var(--aura-chrome-mid)] mb-4 flex-1">{evt.desc}</p>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-wider">🕐 {evt.time} · {evt.venue}</span>
                    <button className="px-4 py-2 rounded-lg bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-label-caps text-[10px] uppercase tracking-widest font-bold hover:brightness-110 active:scale-95 transition-all" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)', transformStyle: 'preserve-3d' }}>Book Table / Đặt</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Past Events */}
        <section className="py-16 border-t border-white/5">
          <div className="max-w-7xl mx-auto px-5">
            <h2 className="font-display text-2xl text-[var(--aura-chrome-mid)] italic mb-8" style={{ fontFamily: 'var(--font-display, "Libre Caslon Text", serif)' }}>
              Past Archives / Lưu trữ
              <span className="block h-px bg-white/10 flex-1 ml-4 mt-2" />
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
              {PAST_EVENTS.map(evt => (
                <div key={evt.title} className="flex gap-4 items-center p-4 glass-panel rounded-lg">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/5 shrink-0 bg-cover" style={{ backgroundImage: `url(${evt.img})` }} role="img" aria-label={evt.title} />
                  <div>
                    <span className="font-label-caps text-[9px] text-[var(--aura-chrome-mid)] uppercase tracking-wider">{evt.month}</span>
                    <h4 className="font-display text-body-md text-[var(--aura-chrome-bright)]" style={{ fontFamily: 'var(--font-display, "Libre Caslon Text", serif)' }}>{evt.title}</h4>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[var(--aura-surface-container-lowest)] py-8">
        <div className="max-w-7xl mx-auto px-5 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="font-display text-headline-md text-[var(--aura-tertiary)]" style={{ fontFamily: 'var(--font-display, serif)' }}>AURA CAFE</div>
          <div className="flex gap-6">
            {['Privacy', 'Terms', 'Contact'].map(link => (
              <a key={link} href="#" className="font-label-caps text-label-caps text-[var(--aura-chrome-mid)] hover:text-[var(--aura-tertiary)] transition-colors text-xs uppercase">{link}</a>
            ))}
          </div>
          <p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] opacity-50">© 2024 AURA CAFE. ALL RIGHTS RESERVED.</p>
        </div>
      </footer>
    </div>
  );
}