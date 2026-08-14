import { useEffect, useState } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

interface CardOffer {
  id: number;
  badge: string;
  title: string;
  desc: string;
  image: string;
  tag?: string;
  iconAfter?: string;
  btnLabel?: string;
  isFullWidth?: boolean;
}

const OFFERS: CardOffer[] = [
  {
    id: 1,
    badge: 'Limited Release',
    title: 'The Nocturnal Reserve',
    desc: 'Experience the depth of our signature dark roast. 20% off all signature brews for a limited time.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBXZc7z3nQmqBI7wSM2YrEtK1XTa5i0dvuhUMsh5rfegDYqwjttjsQO9GT17jSAne54AnoItLlzu_Ud88YY3JeZtgF5mnAOtYtcbyd-X3bOZ5rhyYwZvSE5AfUp1egeyWWm7OdELUfAtyxsw3mwr9WLu7MSzU43wlPjirTR7933KNwj9l6',
  },
  {
    id: 2,
    badge: 'ACTIVE',
    title: 'Golden Hour Ritual',
    desc: '2-for-1 on all cold brews during the final hour of service.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBbz03dO05LEHW8M7oOjgzUtUMuj1i6D2gS_stoSDAmOWc9sH6WACJ2JrzKsHIzyRcGZKOHtssAbhshucUIBuCuUU9r7pMKyE7He-K10RAgHSSK0HTlEaUIQAuXRgp6uwrCIV4-FThy2vj8lq8e4V4vbENn5_ywgyxSdEA1NOj4pX6ZvqGyt92CbtI-nfWioIQEmkZvVMN0wU-WyF6rvMWJOeA_-p05SY0znfSB6KhtDAn0Y_cGy1P5q4iUDBHgNfxSdQ-tm7WdOTM',
    iconAfter: '📍',
    tag: 'DAILY 8PM - 9PM',
  },
  {
    id: 3,
    badge: 'EXCLUSIVE',
    title: 'Inner Circle Exclusive',
    desc: '15% off artisanal pastries for our Inner Circle members.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBO9jQXkMZApig7yiTKPXWTtp9c4wtV486LyQu8ryem0dlXjYwvnH__gC5P22OJ7MRJXYh-plld-3gzvdP0uOwJMn1mTq9D1e4AhDQ8ict72nmNEf2mNQB3iLKUUfUPGA_k5FgvXgyAcIbhmrvyMTaslf8YvnGIHJU_nrzPo3mslDSwH0wwrVHdJ1DX0OTp5tAw4m5gnhgAaEWpLowE3J5YRuaDmonae_6rDq2YFHE6t6mBCr3EEDzMh-HC4j28k2jJCuG5I7XYrn8',
    iconAfter: '🔒',
    tag: 'MEMBERS ONLY',
  },
  {
    id: 4,
    badge: '',
    title: 'Weekend Solace',
    desc: 'Receive a complimentary chrome-plated vessel with all bulk bean purchases this weekend only.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA41EThFPJ_vHeqAPS8kNCeuPv3tCQCBjUwACrxNlKGu-ijeLCSgc3r8-UdsK5_uHU7fgTMo6fnPswmcKHVqjagEbKyodeWLeyVxbWNnO7JOSLqrEYyDIw0EZGcr5ahAODc5I6vjb7VyuGiQ4K9xcbZRYV6YaPZZaapXMQ70IuzKVbuqVS1_-alWHI-t6yGNlz7oIxPPu7U3Q01SJjfJHgxDLw7SiOsEMMl6vs9Lxyl112YhnbViCz5eEkTQYmx6Ot1j5fg10yPfh4',
    isFullWidth: true,
    btnLabel: 'Details',
  },
];

export default function PromotionsNew() {
  const [timer, setTimer] = useState(4 * 3600 + 22 * 60 + 15);

  useEffect(() => {
    const id = setInterval(() => {
      setTimer(t => (t > 0 ? t - 1 : 4 * 3600 + 22 * 60 + 15));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const formatTime = (sec: number) => {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <StitchShell>
      {/* TopAppBar */}
<PageHeader brand="AURA CAFE" scrollEffect />

      <main className="pb-32">
        {/* Hero */}
        <section className="px-6 pt-4 pb-6">
          <div className="relative overflow-hidden group">
            <div className="absolute inset-0 z-0">
              <img
                className="w-full h-[420px] object-cover brightness-50 grayscale-[0.2]"
                alt={OFFERS[0]!.desc}
                src={OFFERS[0]!.image}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" aria-hidden="true" />
            </div>
            <div className="relative z-10 pt-[240px]">
              <div className="glass-panel p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-label-caps text-label-caps text-[var(--aura-tertiary)] uppercase tracking-widest">
                    Limited Release
                  </span>
                  <div className="flex items-center gap-1 text-[var(--aura-tertiary)]">
                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                    <span className="font-label-caps text-label-caps">{formatTime(timer)}</span>
                  </div>
                </div>
                <h2 className="font-display-lg-mobile text-display-lg-mobile text-on-background mb-1">
                  {OFFERS[0]!.title}
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-4 max-w-[80%]">
                  {OFFERS[0]!.desc}
                </p>
                <button type="button" className="w-full py-3 bg-[var(--aura-tertiary)] text-primary-container font-label-caps text-label-caps uppercase tracking-[0.2em] transition-all active:scale-95">
                  Claim Offer
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Active Offers Grid */}
        <section className="px-6 space-y-4">
          <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-[0.3em] border-l-2 border-[var(--aura-tertiary)] pl-4">
            Active Rituals
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {OFFERS.slice(1).map(offer => (
              <div key={offer.id} className={`glass-panel overflow-hidden group ${offer.isFullWidth ? 'md:col-span-2' : ''}`}>
                <div className="h-40 relative overflow-hidden">
                  <img
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    alt={offer.desc}
                    src={offer.image}
                  />
                  {offer.badge ? (
                    <div className="absolute top-4 left-4 bg-[var(--aura-tertiary)] text-primary-container px-2 py-1">
                      <span className="font-label-caps text-label-caps uppercase">{offer.badge}</span>
                    </div>
                  ) : null}
                </div>
                <div className="p-4">
                  <h4 className="font-headline-md text-headline-md text-on-background mb-1">{offer.title}</h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mb-3">{offer.desc}</p>
                  <div className="h-[1px] bg-outline-variant/30 w-full mb-3" aria-hidden="true" />
                  <div className="flex justify-between items-center">
                    {offer.tag ? (
                      <span className="font-label-caps text-label-caps text-[var(--aura-tertiary)]">{offer.tag}</span>
                    ) : (
                      <button type="button" className="px-8 py-3 border border-secondary text-secondary font-label-caps text-label-caps uppercase tracking-widest hover:bg-secondary hover:text-primary-container transition-colors">
                        {offer.btnLabel ?? 'Details'}
                      </button>
                    )}
                    {offer.iconAfter && (
                      <span className="material-symbols-outlined text-[var(--aura-tertiary)]">{offer.iconAfter}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Newsletter */}
        <section className="px-6 py-6">
          <div className="glass-panel p-4 relative overflow-hidden">
            <div className="absolute -right-12 -top-12 opacity-5" aria-hidden="true">
              <span className="material-symbols-outlined text-[160px]">electric_bolt</span>
            </div>
            <div className="relative z-10">
              <h3 className="font-display-lg-mobile text-[28px] text-on-background mb-1">Join the Inner Circle</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
                Direct access to private events, rare bean drops, and weekly rituals.
              </p>
              <form className="space-y-3" onSubmit={e => e.preventDefault()}>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="ENCRYPTED EMAIL"
                    className="w-full bg-transparent border-b border-outline-variant focus:border-[var(--aura-tertiary)] focus:ring-0 text-on-background font-label-caps py-2 placeholder:text-outline/50 uppercase"
                  />
                </div>
                <button type="submit" className="w-full py-3 bg-[var(--aura-tertiary)] text-primary-container font-label-caps text-label-caps uppercase tracking-[0.2em]">
                  Authenticate
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Terms */}
<PageFooter
  brand="AURA CAFE"
  socialSize="sm"
  />
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 bg-[var(--aura-surface-container)]/10 backdrop-blur-2xl border-t border-chrome/20 flex justify-around items-center px-6 pb-4 pt-2 rounded-t-full">
        <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant pt-2 hover:bg-white/5 active:scale-95 transition-all">
          <span className="material-symbols-outlined">restaurant_menu</span>
          <span className="font-body-sm text-[10px] uppercase tracking-tighter mt-1">Menu</span>
        </a>
        <a href="#" className="flex flex-col items-center justify-center text-[var(--aura-tertiary)] pt-2 relative">
          <div className="absolute -top-1 w-8 h-[2px] bg-[var(--aura-tertiary)] shadow-[0_0_8px_#D4A574]" />
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
          <span className="font-body-sm text-[10px] uppercase tracking-tighter mt-1">Promotions</span>
        </a>
        <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant pt-2 hover:bg-white/5 active:scale-95 transition-all">
          <span className="material-symbols-outlined">person</span>
          <span className="font-body-sm text-[10px] uppercase tracking-tighter mt-1">Account</span>
        </a>
      </nav>
    </StitchShell>
  );
}
