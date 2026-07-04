/**
 * StitchAdminLoginNew — AURA CAFE Admin Login Terminal
 *
 * Refined glass card with chrome/silver accents, dark navy background,
 * glassmorphism panels, and industrial-luxe branding. Mobile-first, dark mode default.
 * Source: Stitch AI admin-login export (converted to TSX + Tailwind).
 *
 * States: idle, loading, error, success
 */
'use client';

import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  Eye,
  EyeOff,
  Headphones,
  Moon,
  Loader2,
  ShieldAlert,
  LogIn,
  AlertCircle,
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

  /* ─── Styles String ─────────────────────────────────────────────── */
  const styles = useStyles();

  /* ─── Loading State ─────────────────────────────────────────────── */
  if (status === 'loading') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#0A1A2E' }}
        role="status"
        aria-live="polite"
        aria-label={t('adminLogin.loadingAriaLabel')}
      >
        <div className="glass-panel-login-new chrome-border-login-new p-12 flex flex-col items-center gap-6">
          <Loader2 className="w-10 h-10 animate-spin text-[#c6c6c7]" aria-hidden="true" />
          <p className="font-['Space_Grotesk',sans-serif] text-[12px] text-[#a0a8b0] tracking-[0.2em] uppercase">
            {t('adminLogin.authorizing')}
          </p>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  /* ─── Error State ───────────────────────────────────────────────── */
  if (status === 'error') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#0A1A2E' }}
        role="alert"
        aria-live="assertive"
      >
        <div className="glass-panel-login-new chrome-border-login-new p-12 flex flex-col items-center gap-6">
          <AlertCircle className="w-10 h-10 text-[#ffb4ab]" aria-hidden="true" />
          <p className="font-['Space_Grotesk',sans-serif] text-[14px] text-[#ffb4ab] text-center">
            {errorMessage || t('adminLogin.connectionLost')}
          </p>
          <button
            type="button"
            onClick={() => {
              setInternalStatus('idle');
              setInternalError('');
            }}
            className="chrome-gradient-btn-new px-8 py-3 rounded-lg text-[12px] font-['Space_Grotesk',sans-serif] font-semibold tracking-[0.2em] uppercase cursor-pointer"
            aria-label={t('adminLogin.retryAriaLabel')}
          >
            {t('adminLogin.retryConnection')}
          </button>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  /* ─── Idle / Login Form ─────────────────────────────────────────── */
  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: '#0A1A2E' }}
      aria-label={t('adminLogin.pageAriaLabel')}
    >
      {/* Ambient Glows */}
      <div className="ambient-glow-login-new -top-48 -left-48" aria-hidden="true" />
      <div className="ambient-glow-login-new -bottom-48 -right-48" aria-hidden="true" />

      {/* Top Navigation Bar (static/decorative for login) */}
      <header className="fixed top-0 left-0 w-full flex justify-between items-center px-5 md:px-12 py-6 z-50 select-none">
        <div
          className="font-['Cormorant_Garamond',serif] text-[clamp(1.25rem,4vw,1.75rem)] text-[#c6c6c7] tracking-[0.15em] uppercase"
          aria-hidden="true"
        >
          {brandName}
        </div>
        <div className="flex gap-4">
          <Headphones
            className="w-5 h-5 text-[#c6c6c7] opacity-50 hover:opacity-100 transition-all cursor-pointer active:scale-95"
            aria-label={t('adminLogin.supportAriaLabel')}
          />
          <Moon
            className="w-5 h-5 text-[#c6c6c7] opacity-50 hover:opacity-100 transition-all cursor-pointer active:scale-95"
            aria-label={t('adminLogin.darkModeAriaLabel')}
          />
        </div>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 w-full max-w-[440px] px-4 md:px-0">
        <div className="glass-panel-login-new chrome-border-login-new p-8 md:p-10 flex flex-col items-center">
          {/* Brand Identity */}
          <div className="text-center mb-8">
            <h1 className="font-['Cormorant_Garamond',serif] text-[clamp(1.5rem,5vw,1.875rem)] text-[#c6c6c7] tracking-[0.3em] mb-2 uppercase">
              {brandName}
            </h1>
            <p className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] tracking-[0.18em] uppercase">
              {t('adminLogin.adminTerminalAccess')}
            </p>
          </div>

          {/* Login Form */}
          <form className="w-full flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
            {/* Email / Credentials Field */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="login-email-new"
                className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] tracking-[0.18em] uppercase px-1"
              >
                {t('adminLogin.credentials')}
              </label>
              <input
                id="login-email-new"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('adminLogin.operatorEmail')}
                required
                aria-required="true"
                aria-label={t('adminLogin.emailAriaLabel')}
                className="w-full bg-[#050D17] border-0 border-b-[0.5px] border-white/20 text-[#e8e8e8] px-4 py-3 font-['Space_Grotesk',sans-serif] text-[13px] tracking-widest placeholder:text-[rgba(142,144,151,0.4)] transition-all focus:border-[#c6c6c7] focus:outline-none"
              />
            </div>

            {/* Password / Security Key Field */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center px-1">
                <label
                  htmlFor="login-password-new"
                  className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] tracking-[0.18em] uppercase"
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
                  className="w-full bg-[#050D17] border-0 border-b-[0.5px] border-white/20 text-[#e8e8e8] px-4 py-3 font-['Space_Grotesk',sans-serif] text-[13px] tracking-widest placeholder:text-[rgba(142,144,151,0.4)] transition-all focus:border-[#c6c6c7] focus:outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a0a8b0] hover:text-[#c6c6c7] transition-colors"
                  tabIndex={-1}
                  aria-label={
                    showPassword
                      ? t('adminLogin.hidePasswordAriaLabel')
                      : t('adminLogin.showPasswordAriaLabel')
                  }
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message Inline */}
            {internalError && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{
                  backgroundColor: 'rgba(255,180,171,0.08)',
                  border: '1px solid rgba(255,180,171,0.15)',
                }}
                role="alert"
              >
                <ShieldAlert className="w-4 h-4 text-[#ffb4ab] shrink-0" aria-hidden="true" />
                <span className="font-['Space_Grotesk',sans-serif] text-[12px] text-[#ffb4ab]">
                  {internalError}
                </span>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={internalStatus === 'loading'}
                className={clsx(
                  'w-full chrome-gradient-btn-new py-3 rounded-lg text-[13px] font-[\'Space_Grotesk\',sans-serif] font-semibold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2',
                  'shadow-xl shadow-[rgba(198,198,199,0.08)]'
                )}
                aria-label={t('adminLogin.submitAriaLabel')}
              >
                {internalStatus === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    {t('adminLogin.authorizing')}
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" aria-hidden="true" />
                    {t('adminLogin.initializeSession')}
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Forgot Password Link */}
          <div className="w-full mt-6 text-center">
            <a
              href="#"
              className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] hover:text-[#c6c6c7] transition-colors duration-300 uppercase tracking-[0.18em] no-underline"
              onClick={(e) => e.preventDefault()}
              aria-label={t('adminLogin.forgotPasswordAriaLabel')}
            >
              {t('adminLogin.forgotPassword')}
            </a>
          </div>

          {/* Chrome Divider */}
          <div className="chrome-line-login-new my-8" aria-hidden="true" />

          {/* Secondary Actions */}
          <div className="flex flex-col gap-4 w-full text-center">
            <button
              type="button"
              className="font-['Space_Grotesk',sans-serif] text-[11px] text-[rgba(198,198,199,0.45)] hover:text-[#c6c6c7] transition-all tracking-[0.2em] uppercase cursor-pointer"
              aria-label={t('adminLogin.guestAriaLabel')}
            >
              {t('adminLogin.enterAsGuest')}
            </button>
            <button
              type="button"
              className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#8e9097] hover:text-[#e8e8e8] transition-all tracking-[0.2em] uppercase cursor-pointer"
              aria-label={t('adminLogin.contactSupportAriaLabel')}
            >
              {t('adminLogin.contactSupport')}
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 w-full flex flex-col md:flex-row justify-between items-center px-5 md:px-12 py-6 pointer-events-none gap-2 md:gap-0">
        <div className="font-['Space_Grotesk',sans-serif] text-[10px] text-[#a0a8b0] tracking-[0.12em] order-2 md:order-1">
          {'©'} 2024 {brandName} INDUSTRIAL LUXE
        </div>
        <div className="flex gap-6 pointer-events-auto order-1 md:order-2">
          <a
            href="#"
            className="font-['Space_Grotesk',sans-serif] text-[10px] text-[#a0a8b0] hover:text-[#c6c6c7] transition-colors no-underline tracking-[0.1em]"
            onClick={(e) => e.preventDefault()}
            aria-label={t('adminLogin.privacyAriaLabel')}
          >
            {t('adminLogin.privacy')}
          </a>
          <a
            href="#"
            className="font-['Space_Grotesk',sans-serif] text-[10px] text-[#a0a8b0] hover:text-[#c6c6c7] transition-colors no-underline tracking-[0.1em]"
            onClick={(e) => e.preventDefault()}
            aria-label={t('adminLogin.termsAriaLabel')}
          >
            {t('adminLogin.terms')}
          </a>
          <a
            href="#"
            className="font-['Space_Grotesk',sans-serif] text-[10px] text-[#a0a8b0] hover:text-[#c6c6c7] transition-colors no-underline tracking-[0.1em]"
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

/* ─── Styles ────────────────────────────────────────────────────────── */
function useStyles(): string {
  return `
    .glass-panel-login-new {
      background: rgba(255, 255, 255, 0.04);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border-radius: 8px;
    }
    .chrome-border-login-new {
      border: 1px solid transparent;
      background:
        linear-gradient(#0d1b2a, #0d1b2a) padding-box,
        linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.25) 100%) border-box;
    }
    .chrome-gradient-btn-new {
      background: linear-gradient(135deg, #c6c6c7 0%, #a0a8b0 50%, #8e9097 100%);
      color: #0A1A2E;
    }
    .chrome-gradient-btn-new:hover {
      filter: brightness(1.1);
    }
    .chrome-gradient-btn-new:active {
      transform: scale(0.98);
    }
    .chrome-gradient-btn-new:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      filter: none;
      transform: none;
    }
    .chrome-line-login-new {
      height: 1px;
      width: 100%;
      background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%);
    }
    .ambient-glow-login-new {
      position: absolute;
      width: 600px;
      height: 600px;
      max-width: 100vw;
      max-height: 100vw;
      background: radial-gradient(circle, rgba(198, 198, 199, 0.04) 0%, transparent 70%);
      z-index: -1;
      pointer-events: none;
    }
    input:focus {
      outline: none !important;
      box-shadow: 0 0 0 1px rgba(198, 198, 199, 0.4);
    }
  `;
}
