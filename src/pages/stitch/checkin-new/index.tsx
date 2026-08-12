import { useEffect, useRef, useState } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

const ICON_MENU = '☰';
const ICON_PERSON = '\u{1F464}';
const ICON_QR = '\u{1F4BF}';
const ICON_HISTORY = '\u{1F4D6}';

export default function CheckinNew() {
  const [phone, setPhone] = useState('');
  const [focused, setFocused] = useState(false);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,4})/);
    setPhone(!raw?.[2]
      ? (raw?.[1] || '')
      : `(${raw[1]}) ${raw[2]}${raw[3] ? `-${raw[3]}` : ''}`);
  };

  const handleCheckin = () => {
    void 0;
  };

  useEffect(() => {
    const el = phoneInputRef.current;
    if (!el) return;
    const handler = () => setFocused(el.value.length > 0);
    el.addEventListener('focus', handler);
    el.addEventListener('blur', handler);
    return () => {
      el.removeEventListener('focus', handler);
      el.removeEventListener('blur', handler);
    };
  }, []);

  return (
    <StitchShell>
      {/* Ambient orbs */}
      <div
        className="fixed pointer-events-none overflow-hidden rounded-full animated-pulse-slow"
        style={{
          width: 256,
          height: 256,
          background: 'radial-gradient(circle, rgba(242,192,141,0.05) 0%, transparent 70%)',
          filter: 'blur(100px)',
          top: '-6rem',
          right: '-6rem',
          animationDelay: '0s',
        }}
        aria-hidden="true"
      />
      <div
        className="fixed pointer-events-none overflow-hidden rounded-full animated-pulse-slow"
        style={{
          width: 320,
          height: 320,
          background: 'radial-gradient(circle, rgba(242,192,141,0.05) 0%, transparent 70%)',
          filter: 'blur(100px)',
          top: '50%',
          left: '-8rem',
          animationDelay: '2s',
        }}
        aria-hidden="true"
      />

      {/* Top AppBar */}
<PageHeader brand="AURA CAFE" scrollEffect />

      {/* Main */}
      <main className="pt-24 pb-32 px-5 max-w-md mx-auto">
        {/* Hero Card */}
        <section className="glass-panel rounded-xl p-8 mb-8 relative overflow-hidden">
          <div className="relative z-10">
            <p className="font-label-caps text-label-caps text-[var(--aura-tertiary)] mb-2">LOYALTY PROGRAM</p>
            <h2 className="font-headline-md text-headline-md text-on-surface mb-4">Check-In</h2>
            <p className="font-body-md text-on-surface leading-relaxed">
              Welcome back to Aura. Enter your mobile number to earn{' '}
              <span className="text-[var(--aura-tertiary)] font-bold">Aura Points</span> for your visit today.
            </p>
          </div>
          <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-transparent via-[var(--aura-tertiary)]/20 to-transparent" aria-hidden="true" />
        </section>

        {/* Input Section */}
        <section className="space-y-6 mb-12">
          <div className="space-y-2">
            <label className="font-label-caps text-label-caps text-secondary block ml-1" htmlFor="phone">
              PHONE NUMBER
            </label>
            <div className="relative">
              <input
                ref={phoneInputRef}
                id="phone"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="(000) 000-0000"
                type="tel"
                className={`w-full bg-surface-container-low border-b border-secondary/30 focus:border-[var(--aura-tertiary)] text-on-surface py-4 px-1 font-mono-data text-xl outline-none transition-all placeholder:text-on-surface-variant/30 ${
                  focused ? 'border-[var(--aura-tertiary)]' : ''
                }`}
              />
              <div className="absolute right-0 bottom-4 text-[var(--aura-tertiary)]/40" aria-hidden="true">
                {ICON_QR}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCheckin}
            className="w-full py-5 bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-headline-md text-headline-md rounded-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 bronze-glow"
          >
            Check-In & Earn Points
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </section>

        {/* QR Divider */}
        <div className="flex items-center gap-4 mb-12">
          <div className="h-[1px] flex-1 bg-white/10" />
          <span className="font-label-caps text-label-caps text-secondary/50">OR SCAN CODE</span>
          <div className="h-[1px] flex-1 bg-white/10" />
        </div>

        {/* QR Scanner */}
        <section className="flex flex-col items-center">
          <div className="scan-frame flex items-center justify-center glass-panel rounded-lg overflow-hidden group w-[180px] h-[180px]">
            <span className="absolute inset-0 pointer-events-none" />
            <div className="w-full h-full relative">
              <img
                className="w-full h-full object-cover opacity-60 grayscale group-hover:grayscale-0 transition-all duration-700"
                role="img"
                aria-label="A macro close-up of a technical smartphone screen displaying a complex geometric QR code. The surrounding environment is a dimly lit, high-end industrial cafe with brushed metal surfaces and warm bronze lighting. The focus is sharp on the digital pixels of the code, while the background bokeh shows hints of espresso machines and architectural glass. Deep navy and metallic chrome tones dominate the cinematic composition."
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAUzz6Ndzmf_7DYvRwfw0dyyAdr258WHDlCKJLLtVur7Jc98y6A8oAQC21wLKBwsPauaFdnzKIa59vNDZd6G04BjsXA73U-aklpE6pK0jJ2z-eXD6cilqtdUbSzBwQQgeJTV9DY6RPt5P3ZR6phG_Nhh7MCvToNNE98kPjFUwQmdSEksj8e_64BDymYs1v2b7kXbYC9y40_uD2R0J4a1cDQMHIMooUwxMC74y8YZOp-qSk2pWFDaPDIg723owN6fZMKoOhm9QxQEr4"
              />
              <div className="absolute left-0 w-full h-[2px] bg-[var(--aura-tertiary)] shadow-[0px_0px_10px_#f2c08d]" style={{ animation: 'scan 3s ease-in-out infinite' }} />
            </div>
            <div className="absolute inset-0 bg-[var(--aura-tertiary)]/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-[var(--aura-tertiary)]">{ICON_QR}</span>
            </div>
          </div>
          <p className="mt-6 font-label-caps text-label-caps text-secondary text-center tracking-widest">
            POSITION QR CODE IN FRAME
          </p>
        </section>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-5 py-4 bg-[var(--aura-surface-container)]/90 backdrop-blur-xl border-t border-white/10">
        <a className="flex flex-col items-center justify-center text-on-surface-variant p-3 hover:text-[var(--aura-tertiary)] transition-colors active:scale-90" href="#" aria-label="Home">
          <span className="material-symbols-outlined">home</span>
        </a>
        <a className="flex flex-col items-center justify-center bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] rounded-full p-3 shadow-[0px_0px_12px_rgba(212,165,116,0.4)] active:scale-90" href="#" aria-label="QR Scanner">
          <span className="material-symbols-outlined">{ICON_QR}</span>
        </a>
        <a className="flex flex-col items-center justify-center text-on-surface-variant p-3 hover:text-[var(--aura-tertiary)] transition-colors active:scale-90" href="#" aria-label="History">
          <span className="material-symbols-outlined">{ICON_HISTORY}</span>
        </a>
      </nav>

      <style>{`
        @keyframes scan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.3; }
        }
        .scan-frame {
          position: relative;
          width: 180px;
          height: 180px;
        }
        .scan-frame::before, .scan-frame::after, .scan-frame span::before, .scan-frame span::after {
          content: '';
          position: absolute;
          width: 20px;
          height: 20px;
          border-color: #c6c6c7;
          border-style: solid;
        }
        .scan-frame::before { top: 0; left: 0; border-width: 2px 0 0 2px; }
        .scan-frame::after { top: 0; right: 0; border-width: 2px 2px 0 0; }
        .scan-frame span::before { bottom: 0; left: 0; border-width: 0 0 2px 2px; }
        .scan-frame span::after { bottom: 0; right: 0; border-width: 0 2px 2px 0; }
      `}</style>
    </StitchShell>
  );
}
