import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api-client';
import { saveClientSession, type ClientSessionUser } from '@/lib/client-session';
import { sanitizeInternalRedirect } from '@/lib/safe-redirect';
import { useAuthStore, type AuthUser } from '@/hooks/stores/use-auth-store';

const VerifyEmailPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Pre-fill from URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qEmail = params.get('email');
    const qCode = params.get('code');
    if (qEmail) setEmail(qEmail);
    if (qCode) setCode(qCode);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !code) {
      setError('Vui lòng nhập email và mã xác thực');
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch<{
        success?: boolean;
        token?: string;
        user?: ClientSessionUser;
        error?: string;
        message?: string;
      }>('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });

      if (data.success === false || data.error) {
        setError(data.error || data.message || 'Xác thực thất bại');
        setLoading(false);
        return;
      }

      if (data.token && data.user) {
        saveClientSession(data.token, data.user);
        useAuthStore.setState((state) => ({
          user: data.user as AuthUser,
          loading: false,
          error: null,
          sessionVersion: state.sessionVersion + 1,
        }));
      }

      setSuccess(data.message || 'Xác thực email thành công!');

      const params = new URLSearchParams(window.location.search);
      const safeNext = sanitizeInternalRedirect(params.get('next'), '/account');

      setTimeout(() => {
        window.location.href = safeNext;
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '40px auto', padding: 24, fontFamily: 'var(--aura-font-body)' }}>
      <h1>Xác thực email / Verify Email</h1>
      <p style={{ color: '#666' }}>Nhập mã 6 chữ số đã gửi đến email của bạn</p>

      {success ? (
        <div style={{ padding: 16, background: '#e6f9e6', borderRadius: 8, marginBottom: 16 }}>
          ✅ {success} Đang chuyển hướng...
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: 10, fontSize: 16 }}
          />
          <input
            type="text"
            placeholder="Mã xác thực (6 chữ số)"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            style={{ padding: 10, fontSize: 24, textAlign: 'center', letterSpacing: 4 }}
          />

          {error && <div style={{ color: 'red', fontSize: 14 }}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: 12,
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 16,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Đang xác thực...' : 'Xác thực'}
          </button>
        </form>
      )}
    </div>
  );
};

export default VerifyEmailPage;
