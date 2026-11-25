import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type ResetStep = 'request' | 'confirm' | 'done';

const ForgotPasswordPage: React.FC = () => {
  const [step, setStep] = useState<ResetStep>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qEmail = params.get('email');
    const qCode = params.get('code') || params.get('token');
    if (qEmail) setEmail(qEmail);
    if (qCode) {
      setCode(qCode);
      setStep('confirm');
    } else if (window.location.pathname === '/reset-password') {
      setStep('confirm');
    }
  }, []);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Vui lòng nhập địa chỉ email');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<{ success?: boolean; error?: string; message?: string }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email: normalizedEmail }),
        }
      );

      if (res.success === false || res.error) {
        setError(res.error || res.message || 'Không thể gửi mã đặt lại mật khẩu');
        return;
      }

      setMessage('Nếu email tồn tại trong hệ thống, mã đặt lại mật khẩu 6 số đã được gửi (hiệu lực 15 phút).');
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim();
    if (!normalizedEmail || !trimmedCode) {
      setError('Vui lòng nhập email và mã xác thực');
      return;
    }
    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<{ success?: boolean; error?: string; message?: string }>(
        '/api/auth/reset-password',
        {
          method: 'POST',
          body: JSON.stringify({
            email: normalizedEmail,
            code: trimmedCode,
            newPassword,
          }),
        }
      );

      if (res.success === false || res.error) {
        setError(res.error || res.message || 'Đặt lại mật khẩu thất bại');
        return;
      }

      setMessage('Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.');
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đặt lại mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 font-body">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-lg">
        <h1 className="text-2xl font-display font-bold text-foreground">
          {step === 'request'
            ? 'Quên mật khẩu / Forgot Password'
            : 'Đặt lại mật khẩu / Reset Password'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {step === 'request'
            ? 'Nhập email tài khoản để nhận mã xác thực 6 số.'
            : 'Nhập mã xác thực từ email và mật khẩu mới của bạn.'}
        </p>

        {message && (
          <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            {message}
          </div>
        )}

        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {step === 'request' && (
          <form onSubmit={handleRequestCode} className="mt-6 space-y-4">
            <div>
              <label htmlFor="forgot-email" className="mb-1 block text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ban@domain.vn"
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Đang gửi...' : 'Gửi mã xác thực'}
            </button>
            <div className="flex items-center justify-between pt-2 text-xs text-muted">
              <button
                type="button"
                onClick={() => setStep('confirm')}
                className="underline hover:text-foreground"
              >
                Đã có mã xác thực?
              </button>
              <a href="/admin/login" className="underline hover:text-foreground">
                Quay lại đăng nhập
              </a>
            </div>
          </form>
        )}

        {step === 'confirm' && (
          <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
            <div>
              <label htmlFor="reset-email" className="mb-1 block text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="reset-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ban@domain.vn"
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label htmlFor="reset-code" className="mb-1 block text-sm font-medium text-foreground">
                Mã xác thực (6 chữ số)
              </label>
              <input
                id="reset-code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.trim())}
                placeholder="123456"
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-center font-mono text-lg tracking-widest text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label htmlFor="reset-new-password" className="mb-1 block text-sm font-medium text-foreground">
                Mật khẩu mới
              </label>
              <input
                id="reset-new-password"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự"
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label htmlFor="reset-confirm-password" className="mb-1 block text-sm font-medium text-foreground">
                Xác nhận mật khẩu mới
              </label>
              <input
                id="reset-confirm-password"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
            </button>
            <div className="flex items-center justify-between pt-2 text-xs text-muted">
              <button
                type="button"
                onClick={() => setStep('request')}
                className="underline hover:text-foreground"
              >
                Gửi lại mã mới
              </button>
              <a href="/admin/login" className="underline hover:text-foreground">
                Quay lại đăng nhập
              </a>
            </div>
          </form>
        )}

        {step === 'done' && (
          <div className="mt-6 space-y-3">
            <a
              href="/admin/login"
              className="flex h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:opacity-90"
            >
              Đăng nhập Quản trị (/admin/login)
            </a>
            <a
              href="/login"
              className="flex h-11 w-full items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted/20"
            >
              Đăng nhập Khách hàng (/login)
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
