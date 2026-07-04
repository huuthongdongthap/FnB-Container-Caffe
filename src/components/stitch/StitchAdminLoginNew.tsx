/**
 * StitchAdminLoginNew — AURA CAFE Admin Login Terminal
 *
 * Pixel-perfect match of original Stitch HTML export.
 * Glass card with chrome/silver accents, dark navy background,
 * glassmorphism panels, and industrial-luxe branding.
 * Source: /tmp/stitch_original/stitch_aura_cafe/aura_cafe_admin_login/code.html
 *
 * States: idle, loading, error, success (all handled inline — no separate views)
 */
'use client';

import { useState, type FormEvent, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Eye,
  EyeOff,
  Headphones,
  Moon,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────── */
export type LoginStatus = 'idle' | 'loading' | 'error' | 'success';

export interface StitchAdminLoginNewProps {
  /** External login handler. Falls back to simulated delay if omitted. */
  onLogin?: (email: string, password: string) => Promise<void>;
  /** External control of login status (loading, error, etc.). */
  status?: LoginStatus;
  /** Error message shown in the error state. */
  errorMessage?: string;
  /** Brand name displayed in the header and logo. */
  brandName?: string;
}

/* ─── Constants ─────────────────────────────────────────────────────── */
const BRAND = 'AURA CAFE';

/* ─── Main Component ─────────────────────────────────────────────────── */
export function StitchAdminLoginNew({
  onLogin,
  status: externalStatus,
  errorMessage: externalError,
  brandName = BRAND,
}: Readonly<StitchAdminLoginNewProps>) {
  const { t } = useTranslation();
  const [internalStatus, setInternalStatus] = useState<LoginStatus>('idle');
  const [internalError, setInternalError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const status = externalStatus ?? internalStatus;
  const errorMessage = externalError ?? internalError;

  /* ─── Handlers ──────────────────────────────────────────────────── */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setInternalError(t('adminLogin.validationRequired'));
      return;
    }
    setInternalStatus('loading');
    setInternalError('');
    try {
      if (onLogin) {
        await onLogin(email, password);
      } else {
        // Simulate login delay
        await new Promise((r) => setTimeout(r, 1500));
        setInternalStatus('success');
      }
    } catch {
      setInternalStatus('error');
      setInternalError(t('adminLogin.loginFailed'));
    }
  };

  /* ─── 3D Tilt Effect (matching original mousemove) ───────────── */
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 10;
      const y = (e.clientY / window.innerHeight - 0.5) * 10;
      panel.style.transform = `perspective(1000px) rotateX(${-y}deg) rotateY(${x}deg)`;
    };
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  /* ─── Styles ────────────────────────────────────────────────────── */
  const styles = useStyles();

  /* ─── Single Render (all states handled inline — no view replacement) ─── */
  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden font-body-lg text-on-surface selection:bg-primary/30"
      style={{ backgroundColor: '#0A1A2E' }}
      aria-label={t('adminLogin.pageAriaLabel')}
    >
      {/* Ambient Glows */}
      <div className="ambient-glow-login-new -top-48 -left-48" aria-hidden="true" />
      <div className="ambient-glow-login-new -bottom-48 -right-48" aria-hidden="true" />

      {/* Top Nav Shell (Static/Decorative for Login) */}
      <header className="fixed top-0 left-0 w-full flex justify-between items-center px-12 py-6 z-50">
        <div className="font-display-logo text-display-logo text-primary tracking-wider">
          {brandName}
        </div>
        <div className="flex gap-4" aria-hidden="true">
          <Headphones
            className="w-5 h-5 text-primary cursor-pointer transition-all active:scale-95"
            aria-label={t('adminLogin.supportAriaLabel')}
          />
          <Moon
            className="w-5 h-5 text-primary cursor-pointer transition-all active:scale-95"
            aria-label={t('adminLogin.darkModeAriaLabel')}
          />
        </div>
      </header>

      {/* Main Login Container */}
      <main className="relative z-10 w-full max-w-[440px] px-4 md:px-0">
        <div
          ref={panelRef}
          className="glass-panel-login-new chrome-border-login-new rounded-lg p-10 flex flex-col items-center"
        >
          {/* Brand Identity */}
          <div className="text-center mb-10">
            <h1 className="font-display-logo text-display-logo text-primary tracking-[0.3em] mb-1 uppercase">
              {brandName}
            </h1>
            <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">
              {t('adminLogin.adminTerminalAccess')}
            </p>
          </div>

          {/* Login Form */}
          <form className="w-full space-y-6" onSubmit={handleSubmit} noValidate>
            {/* Email Field */}
            <div className="space-y-2">
              <label
                htmlFor="login-email-new"
                className="font-label-caps text-label-caps text-on-surface-variant px-1"
              >
                {t('adminLogin.credentials')}
              </label>
              <div className="relative">
                <input
                  id="login-email-new"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('adminLogin.operatorEmail')}
                  required
                  aria-required="true"
                  aria-label={t('adminLogin.emailAriaLabel')}
                  className="w-full bg-[#050D17] border-0 border-b-[0.5px] border-white/20 text-on-surface px-4 py-4 font-body-sm tracking-widest placeholder:text-outline/40 transition-all focus:border-primary focus:outline-none focus:shadow-input"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label
                  htmlFor="login-password-new"
                  className="font-label-caps text-label-caps text-on-surface-variant"
                >
                  {t('adminLogin.securityKey')}
                </label>
              </div>
              <div className="relative group">
                <input
                  id="login-password-new"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  aria-required="true"
                  aria-label={t('adminLogin.passwordAriaLabel')}
                  className="w-full bg-[#050D17] border-0 border-b-[0.5px] border-white/20 text-on-surface px-4 py-4 font-body-sm tracking-widest placeholder:text-outline/40 transition-all focus:border-primary focus:outline-none focus:shadow-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                  tabIndex={-1}
                  aria-label={
                    showPassword
                      ? t('adminLogin.hidePasswordAriaLabel')
                      : t('adminLogin.showPasswordAriaLabel')
                  }
                >
                  {showPassword ? (
                    <EyeOff className="w-[18px] h-[18px]" aria-hidden="true" />
                  ) : (
                    <Eye className="w-[18px] h-[18px]" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Inline Error Message (only when there is an error — does not replace form) */}
            {errorMessage && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{
                  backgroundColor: 'rgba(255,180,171,0.08)',
                  border: '1px solid rgba(255,180,171,0.15)',
                }}
                role="alert"
              >
                <ShieldAlert className="w-4 h-4 text-[#ffb4ab] shrink-0" aria-hidden="true" />
                <span className="font-body-sm text-[14px] text-[#ffb4ab]">
                  {errorMessage}
                </span>
              </div>
            )}

            {/* Action Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={status === 'loading'}
                className={'w-full chrome-gradient-bg py-4 rounded-lg text-[#0A1A2E] font-headline-md uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-primary/5 flex items-center justify-center gap-2'}
                aria-label={t('adminLogin.submitAriaLabel')}
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    {t('adminLogin.authorizing')}
                  </>
                ) : status === 'success' ? (
                  t('adminLogin.authorized')
                ) : (
                  t('adminLogin.initializeSession')
                )}
              </button>
            </div>
          </form>

          {/* Forgot Password Link */}
          <div className="w-full mt-6 text-center">
            <a
              href="#"
              className="font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors duration-300 uppercase"
              onClick={(e) => e.preventDefault()}
              aria-label={t('adminLogin.forgotPasswordAriaLabel')}
            >
              {t('adminLogin.forgotPassword', 'Quen mat khau?')}
            </a>
          </div>

          {/* Chrome Divider */}
          <div className="w-full chrome-line-login-new my-10" aria-hidden="true" />

          {/* Secondary Actions */}
          <div className="flex flex-col gap-4 w-full text-center">
            <button
              type="button"
              className="font-label-caps text-label-caps text-primary/60 hover:text-primary transition-all tracking-[0.2em] uppercase cursor-pointer"
              aria-label={t('adminLogin.guestAriaLabel')}
            >
              {t('adminLogin.enterAsGuest')}
            </button>
            <button
              type="button"
              className="font-label-caps text-label-caps text-outline hover:text-on-surface transition-all tracking-[0.2em] uppercase cursor-pointer"
              aria-label={t('adminLogin.contactSupportAriaLabel')}
            >
              {t('adminLogin.contactSupport')}
            </button>
          </div>
        </div>
      </main>

      {/* Footer Shell */}
      <footer className="fixed bottom-0 left-0 w-full flex justify-between items-center px-12 py-6 pointer-events-none">
        <div className="font-label-caps text-label-caps text-on-surface-variant">
          {'©'} 2024 {brandName} INDUSTRIAL LUXE
        </div>
        <div className="flex gap-6 pointer-events-auto">
          <a
            href="#"
            className="font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors no-underline"
            onClick={(e) => e.preventDefault()}
            aria-label={t('adminLogin.privacyAriaLabel')}
          >
            {t('adminLogin.privacy')}
          </a>
          <a
            href="#"
            className="font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors no-underline"
            onClick={(e) => e.preventDefault()}
            aria-label={t('adminLogin.termsAriaLabel')}
          >
            {t('adminLogin.terms')}
          </a>
          <a
            href="#"
            className="font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors no-underline"
            onClick={(e) => e.preventDefault()}
            aria-label={t('adminLogin.securityAriaLabel')}
          >
            {t('adminLogin.security')}
          </a>
        </div>
      </footer>

      <style>{styles}</style>
    </div>
  );
}

/* ─── CSS Styles ────────────────────────────────────────────────────── */
function useStyles(): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,600&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');

    /* ─── Glass Panel ───────────────────────────────────────────── */
    .glass-panel-login-new {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
    }

    /* ─── Chrome Border ─────────────────────────────────────────── */
    .chrome-border-login-new {
      border: 1px solid transparent;
      background:
        linear-gradient(#131315, #131315) padding-box,
        linear-gradient(135deg, rgba(255,255,255,0.267) 0%, rgba(255,255,255,0.067) 50%, rgba(255,255,255,0.267) 100%) border-box;
    }

    /* ─── Chrome Gradient Button Background ─────────────────────── */
    .chrome-gradient-bg {
      background: linear-gradient(135deg, #CFD8DC 0%, #90A4AE 50%, #546E7A 100%);
    }
    .chrome-gradient-bg:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      filter: none;
      transform: none;
    }

    /* ─── Chrome Line (Divider) ─────────────────────────────────── */
    .chrome-line-login-new {
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.267) 50%, transparent 100%);
    }

    /* ─── Ambient Glow ──────────────────────────────────────────── */
    .ambient-glow-login-new {
      position: absolute;
      width: 600px;
      height: 600px;
      max-width: 100vw;
      max-height: 100vw;
      background: radial-gradient(circle, rgba(184, 199, 226, 0.05) 0%, transparent 70%);
      z-index: -1;
      pointer-events: none;
    }

    /* ─── Focus Style (matches original input:focus) ──────────── */
    .focus\\:shadow-input:focus {
      outline: none !important;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.4) !important;
    }

    /* ─── Selection Style ───────────────────────────────────────── */
    ::selection {
      background-color: rgba(184, 199, 226, 0.3);
    }

    /* ─── Font Utilities (exact match of original tailwind config) ─── */
    .font-display-logo {
      font-family: 'Cormorant Garamond', serif;
    }
    .text-display-logo {
      font-size: 32px;
      line-height: 1.2;
      letter-spacing: 0.02em;
      font-weight: 600;
    }
    .font-headline-md {
      font-family: 'Space Grotesk', sans-serif;
    }
    .font-label-caps {
      font-family: 'Space Grotesk', sans-serif;
    }
    .text-label-caps {
      font-size: 12px;
      line-height: 1.0;
      letter-spacing: 0.1em;
      font-weight: 600;
    }
    .font-body-sm {
      font-family: 'Space Grotesk', sans-serif;
    }
    .font-body-lg {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 16px;
      line-height: 1.6;
      font-weight: 400;
    }

    /* ─── Color Utilities (exact hex values from original HTML) ────── */
    .text-primary { color: #b8c7e2; }
    .text-primary\\/60 { color: rgba(184, 199, 226, 0.6); }
    .text-on-surface { color: #e4e2e4; }
    .text-on-surface-variant { color: #c5c6cd; }
    .text-outline { color: #8e9097; }
    .border-primary { border-color: #b8c7e2; }
    .shadow-primary\\/5 {
      --tw-shadow-color: rgba(184, 199, 226, 0.05);
      --tw-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
    }
    .selection\\:bg-primary\\/30::selection {
      background-color: rgba(184, 199, 226, 0.3);
    }

    /* ─── Placeholder Color ─────────────────────────────────────── */
    .placeholder\\:text-outline\\/40::placeholder {
      color: rgba(142, 144, 151, 0.4);
    }
  `;
}
