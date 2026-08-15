import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useAdminStaffStore } from '@/hooks/stores/admin/use-admin-staff-store';

export function StaffListTab() {
  const { t } = useTranslation();
  const { staff, loading, error, fetchStaff, registerStaff } = useAdminStaffStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', role: '', phone: '', email: '', password: '' });
  const [registerError, setRegisterError] = useState<string | null>(null);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleToggleActive = (_id: string) => {
    // Placeholder for toggle active endpoint
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
      setShowAddModal(false);
      setNewStaff({ name: '', role: '', phone: '', email: '', password: '' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Register failed';
      setRegisterError(msg);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-destructive mb-2">{error}</p>
        <Button variant="secondary" size="sm" onClick={() => fetchStaff()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  const activeStaff = staff.filter((m) => m.isActive);
  const inactiveStaff = staff.filter((m) => !m.isActive);

  return (
    <>
      <HelmetHead title={`${t('adminStaff.title')} — AURA CAFE`} description={t('adminStaff.subtitle')} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('adminStaff.title')}</h1>
          <p className="text-sm text-muted mt-1">{t('adminStaff.subtitle')}</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>{t('adminStaff.addStaff')}</Button>
      </div>

      {staff.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <p className="text-sm text-muted">{t('adminStaff.emptyTitle')}</p>
            <p className="text-xs text-muted mt-1">{t('adminStaff.emptyHint')}</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
              {t('adminStaff.title')} ({activeStaff.length})
            </h2>
            <div className="space-y-2">
              {activeStaff.map((member) => (
                <Card key={member.id}>
                  <CardBody className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p>{member.phone}</p>
                        <p>{member.email}</p>
                        <p>{new Date(member.startedAt).toLocaleDateString('vi-VN')}</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-muted"
                        onClick={() => handleToggleActive(member.id)}
                      >
                        {t('adminStaff.deactivate')}
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>

          {inactiveStaff.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
                {t('adminStaff.inactive')} ({inactiveStaff.length})
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
                      {t('adminStaff.reactivate')}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={showAddModal} onClose={() => setShowAddModal(false)}>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t('adminStaff.addStaff')}</h2>
          {registerError && <div className="text-red-600 text-xs">{registerError}</div>}
          <Input
            label={t('adminStaff.fieldName')}
            value={newStaff.name}
            onChange={(e) => setNewStaff((prev) => ({ ...prev, name: e.target.value }))}
          />
          <Input
            label={t('adminStaff.fieldRole')}
            value={newStaff.role}
            onChange={(e) => setNewStaff((prev) => ({ ...prev, role: e.target.value }))}
            placeholder={t('adminStaff.fieldRolePlaceholder')}
          />
          <Input
            label={t('adminStaff.fieldPhone')}
            value={newStaff.phone}
            onChange={(e) => setNewStaff((prev) => ({ ...prev, phone: e.target.value }))}
          />
          <Input
            label={t('adminStaff.fieldEmail')}
            type="email"
            value={newStaff.email}
            onChange={(e) => setNewStaff((prev) => ({ ...prev, email: e.target.value }))}
          />
          <Input
            label={t('adminStaff.fieldPassword')}
            type="password"
            value={newStaff.password}
            onChange={(e) => setNewStaff((prev) => ({ ...prev, password: e.target.value }))}
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAdd}>{t('common.confirm')}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
