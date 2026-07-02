import { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '@/hooks/use-admin';
import { SyncStatus } from '@/components/admin/SyncStatus';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://aura-space-worker.agencyos-openclaw.workers.dev';

interface SyncLogEntry {
  id: string;
  entity: string;
  action: string;
  status: 'success' | 'error';
  message: string;
  timestamp: string;
}

const SYNC_ENTITIES = ['Orders', 'Products', 'Customers', 'Inventory', 'Invoices'];

export default function AdminERPNExtSyncPage() {
  const { syncStatus, isLoadingSyncStatus } = useAdmin();
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([
    { id: 'L001', entity: 'Orders', action: 'sync', status: 'success', message: 'Đồng bộ 15 đơn hàng thành công', timestamp: new Date(Date.now() - 300000).toISOString() },
    { id: 'L002', entity: 'Products', action: 'sync', status: 'success', message: 'Đồng bộ 42 sản phẩm thành công', timestamp: new Date(Date.now() - 600000).toISOString() },
    { id: 'L003', entity: 'Customers', action: 'sync', status: 'error', message: 'Lỗi kết nối ERPNext server', timestamp: new Date(Date.now() - 900000).toISOString() },
    { id: 'L004', entity: 'Inventory', action: 'sync', status: 'success', message: 'Cập nhật tồn kho thành công', timestamp: new Date(Date.now() - 3600000).toISOString() },
  ]);
  const [syncingEntity, setSyncingEntity] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  // ─── ERPNext Config State ─────────────────────────────────────────
  const [config, setConfig] = useState<{
    configured: boolean;
    url: string | null;
    key_set: boolean;
    secret_set: boolean;
    source: string | null;
  } | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [formUrl, setFormUrl] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formApiSecret, setFormApiSecret] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [configMessage, setConfigMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'warning';
  } | null>(null);
  // ───────────────────────────────────────────────────────────────────

  const triggerSync = async (entity: string) => {
    const { token } = useAuthStore.getState();
    if (!token) return;

    setSyncingEntity(entity);
    try {
      const res = await fetch(`${API_BASE}/api/admin/erpnext-sync/${entity.toLowerCase()}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const body = res.ok ? await res.json().catch(() => ({})) : null;

      const logEntry: SyncLogEntry = {
        id: `L${Date.now()}`,
        entity,
        action: 'sync',
        status: res.ok ? 'success' : 'error',
        message: res.ok
          ? `Đồng bộ ${entity} thành công`
          : (body?.message || `Lỗi đồng bộ ${entity}`),
        timestamp: new Date().toISOString(),
      };
      setSyncLogs((prev) => [logEntry, ...prev]);
    } catch {
      setSyncLogs((prev) => [
        {
          id: `L${Date.now()}`,
          entity,
          action: 'sync',
          status: 'error',
          message: `Lỗi kết nối khi đồng bộ ${entity}`,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    } finally {
      setSyncingEntity(null);
    }
  };

  const handleSyncAll = async () => {
    const { token } = useAuthStore.getState();
    if (!token) return;

    setSyncingAll(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/erpnext-sync/sync-all`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const body = res.ok ? await res.json().catch(() => ({})) : null;

      setSyncLogs((prev) => [
        {
          id: `L${Date.now()}`,
          entity: 'All',
          action: 'sync-all',
          status: res.ok ? 'success' : 'error',
          message: res.ok
            ? 'Đồng bộ tất cả dữ liệu thành công'
            : (body?.message || 'Lỗi đồng bộ tất cả'),
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch {
      setSyncLogs((prev) => [
        {
          id: `L${Date.now()}`,
          entity: 'All',
          action: 'sync-all',
          status: 'error',
          message: 'Lỗi kết nối khi đồng bộ tất cả',
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    } finally {
      setSyncingAll(false);
    }
  };

  // ─── ERPNext Config Handlers ──────────────────────────────────────

  const fetchConfig = useCallback(async () => {
    setIsLoadingConfig(true);
    setConfigMessage(null);
    const { token } = useAuthStore.getState();
    if (!token) {
      setIsLoadingConfig(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/erpnext/configure`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setConfigOpen(!data.configured);
        if (data.url) setFormUrl(data.url);
      } else {
        setConfig({ configured: false, url: null, key_set: false, secret_set: false, source: null });
        setConfigOpen(true);
      }
    } catch {
      setConfig({ configured: false, url: null, key_set: false, secret_set: false, source: null });
      setConfigOpen(true);
      setConfigMessage({ text: 'Không thể tải cấu hình ERPNext. Vui lòng thử lại.', type: 'error' });
    } finally {
      setIsLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSaveConfig = async () => {
    if (!formUrl || !formApiKey || !formApiSecret) {
      setConfigMessage({ text: 'Vui lòng điền đầy đủ thông tin.', type: 'error' });
      return;
    }

    setIsSaving(true);
    setConfigMessage(null);
    const { token } = useAuthStore.getState();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/api/erpnext/configure`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: formUrl, api_key: formApiKey, api_secret: formApiSecret }),
      });

      if (res.ok) {
        setConfigMessage({ text: '✅ Cấu hình đã được lưu thành công!', type: 'success' });
        await fetchConfig();
      } else {
        const body = await res.json().catch(() => ({}));
        setConfigMessage({ text: body.message || 'Lỗi khi lưu cấu hình.', type: 'error' });
      }
    } catch {
      setConfigMessage({ text: 'Lỗi kết nối khi lưu cấu hình.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConfigMessage(null);
    const { token } = useAuthStore.getState();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/api/erpnext/configure`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: formUrl, api_key: formApiKey, api_secret: formApiSecret }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.connection_ok) {
          setConfigMessage({ text: '🔗 Kết nối thành công!', type: 'success' });
        } else {
          setConfigMessage({
            text: data.message || '⚠️ Kết nối thất bại. Vui lòng kiểm tra thông tin.',
            type: 'warning',
          });
        }
      } else {
        const body = await res.json().catch(() => ({}));
        setConfigMessage({ text: body.message || 'Lỗi khi kiểm tra kết nối.', type: 'error' });
      }
    } catch {
      setConfigMessage({ text: 'Lỗi kết nối khi kiểm tra.', type: 'error' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDeleteConfig = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa cấu hình ERPNext?')) return;

    setIsDeleting(true);
    setConfigMessage(null);
    const { token } = useAuthStore.getState();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/api/erpnext/configure`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setConfigMessage({ text: '🗑️ Cấu hình đã được xóa.', type: 'success' });
        setFormUrl('');
        setFormApiKey('');
        setFormApiSecret('');
        await fetchConfig();
      } else {
        const body = await res.json().catch(() => ({}));
        setConfigMessage({ text: body.message || 'Lỗi khi xóa cấu hình.', type: 'error' });
      }
    } catch {
      setConfigMessage({ text: 'Lỗi kết nối khi xóa cấu hình.', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const maskUrl = (url: string): string => {
    try {
      const u = new URL(url);
      const domain = u.hostname;
      if (domain.startsWith('***.')) return url;
      const parts = domain.split('.');
      if (parts.length >= 2) {
        return `${u.protocol}//***.${parts.slice(1).join('.')}`;
      }
      return `${u.protocol}//***`;
    } catch {
      return url;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-display font-bold">Đồng bộ ERPNext</h1>
          <Button onClick={handleSyncAll} loading={syncingAll} disabled={syncingAll}>
            &#8635; Đồng bộ tất cả
          </Button>
        </div>

        {/* ERPNext Configuration */}
        <Card className="mb-6">
          <CardHeader>
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setConfigOpen(!configOpen)}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold font-display">
                  {configOpen ? '▼' : '▶'} 🔑 Cấu hình ERPNext
                </span>
                {isLoadingConfig ? (
                  <Skeleton className="w-28 h-5 rounded-full" />
                ) : (
                  <Badge variant={config?.configured ? 'success' : 'destructive'}>
                    {config?.configured ? '🟢 Đã cấu hình' : '🔴 Chưa cấu hình'}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          {configOpen && (
            <CardBody>
              {isLoadingConfig ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" variant="rectangular" />
                  <Skeleton className="h-10 w-full" variant="rectangular" />
                  <Skeleton className="h-10 w-full" variant="rectangular" />
                </div>
              ) : (
                <div className="space-y-4">
                  {configMessage && (
                    <div
                      className={`p-3 rounded-lg text-sm ${
                        configMessage.type === 'success'
                          ? 'bg-green-50 text-green-800'
                          : configMessage.type === 'error'
                            ? 'bg-red-50 text-red-800'
                            : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {configMessage.text}
                    </div>
                  )}

                  {config?.configured && config.url && (
                    <div className="text-sm text-muted">
                      Đã cấu hình: <span className="font-medium">{maskUrl(config.url)}</span>
                      {config.source && <span className="ml-2">(Nguồn: {config.source})</span>}
                    </div>
                  )}

                  <Input
                    label="ERPNext URL"
                    placeholder="https://erpnext.yourdomain.com"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    type="url"
                  />
                  <Input
                    label="API Key"
                    placeholder="Nhập API Key"
                    value={formApiKey}
                    onChange={(e) => setFormApiKey(e.target.value)}
                    type="text"
                  />
                  <Input
                    label="API Secret"
                    placeholder="Nhập API Secret"
                    value={formApiSecret}
                    onChange={(e) => setFormApiSecret(e.target.value)}
                    type="password"
                  />

                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button onClick={handleSaveConfig} loading={isSaving} disabled={isSaving}>
                      💾 Lưu cấu hình
                    </Button>
                    <Button
                      onClick={handleTestConnection}
                      loading={isTesting}
                      disabled={isTesting || !config?.configured}
                      variant="secondary"
                    >
                      🔗 Kiểm tra kết nối
                    </Button>
                    <Button
                      onClick={handleDeleteConfig}
                      loading={isDeleting}
                      disabled={isDeleting}
                      variant="destructive"
                    >
                      🗑️ Xóa cấu hình
                    </Button>
                  </div>
                </div>
              )}
            </CardBody>
          )}
        </Card>

        {/* Status */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="font-display font-semibold">Trạng thái đồng bộ</h2>
          </CardHeader>
          <CardBody>
            <SyncStatus status={syncStatus} isLoading={isLoadingSyncStatus} />
          </CardBody>
        </Card>

        {/* Entity sync controls */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="font-display font-semibold">Đồng bộ theo thực thể</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SYNC_ENTITIES.map((entity) => (
                <div
                  key={entity}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-white"
                >
                  <div>
                    <p className="text-sm font-medium">{entity}</p>
                    <p className="text-xs text-muted">
                      {syncLogs
                        .filter((l) => l.entity === entity)
                        .slice(0, 1)
                        .map((l) => `${l.status === 'success' ? 'Lần cuối: thành công' : 'Lần cuối: lỗi'}`)
                        .join('') || 'Chưa đồng bộ'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    loading={syncingEntity === entity}
                    disabled={syncingEntity === entity}
                    onClick={() => triggerSync(entity)}
                  >
                    &#8635; Đồng bộ
                  </Button>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Sync logs */}
        <Card>
          <CardHeader>
            <h2 className="font-display font-semibold">Lịch sử đồng bộ</h2>
          </CardHeader>
          <CardBody>
            {syncLogs.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">Chưa có lịch sử đồng bộ</p>
            ) : (
              <div className="space-y-2">
                {syncLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 text-sm"
                  >
                    <Badge variant={log.status === 'success' ? 'success' : 'destructive'}>
                      {log.status === 'success' ? 'OK' : 'ERR'}
                    </Badge>
                    <div className="flex-1">
                      <p className="font-medium text-xs">
                        {log.entity} &mdash; {log.action}
                      </p>
                      <p className="text-xs text-muted">{log.message}</p>
                    </div>
                    <span className="text-xs text-muted shrink-0">
                      {formatRelativeTime(log.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  return `${hours} giờ trước`;
}
