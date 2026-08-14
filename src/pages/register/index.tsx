import React, { useState } from 'react';

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
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, phone })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || data.error || 'Đăng ký thất bại');
        return;
      }

      setSuccess('Đăng ký thành công! Vui lòng kiểm tra email để xác thực.');
      setEmail('');
      setPassword('');
      setName('');
      setPhone('');
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '40px auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
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
