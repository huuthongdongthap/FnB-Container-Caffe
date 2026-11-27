import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { saveClientSession } from '@/lib/client-session';

interface Props {
  onRegistered?: () => void;
}

interface RegisterApiResponse {
  success?: boolean;
  token?: string;
  user?: { id: string; name: string; email: string; phone?: string; role?: string };
  message?: string;
  data?: {
    user?: { id: string; name: string; email: string; phone?: string; role?: string };
    tokens?: { accessToken?: string };
    message?: string;
    verification_required?: boolean;
  };
}

const RegisterPage: React.FC<Props> = ({ onRegistered }) => {
  const [searchParams] = useSearchParams();
  const isSaasMode = searchParams.get('mode') === 'saas';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [hasSession, setHasSession] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Email và mật khẩu là bắt buộc');
      return;
    }

    if (password.length < 8) {
      setError('Mật khẩu phải từ 8 ký tự trở lên');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<RegisterApiResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim() || 'Thành viên AURA',
          phone: phone.trim() || undefined,
        }),
      });

      const token = res?.token || res?.data?.tokens?.accessToken;
      const createdUser = res?.user || res?.data?.user;
      const authenticated = Boolean(token && createdUser);
      if (token && createdUser) {
        saveClientSession(token, {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
          phone: createdUser.phone,
          role: createdUser.role || 'customer',
        });
      }

      setHasSession(authenticated);
      setSuccess(
        authenticated
          ? 'Đăng ký hội viên thành công! Bạn đã sẵn sàng tích điểm & nhận hoàn tiền.'
          : res?.message ||
            res?.data?.message ||
            'Đăng ký thành công! Vui lòng kiểm tra hộp thư để xác thực email trước khi đăng nhập.',
      );
      setEmail('');
      setPassword('');
      setName('');
      setPhone('');
      onRegistered?.();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Lỗi kết nối, vui lòng thử lại');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--aura-noir-deep,#0A1A2E)] text-[var(--aura-chrome-bright,#F5EFE6)] px-4 py-12 font-body">
      <HelmetHead
        title="Đăng Ký Hội Viên — AURA CAFE"
        description="Tạo tài khoản hội viên AURA CAFE để tích điểm, hoàn tiền 3%–10% vào Ví AURA và nhận ưu đãi sinh nhật."
        canonical="/register"
      />
      <div className="max-w-md mx-auto rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-xl p-8 shadow-2xl">
        <h1 className="font-display text-2xl font-bold text-white mb-2">
          {isSaasMode ? 'Đăng ký tài khoản SaaS' : 'Đăng Ký Hội Viên AURA CAFE'}
        </h1>
        <p className="text-sm text-slate-300 mb-6">
          {isSaasMode
            ? 'Tạo tài khoản để bắt đầu dùng thử SaaS'
            : 'Tạo tài khoản miễn phí để tra cứu điểm tích lũy, Ví hoàn tiền 3%–10% và ưu đãi sinh nhật.'}
        </p>

        {success ? (
          <div role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 p-4 text-sm text-emerald-200 space-y-3">
            <p>{success}</p>
            <div className="flex gap-3 pt-1">
              {hasSession ? (
                <>
                  <Link
                    to="/loyalty"
                    className="px-4 py-2 rounded-lg bg-[var(--aura-chrome-bright,#C69C6D)] text-[#0A1A2E] text-xs font-bold"
                  >
                    Xem Ví &amp; Điểm
                  </Link>
                  <Link
                    to="/account"
                    className="px-4 py-2 rounded-lg border border-white/20 text-white text-xs font-semibold"
                  >
                    Vào Tài khoản
                  </Link>
                </>
              ) : (
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-lg bg-[var(--aura-chrome-bright,#C69C6D)] text-[#0A1A2E] text-xs font-bold"
                >
                  Đăng nhập sau khi xác thực
                </Link>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reg-name" className="block text-xs font-semibold text-slate-300 mb-1">
                Họ và tên
              </label>
              <input
                id="reg-name"
                type="text"
                placeholder="Ví dụ: Nguyễn Văn A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg bg-slate-950/70 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
              />
            </div>
            <div>
              <label htmlFor="reg-phone" className="block text-xs font-semibold text-slate-300 mb-1">
                Số điện thoại (tự liên kết lịch sử tích điểm)
              </label>
              <input
                id="reg-phone"
                type="tel"
                placeholder="Ví dụ: 0901234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg bg-slate-950/70 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
              />
            </div>
            <div>
              <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-300 mb-1">
                Email *
              </label>
              <input
                id="reg-email"
                type="email"
                required
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-slate-950/70 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
              />
            </div>
            <div>
              <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-300 mb-1">
                Mật khẩu (tối thiểu 8 ký tự) *
              </label>
              <input
                id="reg-password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-slate-950/70 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
              />
            </div>

            {error && (
              <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[var(--aura-chrome-bright,#F5EFE6)] text-[#0A1A2E] text-sm font-bold transition-opacity hover:opacity-95 disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'Đang đăng ký...' : 'Tạo Tài Khoản Hội Viên'}
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span>
            Đã có tài khoản?{' '}
            <Link to="/account" className="text-white font-semibold hover:underline">
              Đăng nhập
            </Link>
          </span>
          <Link to="/loyalty" className="hover:text-white">
            Xem quyền lợi hạng thẻ →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
