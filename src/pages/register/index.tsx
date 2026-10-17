import React, { useState } from 'react';
import { apiFetch, ApiClientError } from '@/lib/api-client';

interface Props {
  onRegistered?: () => void;
}

const RegisterPage: React.FC<Props> = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Email và mật khẩu là bắt buộc');
      return;
    }

    setLoading(true);
    try {
      await apiFetch<{ success: boolean; data?: unknown }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name, phone }),
      });

      setSuccess('Đăng ký thành công! Vui lòng kiểm tra email để xác thực.');
      setEmail('');
      setPassword('');
      setName('');
      setPhone('');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Lỗi kết nối');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '40px auto', padding: 24, fontFamily: 'var(--aura-font-body)' }}>
      <h1>Đăng ký / Register</h1>
      <p style={{ color: '#666' }}>Tạo tài khoản để bắt đầu dùng thử SaaS</p>

      {success ? (
        <div style={{ padding: 16, background: '#e6f9e6', borderRadius: 8, marginBottom: 16 }}>
          ✅ {success}
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
            type="password"
            placeholder="Mật khẩu (≥8 ký tự)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: 10, fontSize: 16 }}
          />
          <input
            type="text"
            placeholder="Họ tên (tùy chọn)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: 10, fontSize: 16 }}
          />
          <input
            type="tel"
            placeholder="Số điện thoại (tùy chọn)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ padding: 10, fontSize: 16 }}
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
            {loading ? 'Đang đăng ký...' : 'Đăng ký'}
          </button>
        </form>
      )}

      <p style={{ marginTop: 16, fontSize: 14, color: '#666' }}>
        Đã có tài khoản? <a href="/login">Đăng nhập</a>
      </p>
    </div>
  );
};

export default RegisterPage;
