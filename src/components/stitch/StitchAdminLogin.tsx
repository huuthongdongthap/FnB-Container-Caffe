/**
 * StitchAdminLogin — AURA CAFE Admin Login Terminal
 *
 * Centered glass card with chrome/silver accents, dark inputs,
 * and industrial-luxe branding. Mobile-first, dark mode default.
 * Source: Stitch AI admin-login export.
 *
 * States: loading, error, idle
 */
'use client';

import { useState, type FormEvent } from 'react';
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

export interface StitchAdminLoginProps {
  onLogin?: (email: string, password: string) => Promise<void>;
  status?: LoginStatus;
  errorMessage?: string;
  brandName?: string;
}

/* ─── Main Component ─────────────────────────────────────────────────── */
export default function StitchAdminLogin({
  onLogin,
  status: externalStatus,
  errorMessage: externalError,
  brandName = 'AURA CAFE',
}: Readonly<StitchAdminLoginProps>) {
  const [internalStatus, setInternalStatus] = useState<LoginStatus>('idle');
  const [internalError, setInternalError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const status = externalStatus ?? internalStatus;
  const errorMessage = externalError ?? internalError;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setInternalError('Vui lòng nhập đầy đủ thông tin');
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
      setInternalError('Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    }
  };

  /* ─── Loading State ─────────────────────────────────────────────── */
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#050D1A' }}>
        <div className="glass-panel-login chrome-border-login p-12 flex flex-col items-center gap-6">
          <Loader2 className="w-10 h-10 animate-spin text-[#c6c6c7]" />
          <p className="font-['Space_Grotesk',sans-serif] text-[13px] text-[#a0a8b0] tracking-widest uppercase">
            Initializing Session...
          </p>
        </div>
        <style>{LOGIN_STYLES}</style>
      </div>
    );
  }

  /* ─── Error State ───────────────────────────────────────────────── */
  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#050D1A' }}>
        <div className="glass-panel-login chrome-border-login p-12 flex flex-col items-center gap-6">
          <AlertCircle className="w-10 h-10 text-[#ffb4ab]" />
          <p className="font-['Space_Grotesk',sans-serif] text-[14px] text-[#ffb4ab] text-center">
            {errorMessage || 'Connection lost. Please verify your credentials.'}
          </p>
          <button
            type="button"
            onClick={() => { setInternalStatus('idle'); setInternalError(''); }}
            className="chrome-gradient-btn px-8 py-3 rounded-lg text-[12px] font-['Space_Grotesk',sans-serif] font-semibold tracking-widest uppercase cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
        <style>{LOGIN_STYLES}</style>
      </div>
    );
  }

  /* ─── Idle / Login Form ─────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: '#050D1A' }}>
      {/* Ambient Glow */}
      <div className="ambient-glow-login -top-48 -left-48" />
      <div className="ambient-glow-login -bottom-48 -right-48" />

      {/* Top Nav */}
      <header className="fixed top-0 left-0 w-full flex justify-between items-center px-6 lg:px-12 py-6 z-50">
        <div className="font-['Cormorant_Garamond',serif] text-[22px] text-[#c6c6c7] tracking-wider">
          {brandName}
        </div>
        <div className="flex gap-4">
          <Headphones className="w-5 h-5 text-[#c6c6c7] opacity-60 hover:opacity-100 transition-all cursor-pointer active:scale-95" />
          <Moon className="w-5 h-5 text-[#c6c6c7] opacity-60 hover:opacity-100 transition-all cursor-pointer active:scale-95" />
        </div>
      </header>

      {/* Login Card */}
      <main className="relative z-10 w-full max-w-[440px] px-4 md:px-0">
        <div className="glass-panel-login chrome-border-login p-8 md:p-10 flex flex-col items-center">
          {/* Brand */}
          <div className="text-center mb-8">
            <h1 className="font-['Cormorant_Garamond',serif] text-[28px] text-[#c6c6c7] tracking-[0.3em] mb-2 uppercase">
              {brandName}
            </h1>
            <p className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] tracking-[0.15em] uppercase">
              Admin Terminal Access
            </p>
          </div>

          {/* Form */}
          <form className="w-full flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="login-email"
                className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] tracking-[0.15em] uppercase px-1"
              >
                Credentials
              </label>
              <div className="relative">
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="OPERATOR ID / EMAIL"
                  required
                  className="w-full bg-[#050D17] border-0 border-b-[0.5px] border-[rgba(255,255,255,0.2)] text-[#e8e8e8] px-4 py-3 font-['Space_Grotesk',sans-serif] text-[13px] tracking-widest placeholder:text-[rgba(142,144,151,0.4)] transition-all focus:border-[#c6c6c7] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center px-1">
                <label
                  htmlFor="login-password"
                  className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] tracking-[0.15em] uppercase"
                >
                  Security Key
                </label>
              </div>
              <div className="relative group">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-[#050D17] border-0 border-b-[0.5px] border-[rgba(255,255,255,0.2)] text-[#e8e8e8] px-4 py-3 font-['Space_Grotesk',sans-serif] text-[13px] tracking-widest placeholder:text-[rgba(142,144,151,0.4)] transition-all focus:border-[#c6c6c7] focus:outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a0a8b0] hover:text-[#c6c6c7] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {internalError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(255,180,171,0.08)] border border-[rgba(255,180,171,0.15)]">
                <ShieldAlert className="w-4 h-4 text-[#ffb4ab]" />
                <span className="font-['Space_Grotesk',sans-serif] text-[12px] text-[#ffb4ab]">{internalError}</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={internalStatus === 'loading'}
                className={clsx(
                  'w-full chrome-gradient-btn py-3 rounded-lg text-[13px] font-[\'Space_Grotesk\',sans-serif] font-semibold uppercase tracking-widest transition-all flex items-center justify-center gap-2',
                  'shadow-xl shadow-[rgba(198,198,199,0.08)]'
                )}
              >
                {internalStatus === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Authorizing...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Initialize Session
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Links */}
          <div className="w-full mt-6 text-center">
            <a
              href="#"
              className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] hover:text-[#c6c6c7] transition-colors duration-300 uppercase tracking-[0.15em]"
              onClick={(e) => e.preventDefault()}
            >
              Quen mat khau?
            </a>
          </div>

          {/* Divider */}
          <div className="w-full my-8 chrome-line-login" />

          {/* Secondary Actions */}
          <div className="flex flex-col gap-4 w-full text-center">
            <button
              type="button"
              className="font-['Space_Grotesk',sans-serif] text-[11px] text-[rgba(198,198,199,0.5)] hover:text-[#c6c6c7] transition-all tracking-[0.2em] uppercase"
            >
              Enter as Guest
            </button>
            <button
              type="button"
              className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#8e9097] hover:text-[#e8e8e8] transition-all tracking-[0.2em] uppercase"
            >
              Contact System Support
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 w-full flex justify-between items-center px-6 lg:px-12 py-6 pointer-events-none">
        <div className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] tracking-wider">
          &copy; 2024 {brandName} INDUSTRIAL LUXE
        </div>
        <div className="flex gap-6 pointer-events-auto">
          <a href="#" className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] hover:text-[#c6c6c7] transition-colors no-underline" onClick={(e) => e.preventDefault()}>Privacy</a>
          <a href="#" className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] hover:text-[#c6c6c7] transition-colors no-underline" onClick={(e) => e.preventDefault()}>Terms</a>
          <a href="#" className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] hover:text-[#c6c6c7] transition-colors no-underline" onClick={(e) => e.preventDefault()}>Security</a>
        </div>
      </footer>

      <style>{LOGIN_STYLES}</style>
    </div>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────── */
const LOGIN_STYLES = `
  .glass-panel-login {
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-radius: 8px;
  }
  .chrome-border-login {
    border: 1px solid transparent;
    background:
      linear-gradient(#0d1b2a, #0d1b2a) padding-box,
      linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.25) 100%) border-box;
  }
  .chrome-gradient-btn {
    background: linear-gradient(135deg, #c6c6c7 0%, #a0a8b0 50%, #8e9097 100%);
    color: #0A1A2E;
  }
  .chrome-gradient-btn:hover {
    filter: brightness(1.1);
  }
  .chrome-gradient-btn:active {
    transform: scale(0.98);
  }
  .chrome-line-login {
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%);
  }
  .ambient-glow-login {
    position: absolute;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(198, 198, 199, 0.04) 0%, transparent 70%);
    z-index: -1;
    pointer-events: none;
  }
  input:focus {
    outline: none !important;
    box-shadow: 0 0 0 1px rgba(198, 198, 199, 0.4);
  }
`;
