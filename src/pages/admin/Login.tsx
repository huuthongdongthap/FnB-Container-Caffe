import { useState } from 'react';
import { Button } from '@/components/ui/button';

const MOCK_CREDENTIALS = {
  username: 'admin',
  password: 'aura@2024',
};

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return sessionStorage.getItem('admin_authenticated') === 'true';
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username || !password) {
      setError('Vui lòng nhập email và mật khẩu');
      return;
    }

    setIsLoading(true);

    try {
      // In production, this would call the API
      await new Promise((r) => setTimeout(r, 800));

      if (username === MOCK_CREDENTIALS.username && password === MOCK_CREDENTIALS.password) {
        sessionStorage.setItem('admin_authenticated', 'true');
        setIsLoggedIn(true);
      } else {
        setError('Email hoặc mật khẩu không đúng');
      }
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0A1A2E] via-[#050D1A] to-[#0A1A2E] p-6">
        <div className="glass-card w-full max-w-sm p-8 text-center">
          <div className="mb-4 text-4xl">&#9989;</div>
          <h2 className="mb-2 font-display text-xl font-bold text-chrome-bright">
            Đã đăng nhập
          </h2>
          <p className="mb-6 text-sm text-chrome-light/60">
            Chào mừng bạn quay lại!
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => { window.location.href = '/admin/dashboard'; }}>
              Vào Dashboard
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                sessionStorage.removeItem('admin_authenticated');
                setIsLoggedIn(false);
              }}
            >
              Đăng xuất
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#0A1A2E] via-[#050D1A] to-[#0A1A2E] p-4">
      {/* Ambient background orbs — matching home page aesthetic */}
      <div
        className="pointer-events-none absolute animate-float rounded-full"
        style={{ width: 500, height: 500, top: '-10%', left: '-5%', background: 'rgba(107,159,184,0.10)' }}
      />
      <div
        className="pointer-events-none absolute animate-float-delayed rounded-full"
        style={{ width: 400, height: 400, bottom: '-8%', right: '-5%', background: 'rgba(58,107,128,0.10)' }}
      />
      <div
        className="pointer-events-none absolute animate-float rounded-full"
        style={{ width: 300, height: 300, top: '40%', left: '50%', background: 'rgba(107,159,184,0.08)' }}
      />

      {/* Login card — glassmorphism */}
      <div className="glass-card relative z-10 w-full max-w-sm p-8">
        {/* Logo section */}
        <div className="mb-8 text-center">
          <div className="mb-3 text-4xl">☕</div>
          <h1 className="font-display text-3xl font-bold text-gradient">AURA CAFE</h1>
          <p className="mt-3 font-body text-xs font-semibold uppercase tracking-[0.2em] text-chrome-mid/60">
            Admin Panel
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email field */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-email" className="text-sm font-medium text-chrome-light">
              Email
            </label>
            <input
              id="admin-email"
              type="text"
              placeholder="admin@aura.cafe"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError(null);
              }}
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-base text-white placeholder:text-white/30 backdrop-blur-sm transition-colors duration-150 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
              required
              autoComplete="email"
            />
          </div>

          {/* Password field */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-password" className="text-sm font-medium text-chrome-light">
              Mật khẩu
            </label>
            <input
              id="admin-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-base text-white placeholder:text-white/30 backdrop-blur-sm transition-colors duration-150 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
              required
              autoComplete="current-password"
            />
          </div>

          {/* Error toast */}
          {error && (
            <div
              className="flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/40 p-3 text-sm text-red-400"
              role="alert"
            >
              <span>&#9888;&#65039;</span>
              <span>{error}</span>
            </div>
          )}

          {/* Submit button — accent color */}
          <Button
            type="submit"
            loading={isLoading}
            className="w-full bg-accent text-primary hover:bg-accent/90"
            size="lg"
          >
            Đăng nhập
          </Button>
        </form>
      </div>
    </div>
  );
}
