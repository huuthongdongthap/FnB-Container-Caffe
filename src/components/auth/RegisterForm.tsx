import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePenLine } from 'lucide-react';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

/* ═══════════════════════════════════════════════════════════════════
   RegisterForm — customer registration with validation.
   On success: navigates to /admin/dashboard.
   ═══════════════════════════════════════════════════════════════════ */

export function RegisterForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { register, loading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Vui lòng nhập họ tên';
    if (!email.trim()) errs.email = 'Vui lòng nhập email';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Email không hợp lệ';
    if (!phone.trim()) errs.phone = 'Vui lòng nhập số điện thoại';
    else if (!/^0\d{9}$/.test(phone)) errs.phone = 'Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)';
    if (!password) errs.password = 'Vui lòng nhập mật khẩu';
    else if (password.length < 6) errs.password = 'Mật khẩu tối thiểu 6 ký tự';
    if (password !== confirm) errs.confirm = 'Mật khẩu xác nhận không khớp';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    if (!validate()) return;
    await register(name.trim(), email.trim(), phone.trim(), password);
    const token = useAuthStore.getState().token;
    if (token) navigate('/admin/dashboard');
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4 p-6" noValidate>
      <h2 className="text-2xl font-bold"><FilePenLine className="inline mr-2" size={24} />Đăng ký</h2>

      {error && (
        <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="reg-name" className="mb-1 block text-sm font-medium">
          Họ tên
        </label>
        <input
          id="reg-name"
          type="text"
          placeholder="Nguyễn Văn A"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoComplete="name"
        />
        {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
      </div>

      <div>
        <label htmlFor="reg-email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="reg-email"
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
        <label htmlFor="reg-phone" className="mb-1 block text-sm font-medium">
          Số điện thoại
        </label>
        <input
          id="reg-phone"
          type="tel"
          placeholder="0901234567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoComplete="tel"
        />
        {fieldErrors.phone && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>}
      </div>

      <div>
        <label htmlFor="reg-password" className="mb-1 block text-sm font-medium">
          Mật khẩu
        </label>
        <input
          id="reg-password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoComplete="new-password"
        />
        {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
      </div>

      <div>
        <label htmlFor="reg-confirm" className="mb-1 block text-sm font-medium">
          Xác nhận mật khẩu
        </label>
        <input
          id="reg-confirm"
          type="password"
          placeholder="••••••••"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoComplete="new-password"
        />
        {fieldErrors.confirm && <p className="mt-1 text-xs text-red-600">{fieldErrors.confirm}</p>}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? 'Đang đăng ký...' : 'Đăng ký'}
      </button>
    </form>
  );
}
