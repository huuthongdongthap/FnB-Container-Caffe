import { useState } from 'react';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'var(--aura-noir-deep)' }}>
      {/* Ambient radial gradient — top-left */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 15% 10%, #1a2740 0%, transparent 60%)',
        }}
      />

      {/* Decorative light streak — left side of card */}
      <div className="absolute left-8 top-1/2 -translate-y-1/2 w-px h-48 hidden md:block"
        style={{
          background: 'linear-gradient(to bottom, transparent, rgba(212,167,116,0.35), transparent)',
        }}
      />

      {/* Login card */}
      <div className="glass-panel rounded-3xl p-8 md:p-12 max-w-md w-full mx-4 relative z-10"
        style={{ background: 'rgba(0,0,0,0.25)' }}>
        {/* Brand */}
        <div className="text-center mb-10">
          <span className="text-2xl mb-3 block" style={{ color: 'var(--aura-tertiary)' }}>
            {'✦'}
          </span>
          <h1 className="font-display text-2xl md:text-3xl uppercase tracking-[0.25em]"
            style={{ color: 'var(--aura-tertiary)' }}>
            AURA CAFE
          </h1>
        </div>

        {/* Form */}
        <form className="space-y-7" onSubmit={handleSubmit}>
          {/* Username */}
          <div>
            <label htmlFor="username"
              className="font-label-caps text-label-caps block mb-2 uppercase tracking-widest"
              style={{ color: 'var(--aura-chrome-mid)', fontSize: '10px' }}>
              Username / {'Tên đăng nhập'}
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="w-full bg-transparent border-0 border-b outline-none text-base py-2 transition-colors focus:border-[var(--aura-tertiary)]"
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.2)',
                color: 'var(--aura-chrome-bright)',
                fontFamily: 'var(--aura-font-body, inherit)',
              }}
              placeholder="admin"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <label htmlFor="password"
              className="font-label-caps text-label-caps block mb-2 uppercase tracking-widest"
              style={{ color: 'var(--aura-chrome-mid)', fontSize: '10px' }}>
              Password / {'Mật khẩu'}
            </label>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-transparent border-0 border-b outline-none text-base py-2 transition-colors focus:border-[var(--aura-tertiary)]"
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.2)',
                color: 'var(--aura-chrome-bright)',
                fontFamily: 'var(--aura-font-body, inherit)',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-lg"
              style={{ color: 'var(--aura-chrome-mid)' }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? '👁' : '🚫'}
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-4 rounded-xl font-bold uppercase tracking-widest transition-all hover:brightness-110 active:scale-[0.98]"
            style={{
              background: 'var(--aura-tertiary)',
              color: 'var(--aura-noir-deep)',
              fontFamily: 'var(--aura-font-body, inherit)',
            }}>
            Sign In / {'Đăng nhập'}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-center gap-3 font-label-caps text-label-caps uppercase tracking-widest"
          style={{ color: 'var(--aura-chrome-mid)', fontSize: '10px' }}>
          <a href="#"
            className="hover:underline transition-colors"
            style={{ color: 'var(--aura-tertiary)' }}>
            Forgot password? / Quên mật khẩu?
          </a>
          <span>|</span>
          <a href="/"
            className="hover:underline transition-colors"
            style={{ color: 'var(--aura-chrome-mid)' }}>
            Back to home / Về trang chủ
          </a>
        </div>
      </div>
    </div>
  );
}
