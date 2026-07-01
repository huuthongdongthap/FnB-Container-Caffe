import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useAdminStaffStore } from '@/hooks/stores/admin/use-admin-staff-store';

export default function AdminStaffPage() {
  const { staff, loading, error, fetchStaff, registerStaff } = useAdminStaffStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', role: '', phone: '', email: '', password: '' });
  const [registerError, setRegisterError] = useState<string | null>(null);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleToggleActive = (id: string) => {
    // Toggle active status will be handled via API call when endpoint is available
    // For now, update locally
  };

  const handleAdd = async () => {
    if (!newStaff.name || !newStaff.role) return;
    setRegisterError(null);
    try {
      await registerStaff({
        name: newStaff.name,
        role: newStaff.role,
        phone: newStaff.phone,
        email: newStaff.email,
        password: newStaff.password,
      });
      setNewStaff({ name: '', role: '', phone: '', email: '', password: '' });
      setShowAddModal(false);
    } catch {
      setRegisterError('Không thể thêm nhân viên');
    }
  };

  const activeStaff = staff.filter((s) => s.isActive);
  const inactiveStaff = staff.filter((s) => !s.isActive);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-display font-bold">Quản lý nhân viên</h1>
          <Button onClick={() => setShowAddModal(true)}>
            + Thêm nhân viên
          </Button>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">
            {error}
            <button onClick={fetchStaff} className="ml-3 underline hover:no-underline">
              Thử lại
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && staff.length === 0 ? (
          <div className="text-center py-12 text-muted text-sm">Đang tải...</div>
        ) : (
          <>
            {/* Active staff */}
            <div className="mb-8">
              <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
                Đang làm việc ({activeStaff.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeStaff.map((member) => (
                  <Card key={member.id}>
                    <CardBody>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
                          {member.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm">{member.name}</h3>
                          <Badge className="mt-1">{member.role}</Badge>
                          <div className="mt-2 text-xs text-muted space-y-0.5">
                            <p>{member.phone}</p>
                            <p>{member.email}</p>
                            <p>Bắt đầu: {new Date(member.startedAt).toLocaleDateString('vi-VN')}</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-border">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs text-muted"
                          onClick={() => handleToggleActive(member.id)}
                        >
                          Tạm ngưng
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>

            {/* Inactive staff */}
            {inactiveStaff.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
                  Đã tạm ngưng ({inactiveStaff.length})
                </h2>
                <div className="space-y-2">
                  {inactiveStaff.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-white border border-border opacity-60"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm">{member.name}</span>
                        <Badge>{member.role}</Badge>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleToggleActive(member.id)}>
                        Kích hoạt lại
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Add Modal */}
        <Modal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Thêm nhân viên"
        >
          <div className="space-y-4">
            {registerError && (
              <div className="text-red-600 text-xs">{registerError}</div>
            )}
            <Input
              label="Họ và tên *"
              value={newStaff.name}
              onChange={(e) => setNewStaff((prev) => ({ ...prev, name: e.target.value }))}
            />
            <Input
              label="Vai trò *"
              value={newStaff.role}
              onChange={(e) => setNewStaff((prev) => ({ ...prev, role: e.target.value }))}
              placeholder="VD: Pha chế, Phục vụ, Thu ngân"
            />
            <Input
              label="Số điện thoại"
              value={newStaff.phone}
              onChange={(e) => setNewStaff((prev) => ({ ...prev, phone: e.target.value }))}
            />
            <Input
              label="Email"
              type="email"
              value={newStaff.email}
              onChange={(e) => setNewStaff((prev) => ({ ...prev, email: e.target.value }))}
            />
            <Input
              label="Mật khẩu *"
              type="password"
              value={newStaff.password}
              onChange={(e) => setNewStaff((prev) => ({ ...prev, password: e.target.value }))}
            />
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                Huỷ
              </Button>
              <Button onClick={handleAdd}>
                Thêm
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
