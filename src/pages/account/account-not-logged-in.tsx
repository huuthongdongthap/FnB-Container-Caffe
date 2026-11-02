/**
 * Not-logged-in state for Account page with self-service Customer Phone OTP & Email Login.
 */
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { User, ArrowRight, Phone, Mail, KeyRound } from 'lucide-react';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { saveClientSession } from '@/lib/client-session';
import { apiFetch } from '@/lib/api-client';

interface PhoneAuthResult {
  success?: boolean;
  token?: string;
  customer?: { id: string; name?: string; phone?: string; email?: string };
  error?: string;
}

export function AccountNotLoggedIn() {
  const navigate = useNavigate();
  const { t } = useTranslation('account');
  const loginWithEmail = useAuthStore((s) => s.login);
  const authError = useAuthStore((s) => s.error);
  const authLoading = useAuthStore((s) => s.loading);

  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setLocalError('Vui lòng nhập số điện thoại');
      return;
    }
    setSubmitting(true);
    setLocalError(null);
    try {
      await apiFetch('/api/loyalty/phone-otp/request', {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim() }),
      });
      setOtpSent(true);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Không thể gửi mã OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setLocalError('Vui lòng nhập mã OTP');
      return;
    }
    setSubmitting(true);
    setLocalError(null);
    try {
      const res = await apiFetch<PhoneAuthResult>('/api/loyalty/phone-auth', {
        method: 'POST',
        body: JSON.stringify({
          phone: phone.trim(),
          otp: otp.trim(),
          name: name.trim() || undefined,
        }),
      });
      if (res.token && res.customer) {
        saveClientSession(res.token, {
          id: res.customer.id,
          name: res.customer.name || phone.trim(),
          email: res.customer.email || '',
          phone: res.customer.phone || phone.trim(),
          role: 'customer',
        });
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Xác thực OTP thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      await loginWithEmail(email.trim(), password);
    } catch {
      /* error managed in store */
    }
  };

  const displayedError = localError || authError;

  return (
    <>
      <HelmetHead
        title="Account — AURA CAFE"
        description="Your AURA CAFE account dashboard. Trang tai khoan AURA CAFE."
      />
      <div className="mx-auto max-w-2xl px-[var(--aura-container-padding,24px)] pt-8 pb-24">
        <div
          className="flex flex-col items-center justify-center gap-5 rounded-xl p-8 sm:p-12 text-center"
          style={{
            backgroundColor: 'rgba(30, 41, 59, 0.4)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}
          >
            <User
              className="h-8 w-8"
              style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
            />
          </div>
          <h3
            className="text-2xl font-semibold"
            style={{
              fontFamily: 'var(--aura-font-display)',
              color: 'var(--aura-text-primary, #e8e8e8)',
            }}
          >
            {t('notLoggedIn.title')}
          </h3>
          <p
            className="max-w-xs text-sm"
            style={{
              color: 'var(--aura-text-secondary, #a0a8b0)',
              fontFamily: 'var(--aura-font-body)',
            }}
          >
            {t('notLoggedIn.body')}
          </p>

          <div className="flex gap-2 rounded-lg bg-slate-900/60 p-1 w-full max-w-sm">
            <button
              type="button"
              onClick={() => { setMode('phone'); setLocalError(null); }}
              className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                mode === 'phone' ? 'bg-slate-700 text-white' : 'text-slate-400'
              }`}
            >
              <Phone className="h-3.5 w-3.5" />
              Số điện thoại (OTP)
            </button>
            <button
              type="button"
              onClick={() => { setMode('email'); setLocalError(null); }}
              className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                mode === 'email' ? 'bg-slate-700 text-white' : 'text-slate-400'
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              Email & Mật khẩu
            </button>
          </div>

          {mode === 'phone' ? (
            <form
              onSubmit={otpSent ? handleVerifyOtp : handleRequestOtp}
              className="w-full max-w-sm flex flex-col gap-3 text-left"
            >
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Số điện thoại (VD: 0901234567)"
                disabled={otpSent}
                aria-label="Số điện thoại"
                className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
              />
              {otpSent && (
                <>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Nhập mã OTP 6 số"
                    aria-label="Mã OTP"
                    className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
                  />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tên của bạn (tùy chọn)"
                    aria-label="Tên khách hàng"
                    className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
                  />
                </>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                style={{
                  backgroundColor: 'var(--aura-primary, #c6c6c7)',
                  color: 'var(--aura-on-primary, #1a1a2e)',
                }}
              >
                <KeyRound className="h-4 w-4" />
                {submitting ? 'Đang xử lý...' : otpSent ? 'Xác nhận OTP' : 'Nhận mã OTP'}
              </button>
            </form>
          ) : (
            <form
              onSubmit={handleEmailLogin}
              className="w-full max-w-sm flex flex-col gap-3 text-left"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                aria-label="Email"
                className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                required
                aria-label="Mật khẩu"
                className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                style={{
                  backgroundColor: 'var(--aura-primary, #c6c6c7)',
                  color: 'var(--aura-on-primary, #1a1a2e)',
                }}
              >
                {authLoading ? 'Đang đăng nhập...' : 'Đăng nhập bằng Email'}
              </button>
            </form>
          )}

          {displayedError && (
            <p role="alert" className="text-xs text-rose-400">
              {displayedError}
            </p>
          )}

          <button
            type="button"
            onClick={() => navigate('/menu')}
            className="px-6 py-2.5 rounded-lg font-medium text-xs flex items-center gap-2 transition-all active:scale-95 border border-white/15 text-slate-300 hover:text-white"
            style={{
              fontFamily: 'var(--aura-font-body)',
            }}
          >
            {t('notLoggedIn.cta')}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
