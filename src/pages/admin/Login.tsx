'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Headset, Moon, Eye, EyeOff, Loader2 } from 'lucide-react';
import { brandConfig } from '@/config/brand-types';

interface AdminLoginProps {
  onSubmit?: (email: string, password: string) => Promise<void>;
  onSuccess?: () => void;
  error?: string | null;
}

export default function AdminLogin({ onSubmit, onSuccess, error: externalError }: Readonly<AdminLoginProps>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /* ── Mouse parallax tilt effect ── */
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const onMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 10;
      const y = (e.clientY / window.innerHeight - 0.5) * 10;
      panel.style.transform = `perspective(1000px) rotateX(${-y}deg) rotateY(${x}deg)`;
    };

    document.addEventListener('mousemove', onMouseMove);
    return () => document.removeEventListener('mousemove', onMouseMove);
  }, []);

  /* ── Form submission ── */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Vui lòng nhập email và mật khẩu');
      return;
    }

    if (onSubmit) {
      setIsLoading(true);
      try {
        await onSubmit(email, password);
        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const displayError = externalError ?? error;

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background font-body text-foreground selection:bg-accent/30">
      {/* ── Ambient background glow ── */}
      <div
        className="pointer-events-none fixed"
        aria-hidden="true"
        style={{
          width: 600,
          height: 600,
          top: -192,
          left: -192,
          background: 'radial-gradient(circle, rgba(184,199,226,0.05) 0%, transparent 70%)',
          zIndex: 0,
        }}
      />
      <div
        className="pointer-events-none fixed"
        aria-hidden="true"
        style={{
          width: 600,
          height: 600,
          bottom: -192,
          right: -192,
          background: 'radial-gradient(circle, rgba(184,199,226,0.05) 0%, transparent 70%)',
          zIndex: 0,
        }}
      />

      {/* ── Top navigation bar ── */}
      <header className="fixed top-0 left-0 w-full flex justify-between items-center px-12 py-6 z-50">
        <div className="font-display text-3xl text-accent tracking-[0.3em]">{brandConfig.brand.nameShort}</div>
        <div className="flex gap-4">
          <Headset className="text-accent cursor-pointer transition-all active:scale-95" size={24} aria-label="Support" />
          <Moon className="text-accent cursor-pointer transition-all active:scale-95" size={24} aria-label="Toggle theme" />
        </div>
      </header>

      {/* ── Main login panel ── */}
      <main className="relative z-10 w-full max-w-[440px] px-4 md:px-0">
        <div
          ref={panelRef}
          className="flex flex-col items-center p-10"
          role="region"
          aria-label="Admin login form"
          style={{
            background: [
              'linear-gradient(rgba(19,19,21,0.85), rgba(19,19,21,0.85)) padding-box',
              'linear-gradient(135deg, rgba(255,255,255,0.27) 0%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.27) 100%) border-box',
            ].join(', '),
            border: '1px solid transparent',
            borderRadius: 4,
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            transition: 'transform 0.1s ease-out',
          }}
        >
          {/* ── Brand identity ── */}
          <div className="text-center mb-10">
            <h1 className="font-display text-3xl text-accent tracking-[0.3em] mb-1 uppercase">
              {brandConfig.brand.nameShort}
            </h1>
            <p className="text-xs font-semibold text-muted uppercase tracking-widest">
              Admin Terminal Access
            </p>
          </div>

          {/* ── Login form ── */}
          <form onSubmit={handleSubmit} className="w-full space-y-6" noValidate>
            {/* Email field */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-xs font-semibold text-muted uppercase tracking-widest px-1">
                Credentials
              </label>
              <input
                id="email"
                type="email"
                placeholder="OPERATOR ID / EMAIL"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
                className="w-full bg-[#050D17] border-0 border-b-[0.5px] border-white/20 text-foreground px-4 py-4 text-sm tracking-widest placeholder:text-white/30 transition-all focus:border-accent outline-none focus:shadow-[0_0_0_1px_rgba(255,255,255,0.4)]"
                required
                autoComplete="email"
                disabled={isLoading}
              />
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label htmlFor="password" className="text-xs font-semibold text-muted uppercase tracking-widest">
                  Security Key
                </label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
                  className="w-full bg-[#050D17] border-0 border-b-[0.5px] border-white/20 text-foreground px-4 py-4 text-sm tracking-widest placeholder:text-white/30 transition-all focus:border-accent outline-none focus:shadow-[0_0_0_1px_rgba(255,255,255,0.4)] pr-12"
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-accent transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {displayError && (
              <div className="text-sm text-red-400 text-center" role="alert">
                {displayError}
              </div>
            )}

            {/* Submit button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 text-[#0A1A2E] font-semibold text-sm uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all shadow-xl disabled:opacity-70 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #CFD8DC 0%, #90A4AE 50%, #546E7A 100%)',
                  borderRadius: 4,
                }}
              >
                {isLoading ? (
                  <Loader2 className="animate-spin inline-block" size={18} aria-label="Loading" />
                ) : (
                  'Initialize Session'
                )}
              </button>
            </div>
          </form>

          {/* ── Forgot password ── */}
          <div className="w-full mt-6 text-center">
            <a
              href="#"
              className="text-xs font-semibold text-muted hover:text-accent uppercase tracking-widest transition-colors duration-300"
              onClick={(e) => e.preventDefault()}
            >
              Quen mat khau?
            </a>
          </div>

          {/* ── Chrome divider line ── */}
          <div
            className="w-full my-10"
            aria-hidden="true"
            style={{
              height: 1,
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.27) 50%, transparent 100%)',
            }}
          />

          {/* ── Secondary actions ── */}
          <div className="flex flex-col gap-4 w-full text-center">
            <button className="text-xs font-semibold text-accent/60 hover:text-accent uppercase tracking-[0.2em] transition-all">
              Enter as Guest
            </button>
            <button className="text-xs font-semibold text-border hover:text-foreground uppercase tracking-[0.2em] transition-all">
              Contact System Support
            </button>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="fixed bottom-0 left-0 w-full flex justify-between items-center px-12 py-6 pointer-events-none">
        <div className="text-xs font-semibold text-muted uppercase tracking-widest">
          {brandConfig.footer.copyright}
        </div>
        <div className="flex gap-6 pointer-events-auto">
          <a href="#" className="text-xs font-semibold text-muted hover:text-accent uppercase tracking-widest transition-colors" onClick={(e) => e.preventDefault()}>Privacy</a>
          <a href="#" className="text-xs font-semibold text-muted hover:text-accent uppercase tracking-widest transition-colors" onClick={(e) => e.preventDefault()}>Terms</a>
          <a href="#" className="text-xs font-semibold text-muted hover:text-accent uppercase tracking-widest transition-colors" onClick={(e) => e.preventDefault()}>Security</a>
        </div>
      </footer>
    </div>
  );
}
