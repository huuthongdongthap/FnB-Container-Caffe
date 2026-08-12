import { useState } from 'react';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout';

const MONTHS = ['OCT', 'NOV', 'DEC', 'JAN'] as const;

const EVENT_TYPES = ['All', 'Cocktail', 'Tasting', 'Art'] as const;

const EVENTS = [
  { date: 'OCT 14', title: 'Aura Mixology Masterclass', desc: 'Uncover the secrets behind our signature nocturnal infusions with our lead mixologist. / Khám phá bí mật đồ uống đặc trưng cùng bartender trưởng.', time: '19:00 - 21:00', venue: 'Main Bar', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDArV05s4bg-ehkkouTASvhXigAIWBNNSiyeh-2aXFy9_I0YIX9dby9vcSBVh96T_sg_RZU6yFsm9-siWe_MMgo0JUUrMK55O8VKw0lDGdjJ9tYHmG3ehmjpGI74JAEsNmhuIVbkJ7SwECnMGsD27WAd9DOT0mgNzOjAZYh-uvMSWnXdg9Iqh_tH6pNc-9ssvd2n7hQA02-azKO4qRrtKx0KMvcKRGqxs6qRDa9qd2SFD-yV_3y2aiJAZzvuOIiJzSIac6-A4lEwvQ' },
  { date: 'OCT 21', title: 'Industrial Degustation', desc: 'A curated 7-course culinary journey inspired by raw industrial elements and rare botanicals. / Hành trình 7 món được tuyển chọn lấy cảm hứng từ công nghiệp và thảo mộc quý.', time: 'VIP LOUNGE', venue: 'VIP Lounge', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDyQt6Cr8A_YQeCu9rB_g3rAlg8eYTXwHYBfACraXep5zt6-32Eoz7rnP4w__MYoAFekQVuduS8aBoLFTUecWLwA83wIsD0F1zCbx0DXwhJQD0Qw0ySZSJizG99tABqtCs7rkiV3dB8h-AX0tGSBtMKtpWBVgHqWKSqf48zgbA0IWjUD-0iXfCjEs8AwDRs4mTgFrYyENpfb9izSzC_hnNnP8tqCjYJX_XWfVHO1EjZZYjz7eOcH3VshbxXfhG4IWrqhOugzn5CGHE' },
  { date: 'OCT 28', title: 'Echoes: Digital Art Night', desc: 'A sensory immersion combining generative digital art with experimental electronic soundscapes. / Trải nghiệm nghệ thuật số tạo sinh kết hợp âm thanh điện tử thử nghiệm.', time: '22:00 - LATE', venue: 'Gallery', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBtLIALh8AfaCbn2IG6TIK4CG3C78jLtLkUXrI0NNm-afGt0U_jML5W4A_KifeTUgb524UhXEtevHjgxko8a0zt-FXmBAb1nFk-NK6bfGVg7P1o_hmkSNnnPto3YvtVKioTGTDYYjC9W0y1egUQU5sKJBdl8dwuMTNCydjT0jlWgAbUji7U0VCtgkdaXGPbPaupTcLu1GabqjwX7KFQdwDKQbrWakY_gpkWSVFKhe_FwkqI3P2FP3XBa3MC95tP2Iel_Yeg0rMnsjs' },
] as const;

const PAST_EVENTS = [
  { month: 'SEPTEMBER', title: 'Vinyl & Cognac', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD4aLtsQZNIKe4bt9ny41tokhubrryL9ufhaItSy79jiR2doe4ycWGXZYxE_gyzLOXL7cELCtna355cSaxXlVjxcOaCZqLe4lmwwgnTT0UvHL0VuEfhciwsMfvgp3EXjRjV_1ZhxptyX6ohcapEKgNmQZVUqDK9mwnzAc6dicwRvHtZYVejgq-Hgj1X-e28e5ZbAax6uyAUtkYZS2-ZJ5VJmdBBMFxX3WcgbvUiCC7KTjpDaLHNoccr1YIBCMn-gObDgFJ-lxrUvQE' },
  { month: 'SEPTEMBER', title: 'Velvet Cinema Night', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCRwUZrKfKMQBMJ7_27QmlHYjUbgt-a-4kVShwRVD3QZ8EIsV4xBmNNknl6jraXFMF_ml-p11DJjUFeqU4sNBtexaW8yvKzt33S7YUhRiAi_QBC-zjzbcaD_2-lWKQUK-9d3LxyThr3i6S3oQ0o2FNjgyaz75tpVqJqenIXmVRWE4wKnlY0M7hP-YYU6cHnXEGLScM-ffP9IONGT98newMgqvFn1qZrmqzhJ8VScExyf4g8pf4TRK0qAc6HfFzMMmmgOGQgKLWOC2s' },
  { month: 'AUGUST', title: 'Cyber-Lounge Launch', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCS9SO54RS39npGil7TyjXO-nRFBFK1aow6IbtiI6lSE5pNXh9eyUXAzrn3AV7FYiRDeAWbcTbKvErPQnSTHCsG0xmeixmh_u8Sr4j362AjWRlFCd2voHtefnbJVcsswsSFgmrjDlG3hNq84NtpyvMkCtVF6Q5bIxzKmeWJSY6s2AInaV5Qahn7eUxEt5j24bZhkneZs_z5L0UPMEHqZO4bullFoQbEghq1DdozmZ_ZkzUkyUIzVOjhyIPVEg9OgxDJdZZ8n_pGmbI' },
] as const;

export default function EventsPromotions1() {
  const [activeMonth, setActiveMonth] = useState<typeof MONTHS[number]>('OCT');
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[var(--aura-noir-deep)] text-[var(--aura-chrome-bright)]">
      {/* Top Nav */}
      <header className="fixed top-0 w-full z-50 bg-[var(--aura-surface-container)]/60 backdrop-blur-xl border-b border-white/20 h-14 flex items-center justify-between px-5">
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
            <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuABQ2Zce3zMzjMa_DDShwCkOK9A3EAcp4Kv6p82G9J3N35kyX82uP8Uu7SZ8tAIbLSmnExwx1CBjNwsEwh9V6NHY_y_-VbUmVQFijsaFMV9oalPCOX4L2OK33nNfcgR0QX0GxmMCfkWeNw_4m6HhN40c0r1al2FB5qk_LEP5nAX4s7hXIPH7cVmtbg-QaKLCcQaAwTwzWBuRL6TVKcDYf3_Z4Go0ktKGc8fQDFXXH5rwnQMIkJz1JVBmchdbFJRZQ7fJztNdS6Xw')` }} role="img" aria-label="Cinematic event background of Aura Cafe with warm bronze lighting" />
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
                  <div className="absolute top-4 left-4 bg-[#D4A574] text-[var(--aura-noir-deep)] px-3 py-1 rounded-full font-label-caps text-[10px] font-bold" style={{ boxShadow: '0 0 12px rgba(212,165,116,0.4)' }}>
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