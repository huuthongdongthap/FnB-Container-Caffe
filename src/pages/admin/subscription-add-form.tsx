/**
 * Inline form for adding a new staff subscription.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ROLE_OPTIONS } from './notification-settings-types';
import type { StaffSubscription } from './notification-settings-types';

type Props = {
  onAdd: (name: string, role: StaffSubscription['role']) => Promise<boolean>;
  onCancel: () => void;
};

export function SubscriptionAddForm({ onAdd, onCancel }: Props) {
  const { i18n } = useTranslation();
  const isVi = i18n.language === 'vi';

  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffSubscription['role']>('staff');
  const [adding, setAdding] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setAdding(true);
    const ok = await onAdd(name.trim(), role);
    if (ok) {
      setName('');
      setRole('staff');
      onCancel();
    }
    setAdding(false);
  };

  return (
    <div className="mb-4 rounded-lg border border-border bg-[var(--aura-bg-elevated)] p-4 dark:bg-gray-800/50">
      <p className="mb-3 text-sm font-medium text-[var(--aura-chrome-bright)]">
        {isVi ? 'Đăng ký nhân viên mới' : 'Register new staff member'}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted">
            {isVi ? 'Tên nhân viên' : 'Staff name'}
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isVi ? 'Nhập tên...' : 'Enter name...'}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSubmit();
            }}
          />
        </div>
        <div className="w-full sm:w-48">
          <label className="mb-1 block text-xs font-medium text-muted">
            {isVi ? 'Vai trò' : 'Role'}
          </label>
          <select
            value={role}
            onChange={(e) =>
              setRole(e.target.value as StaffSubscription['role'])
            }
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent dark:bg-gray-800"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {isVi ? o.labelVn : o.labelEn}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!name.trim() || adding}
          >
            {adding
              ? isVi
                ? 'Đang thêm...'
                : 'Adding...'
              : isVi
                ? 'Đăng ký'
                : 'Subscribe'}
          </Button>
          <Button size="sm" variant="secondary" onClick={onCancel}>
            {isVi ? 'Hủy' : 'Cancel'}
          </Button>
        </div>
      </div>
    </div>
  );
}
