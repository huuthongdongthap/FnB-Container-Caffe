import React, { useState, useEffect } from 'react';

const TenantCreatePage: React.FC = () => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('aura_tenant_id');
    if (stored) setTenantId(stored);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Vui lòng nhập tên workspace');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('aura_jwt');
      if (!token) {
        setError('Vui lòng đăng nhập lại');
        return;
      }

      const res = await fetch('/api/saas/tenants/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: name.trim() })
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'email_not_verified') {
          setError('Vui lòng xác thực email trước khi tạo workspace');
          return;
        }
        setError(data.message || data.error || 'Tạo workspace thất bại');
        return;
      }

      const newTenantId = data.data?.id || data.tenantId;
      if (newTenantId) {
        localStorage.setItem('aura_tenant_id', newTenantId);
        setTenantId(newTenantId);
      }

      // Redirect to onboarding wizard step 1
      setTimeout(() => {
        window.location.href = '/saas/onboard';
      }, 1000);
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  if (tenantId) {
    return (
      <div style={{ maxWidth: 500, margin: '40px auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <h1>🎉 Workspace đã được tạo!</h1>
        <p>Đang chuyển hướng đến onboarding...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Tạo Workspace / Create Workspace</h1>
      <p style={{ color: '#666' }}>Tạo không gian làm việc cho doanh nghiệp của bạn</p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        <input
          type="text"
          placeholder="Tên doanh nghiệp / Business name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: 12, fontSize: 16, border: '1px solid #ddd', borderRadius: 6 }}
        />

        {error && <div style={{ color: 'red', fontSize: 14, padding: 8, background: '#fee', borderRadius: 4 }}>{error}</div>}

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
          {loading ? 'Đang tạo...' : 'Tạo Workspace'}
        </button>
      </form>
    </div>
  );
};

export default TenantCreatePage;
