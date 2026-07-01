import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader } from '@/components/ui/card';

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
      setError('Vui lòng nhập tên đăng nhập và mật khẩu');
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
        setError('Tên đăng nhập hoặc mật khẩu không đúng');
      }
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoggedIn) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-md mx-auto text-center py-12">
          <div className="text-4xl mb-4">&#9989;</div>
          <h2 className="text-xl font-display font-bold mb-2">
            Đã đăng nhập
          </h2>
          <p className="text-sm text-muted mb-4">
            Chào mừng bạn quay lại!
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => window.location.href = '/admin/dashboard'}>
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold mb-1">AURA CAFE</h1>
            <p className="text-xs text-muted uppercase tracking-wider">
              Admin Panel
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Tên đăng nhập"
              id="admin-username"
              type="text"
              placeholder="admin"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError(null);
              }}
              required
            />

            <Input
              label="Mật khẩu"
              id="admin-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              required
            />

            {error && (
              <p className="text-sm text-destructive bg-red-50 p-3 rounded-lg border border-red-200">
                {error}
              </p>
            )}

            <Button type="submit" loading={isLoading} className="w-full" size="lg">
              Đăng nhập
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
