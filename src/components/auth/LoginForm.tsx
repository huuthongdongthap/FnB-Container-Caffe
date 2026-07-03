import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock as LockIcon } from 'lucide-react';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

/* ═══════════════════════════════════════════════════════════════════
   LoginForm — email/password login with validation.
   On success: navigates to /admin/dashboard.
   ═══════════════════════════════════════════════════════════════════ */

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const { login, loading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  function validate(): boolean {
    const errs: { email?: string; password?: string } = {};
    if (!email.trim()) errs.email = 'Vui lòng nhập email';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Email không hợp lệ';
    if (!password) errs.password = 'Vui lòng nhập mật khẩu';
    else if (password.length < 6) errs.password = 'Mật khẩu tối thiểu 6 ký tự';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    if (!validate()) return;
    await login(email.trim(), password);
    // Check if login succeeded
    const token = useAuthStore.getState().token;
    if (token) navigate('/admin/dashboard');
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4 p-6" noValidate>
      <h2 className="text-2xl font-bold"><LockIcon className="inline mr-2" size={24} />Đăng nhập</h2>

      {error && (
        <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="login-email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoComplete="email"
        />
        {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
      </div>

      <div>
        <label htmlFor="login-password" className="mb-1 block text-sm font-medium">
          Mật khẩu
        </label>
        <input
          id="login-password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoComplete="current-password"
        />
        {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
      </button>
    </form>
  );
}
