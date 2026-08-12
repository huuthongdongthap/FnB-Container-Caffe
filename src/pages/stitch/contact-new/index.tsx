import { useEffect, useRef } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

export default function ContactNew() {
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    document.querySelectorAll('input, textarea').forEach(el => {
      const prev = el.previousElementSibling as HTMLElement | null;
      const handleFocus = () => {
        prev && (prev.style.color = '#D4A574');
      };
      const handleBlur = () => {
        const inputEl = el as HTMLInputElement | HTMLTextAreaElement;
        if (!inputEl.value) prev && (prev.style.color = '');
      };
      el.addEventListener('focus', handleFocus);
      el.addEventListener('blur', handleBlur);
      return () => {
        el.removeEventListener('focus', handleFocus);
        el.removeEventListener('blur', handleBlur);
      };
    });
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void 0;
  };

  return (
    <StitchShell>
      {/* Top Navigation */}
<PageHeader brand="AURA CAFE" scrollEffect />

      <main className="pt-16 min-h-screen">
        {/* Hero */}
        <section className="relative h-[353px] md:h-[442px] flex items-center px-6 overflow-hidden">
          <div className="relative z-10 w-full">
            <p className="font-label-caps text-label-caps text-[var(--aura-tertiary)] mb-2">LOCATION &amp; ENQUIRIES</p>
            <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-on-surface uppercase tracking-tighter max-w-xl">
              Connect with <br />
              the Aura
            </h1>
          </div>
          <div
            className="absolute inset-0 pointer-events-none opacity-20 mix-blend-overlay"
            aria-hidden="true"
          >
            <div
              className="w-full h-full bg-cover bg-center"
              role="img"
              aria-label="A macro photograph of brushed dark steel with subtle metallic grains and industrial textures. The lighting is moody and directional, catching the micro-ridges of the metal surface in a deep nocturnal navy palette."
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAFXTs155hge8D4zE7vJmkngZEEj_vs9UbJb7SixusWpzPIrw4p1IMr17yLfQNRrDrDOC2U6GAgU7dfnyttYqtV0VV3OnBdrHPEn9LVoel9dLJZvFC28PMVrGnn2R-qhHt7bOfGpe4ibKuhLH9az0Gxo1xTwlvasKquSy1fRqxj25LLmJFFdx0YL9kQeBbM_LCgnzwFBldFvK7Al_5vkT9uxtts5TXomUvGaUyyA68lq0hdci5hyUIbuX6ExpHgm9ZDtFaV988Jimo')",
              }}
            />
          </div>
        </section>

        {/* Content Grid */}
        <div className="px-6 pb-20 max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Contact Info */}
          <div className="md:col-span-5 glass-panel p-6 flex flex-col gap-6">
            <div>
              <h3 className="font-label-caps text-label-caps text-[var(--aura-tertiary)] mb-2">ADDRESS</h3>
              <p className="font-body-lg text-on-surface">
                39 Nguyễn Tất Thành, Sa Đéc, <br />
                Đồng Tháp, Vietnam
              </p>
            </div>
            <div className="w-full h-px bg-white/10" />
            <div>
              <h3 className="font-label-caps text-label-caps text-[var(--aura-tertiary)] mb-2">DIRECT LINE</h3>
              <p className="font-body-lg text-on-surface">(000) 000-0000</p>
            </div>
            <div className="w-full h-px bg-white/10" />
            <div>
              <h3 className="font-label-caps text-label-caps text-[var(--aura-tertiary)] mb-2">ELECTRONIC MAIL</h3>
              <p className="font-body-lg text-on-surface">contact@auracafe.vn</p>
            </div>
            <div className="mt-auto pt-6 flex gap-4">
              <a href="#" className="w-10 h-10 border border-secondary/20 flex items-center justify-center hover:bg-[var(--aura-tertiary)] hover:text-[var(--aura-noir-deep)] transition-all" aria-label="Share">
                <span className="material-symbols-outlined text-[20px]">share</span>
              </a>
              <a href="#" className="w-10 h-10 border border-secondary/20 flex items-center justify-center hover:bg-[var(--aura-tertiary)] hover:text-[var(--aura-noir-deep)] transition-all" aria-label="Nod">
                <span className="material-symbols-outlined text-[20px]">face_nod</span>
              </a>
              <a href="#" className="w-10 h-10 border border-secondary/20 flex items-center justify-center hover:bg-[var(--aura-tertiary)] hover:text-[var(--aura-noir-deep)] transition-all" aria-label="Camera">
                <span className="material-symbols-outlined text-[20px]">photo_camera</span>
              </a>
            </div>
          </div>

          {/* Form */}
          <div className="md:col-span-7 glass-panel p-6">
            <h2 className="font-headline-md text-headline-md mb-6 text-on-surface">Send a Message</h2>
            <form ref={formRef} className="flex flex-col gap-6" onSubmit={handleSubmit}>
              <div>
                <label className="font-label-caps text-label-caps text-on-surface-variant block mb-1" htmlFor="name">NAME</label>
                <input
                  id="name"
                  className="w-full bg-transparent border-0 border-b border-secondary/30 focus:border-b-[var(--aura-tertiary)] focus:ring-0 text-on-surface py-2 transition-colors"
                  placeholder="John Doe"
                  type="text"
                />
              </div>
              <div>
                <label className="font-label-caps text-label-caps text-on-surface-variant block mb-1" htmlFor="email">EMAIL</label>
                <input
                  id="email"
                  className="w-full bg-transparent border-0 border-b border-secondary/30 focus:border-b-[var(--aura-tertiary)] focus:ring-0 text-on-surface py-2 transition-colors"
                  placeholder="john@example.com"
                  type="email"
                />
              </div>
              <div>
                <label className="font-label-caps text-label-caps text-on-surface-variant block mb-1" htmlFor="message">MESSAGE</label>
                <textarea
                  id="message"
                  className="w-full bg-transparent border-0 border-b border-secondary/30 focus:border-b-[var(--aura-tertiary)] focus:ring-0 text-on-surface py-2 transition-colors resize-none"
                  placeholder="Your enquiry here..."
                  rows={4}
                />
              </div>
              <button
                type="submit"
                className="mt-4 bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] py-4 px-8 font-label-caps text-label-caps tracking-widest hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
              >
                DISPATCH MESSAGE
                <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </button>
            </form>
          </div>

          {/* Map */}
          <div className="md:col-span-12 h-64 md:h-96 relative overflow-hidden glass-panel">
            <div className="absolute top-4 left-4 z-10 bg-[var(--aura-noir-deep)]/80 p-4 border border-[var(--aura-tertiary)]/30 backdrop-blur-md">
              <p className="font-label-caps text-label-caps text-[var(--aura-tertiary)]">LIVE MAP NAVIGATION</p>
              <p className="font-body-sm text-on-surface">Sa Đéc Industrial Park Hub</p>
            </div>
            <div
              className="w-full h-full grayscale contrast-125 brightness-75 transition-all hover:grayscale-0 duration-700"
              role="img"
              aria-label="A sophisticated industrial-styled map interface of Sa Đéc, Vietnam, rendered in a dark nocturnal navy and charcoal palette. The map features high-contrast line work for streets in a metallic chrome finish, with the Aura Cafe location highlighted by a soft bronze glowing pulse."
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuArekfgKcIZ2coS8KnTt30hWty6mPozaUNYOTXOLlu8VafNmk3Vp1cGS7pJst5AVzb2zN8LpH2AwYr6-s7d5j0AWkW64Pkq7UL80MynMT3nBk_oiDhXVE-6wKvxdFRmvdyZbzj19-HsiWc0GJS-LmD4-hX6tULQVd5INxGG2r8MwHwAH2e6WHkANKQnFQCgoHvkhWb2uxow3gB9ocsAndB5r36ruC7jC6ndrojr14roOFcyxAJiNJssBnbcMhwVskGOaakRdsC0AUI')",
              }}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
<PageFooter
  brand="{'©'} 2024 AURA CAFE. ALL RIGHTS RESERVED."
  socialLinks={["IG", "FB", "TT"].map(s => ({ label: s }))}
  socialSize="sm"
  />
    </StitchShell>
  );
}
