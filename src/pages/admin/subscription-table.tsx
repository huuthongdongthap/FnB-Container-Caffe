/**
 * Subscription management table — lists staff push subscriptions
 * with actions (test send, remove).
 */

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/card';
import {
  Bell,
  Send,
  Trash2,
  RefreshCw,
  UserCog,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { ROLE_OPTIONS } from './notification-settings-types';
import type { StaffSubscription } from './notification-settings-types';

type Props = {
  subscriptions: StaffSubscription[];
  loading: boolean;
  testSending: string | null;
  onTestSend: (name: string, role: StaffSubscription['role']) => void;
  onRemove: (name: string) => void;
  onShowAddForm: () => void;
};

function roleLabel(r: StaffSubscription['role'], isVi: boolean) {
  const opt = ROLE_OPTIONS.find((o) => o.value === r);
  return isVi ? (opt?.labelVn ?? r) : (opt?.labelEn ?? r);
}

export function SubscriptionTable({
  subscriptions,
  loading,
  testSending,
  onTestSend,
  onRemove,
  onShowAddForm,
}: Props) {
  const { i18n } = useTranslation();
  const isVi = i18n.language === 'vi';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-display font-semibold text-[var(--aura-chrome-bright)]">
            <UserCog size={20} aria-hidden="true" className="text-[var(--aura-primary)]" />
            {isVi ? 'Đăng Ký Nhân Viên' : 'Staff Subscriptions'}
          </h2>
          <Button size="sm" onClick={onShowAddForm}>
            <span className="mr-1">+</span>
            {isVi ? 'Thêm' : 'Add'}
          </Button>
        </div>
      </CardHeader>
      <CardBody>
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/30" />
            ))}
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Bell size={40} className="text-muted" aria-hidden="true" />
            <p className="text-sm text-muted">
              {isVi ? 'Chưa có đăng ký nào' : 'No subscriptions yet'}
            </p>
            <Button size="sm" onClick={onShowAddForm}>
              <span className="mr-1">+</span>
              {isVi ? 'Thêm nhân viên' : 'Add staff'}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted">
                  <th className="pb-2 pr-4 font-medium">{isVi ? 'Tên' : 'Name'}</th>
                  <th className="pb-2 pr-4 font-medium">{isVi ? 'Vai trò' : 'Role'}</th>
                  <th className="pb-2 pr-4 font-medium">{isVi ? 'Trạng thái' : 'Status'}</th>
                  <th className="pb-2 pr-4 font-medium">Endpoint</th>
                  <th className="pb-2 pl-4 text-right font-medium">{isVi ? 'Thao tác' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {subscriptions.map((sub) => (
                  <tr key={sub.name}>
                    <td className="py-3 pr-4">
                      <span className="font-medium text-[var(--aura-chrome-bright)]">
                        {sub.name}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex rounded-full bg-[var(--aura-primary)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--aura-primary)]">
                        {roleLabel(sub.role, isVi)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {sub.subscribed ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <Wifi size={14} aria-hidden="true" />
                          {isVi ? 'Đã kết nối' : 'Active'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <WifiOff size={14} aria-hidden="true" />
                          {isVi ? 'Chưa kết nối' : 'Inactive'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-muted">
                        {sub.endpoint
                          ? sub.endpoint.length > 40
                            ? sub.endpoint.slice(0, 40) + '...'
                            : sub.endpoint
                          : isVi
                            ? 'Không có'
                            : 'None'}
                      </span>
                    </td>
                    <td className="py-3 pl-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onTestSend(sub.name, sub.role)}
                          disabled={testSending === sub.name}
                          aria-label={isVi ? 'Gửi thử' : 'Test send'}
                        >
                          {testSending === sub.name ? (
                            <RefreshCw size={16} className="animate-spin" aria-hidden="true" />
                          ) : (
                            <Send size={16} aria-hidden="true" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onRemove(sub.name)}
                          aria-label={isVi ? 'Xóa' : 'Remove'}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
      <CardFooter>
        <p className="text-xs text-muted">
          {isVi
            ? 'API endpoint: POST /api/push/subscribe, POST /api/push/send-staff'
            : 'API endpoints: POST /api/push/subscribe, POST /api/push/send-staff'}
        </p>
      </CardFooter>
    </Card>
  );
}
