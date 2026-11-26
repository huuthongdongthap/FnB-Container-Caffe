/**
 * Not-logged-in state for Account page with self-service Customer Phone OTP & Email Login.
 */
import { useState, useEffect, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { User, ArrowRight, Phone, Mail, KeyRound } from 'lucide-react';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { saveClientSession } from '@/lib/client-session';
import { apiFetch } from '@/lib/api-client';

interface OtpRequestResult {
  success?: boolean;
  requiresOtp?: boolean;
  deliveryChannel?: string;
  expiresInSeconds?: number;
  message?: string;
  error?: string;
}

interface PhoneAuthResult {
  success?: boolean;
  token?: string;
  customer?: { id: string; name?: string; phone?: string; email?: string };
  error?: string;
}

interface EmailRegisterResult {
  success?: boolean;
  token?: string;
  user?: { id: string; name: string; email: string; phone?: string; role?: string };
  data?: {
    user?: { id: string; name: string; email: string; phone?: string; role?: string };
    tokens?: { accessToken?: string };
  };
}

export function AccountNotLoggedIn() {
  const navigate = useNavigate();
  const { t } = useTranslation('account');
  const loginWithEmail = useAuthStore((s) => s.login);
  const registerWithEmail = useAuthStore((s) => s.register);
  const authError = useAuthStore((s) => s.error);
  const authLoading = useAuthStore((s) => s.loading);

  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [emailAction, setEmailAction] = useState<'login' | 'register'>('login');
  const [phoneStep, setPhoneStep] = useState<'enter_phone' | 'verify_otp' | 'direct_signup'>('enter_phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [deliveryChannel, setDeliveryChannel] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  const requestOtpWithOptions = async (forceOtp = false) => {
    if (!phone.trim()) {
      setLocalError('Vui lòng nhập số điện thoại');
      return;
    }
    setSubmitting(true);
    setLocalError(null);
    try {
      const res = await apiFetch<OtpRequestResult>('/api/loyalty/phone-otp/request', {
        method: 'POST',
        body: JSON.stringify({
          phone: phone.trim(),
          ...(forceOtp ? { forceOtp: true } : {}),
        }),
      });
      setOtpMessage(res?.message || null);
      setDeliveryChannel(res?.deliveryChannel || null);
      if (res?.requiresOtp === false) {
        setPhoneStep('direct_signup');
      } else {
        setPhoneStep('verify_otp');
        setResendCooldown(60);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Không thể gửi mã OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault();
    await requestOtpWithOptions(false);
  };

  const handleResetPhone = () => {
    setPhoneStep('enter_phone');
    setOtp('');
    setOtpMessage(null);
    setDeliveryChannel(null);
    setResendCooldown(0);
    setLocalError(null);
  };

  const handleDirectPhoneSignup = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setLocalError(null);
    try {
      const res = await apiFetch<PhoneAuthResult>('/api/loyalty/phone-auth', {
        method: 'POST',
        body: JSON.stringify({
          phone: phone.trim(),
          name: name.trim() || 'Thành viên',
          source: 'web_account',
        }),
      });
      if (res.token && res.customer) {
        const sessionUser = {
          id: res.customer.id,
          name: res.customer.name || name.trim() || phone.trim(),
          email: res.customer.email || '',
          phone: res.customer.phone || phone.trim(),
          role: 'customer' as const,
        };
        saveClientSession(res.token, sessionUser);
        useAuthStore.setState?.((state) => ({
          ...state,
          user: sessionUser,
          loading: false,
          error: null,
        }));
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Đăng ký số điện thoại thất bại');
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
        const sessionUser = {
          id: res.customer.id,
          name: res.customer.name || phone.trim(),
          email: res.customer.email || '',
          phone: res.customer.phone || phone.trim(),
          role: 'customer' as const,
        };
        saveClientSession(res.token, sessionUser);
        useAuthStore.setState?.((state) => ({
          ...state,
          user: sessionUser,
          loading: false,
          error: null,
        }));
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Xác thực OTP thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setRegisterSuccess(null);
    if (emailAction === 'login') {
      try {
        await loginWithEmail(email.trim(), password);
      } catch {
        /* error managed in store */
      }
      return;
    }

    if (password.length < 8) {
      setLocalError('Mật khẩu phải từ 8 ký tự trở lên');
      return;
    }

    setSubmitting(true);
    try {
      if (typeof registerWithEmail === 'function') {
        await registerWithEmail(
          regName.trim() || 'Thành viên',
          email.trim(),
          regPhone.trim(),
          password,
        );
      } else {
        const res = await apiFetch<EmailRegisterResult>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            name: regName.trim() || 'Thành viên',
            email: email.trim(),
            phone: regPhone.trim() || undefined,
            password,
          }),
        });
        const token = res?.token || res?.data?.tokens?.accessToken;
        const createdUser = res?.user || res?.data?.user;
        if (token && createdUser) {
          saveClientSession(token, {
            id: createdUser.id,
            name: createdUser.name,
            email: createdUser.email,
            phone: createdUser.phone,
            role: createdUser.role || 'customer',
          });
        } else {
          setRegisterSuccess('Đăng ký thành công! Bạn có thể đăng nhập ngay.');
          setEmailAction('login');
        }
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Đăng ký thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const displayedError = localError || authError;
  const isPhoneLocked = phoneStep !== 'enter_phone';

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
              onSubmit={
                phoneStep === 'verify_otp'
                  ? handleVerifyOtp
                  : phoneStep === 'direct_signup'
                    ? handleDirectPhoneSignup
                    : handleRequestOtp
              }
              className="w-full max-w-sm flex flex-col gap-3 text-left"
            >
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Số điện thoại (VD: 0901234567)"
                disabled={isPhoneLocked}
                aria-label="Số điện thoại"
                className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 disabled:opacity-70"
              />

              {otpMessage && (
                <div
                  data-testid="otp-delivery-guidance"
                  className={`rounded-lg px-3 py-2 text-xs ${
                    deliveryChannel === 'store_counter'
                      ? 'border border-amber-400/30 bg-amber-500/10 text-amber-200'
                      : 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                  }`}
                >
                  {otpMessage}
                </div>
              )}

              {phoneStep === 'direct_signup' && (
                <>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tên của bạn (VD: Nguyễn Văn A)"
                    aria-label="Tên khách hàng"
                    className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
                  />
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <button
                      type="button"
                      onClick={handleResetPhone}
                      className="text-slate-300 hover:text-white underline cursor-pointer"
                    >
                      Đổi số điện thoại
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void requestOtpWithOptions(true)}
                      className="text-amber-300 hover:text-amber-200 underline cursor-pointer disabled:opacity-50"
                    >
                      Nhận OTP xác thực SĐT
                    </button>
                  </div>
                </>
              )}

              {phoneStep === 'verify_otp' && (
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
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <button
                      type="button"
                      onClick={handleResetPhone}
                      className="text-slate-300 hover:text-white underline cursor-pointer"
                    >
                      Đổi số điện thoại
                    </button>
                    <button
                      type="button"
                      disabled={submitting || resendCooldown > 0}
                      onClick={() => void requestOtpWithOptions(true)}
                      className="text-slate-300 hover:text-white underline cursor-pointer disabled:opacity-50 disabled:no-underline"
                    >
                      {resendCooldown > 0 ? `Gửi lại OTP (${resendCooldown}s)` : 'Gửi lại OTP'}
                    </button>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                style={{
                  backgroundColor: 'var(--aura-primary, #c6c6c7)',
                  color: 'var(--aura-on-primary, #1a1a2e)',
                }}
              >
                <KeyRound className="h-4 w-4" />
                {submitting
                  ? 'Đang xử lý...'
                  : phoneStep === 'verify_otp'
                    ? 'Xác nhận OTP'
                    : phoneStep === 'direct_signup'
                      ? 'Đăng ký thành viên ngay'
                      : 'Nhận mã OTP'}
              </button>
            </form>
          ) : (
            <form
              onSubmit={handleEmailSubmit}
              className="w-full max-w-sm flex flex-col gap-3 text-left"
            >
              <div className="flex items-center justify-between text-xs pb-1">
                <div className="inline-flex rounded-md bg-slate-900/80 p-0.5 border border-white/10">
                  <button
                    type="button"
                    onClick={() => { setEmailAction('login'); setLocalError(null); }}
                    className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer ${
                      emailAction === 'login' ? 'bg-slate-700 text-white' : 'text-slate-400'
                    }`}
                  >
                    Đăng nhập
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEmailAction('register'); setLocalError(null); }}
                    className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer ${
                      emailAction === 'register' ? 'bg-slate-700 text-white' : 'text-slate-400'
                    }`}
                  >
                    Đăng ký mới
                  </button>
                </div>
                <a href="/register" className="text-slate-400 hover:text-white underline">
                  Mở trang Đăng ký
                </a>
              </div>

              {registerSuccess && (
                <p role="status" className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 rounded-lg px-3 py-2">
                  {registerSuccess}
                </p>
              )}

              {emailAction === 'register' && (
                <>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Họ và tên"
                    aria-label="Họ và tên đăng ký"
                    className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
                  />
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="Số điện thoại (tự liên kết điểm tích lũy)"
                    aria-label="Số điện thoại đăng ký"
                    className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
                  />
                </>
              )}

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
                placeholder={emailAction === 'register' ? 'Mật khẩu (tối thiểu 8 ký tự)' : 'Mật khẩu'}
                required
                aria-label="Mật khẩu"
                className="w-full rounded-lg bg-slate-900/80 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={authLoading || submitting}
                className="w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                style={{
                  backgroundColor: 'var(--aura-primary, #c6c6c7)',
                  color: 'var(--aura-on-primary, #1a1a2e)',
                }}
              >
                {authLoading || submitting
                  ? 'Đang xử lý...'
                  : emailAction === 'register'
                    ? 'Tạo tài khoản Email'
                    : 'Đăng nhập bằng Email'}
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
