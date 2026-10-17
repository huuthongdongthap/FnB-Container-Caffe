import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminRecruitmentStore } from '@/hooks/stores/admin/use-admin-recruitment-store';
import { StaffRecruitmentStats } from './staff-recruitment-stats';
import { AddCandidateModal } from './staff-recruitment-modal';
import type { RecruitmentApplication } from './staff-types';
import { Phone, MessageCircle, Calendar, Trash2 } from 'lucide-react';

const STATUS_CONFIG: Record<RecruitmentApplication['status'], { label: string; color: 'warning' | 'info' | 'success' | 'destructive' | 'secondary' }> = {
  pending: { label: 'Chờ liên hệ', color: 'warning' },
  contacted: { label: 'Đã liên hệ', color: 'info' },
  interview: { label: 'Phỏng vấn', color: 'secondary' },
  hired: { label: 'Trúng tuyển', color: 'success' },
  rejected: { label: 'Từ chối', color: 'destructive' },
};

const POSITION_LABELS: Record<string, string> = {
  barista: '☕ Barista (Pha chế)',
  service: '✨ Phục vụ & Thu ngân',
};

const SHIFT_LABELS: Record<string, string> = {
  ca1: 'Ca 1 (6h-14h)',
  ca2: 'Ca 2 (14h-22h)',
  ca3_flexible: 'Ca 3 (Linh hoạt)',
  morning: 'Ca 1 (6h-14h)',
  afternoon: 'Ca 2 (14h-22h)',
  evening: 'Ca tối',
  flexible: 'Ca 3 (Linh hoạt)',
};

export function RecruitmentTab() {
  const { t } = useTranslation();
  const { applications, loading, error, fetchApplications, updateStatus, deleteApplication, addCandidate } = useAdminRecruitmentStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterPos, setFilterPos] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchApplications({ search, position: filterPos, status: filterStatus });
  }, [fetchApplications, search, filterPos, filterStatus]);

  const cleanPhone = (phone: string) => phone.replace(/\D/g, '');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('adminStaff.recruitmentTitle', 'Tuyển dụng nhân sự')}</h1>
          <p className="text-sm text-muted mt-1">{t('adminStaff.recruitmentSubtitle', 'Quản lý danh sách hồ sơ ứng viên AURA CAFE')}</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          {t('adminStaff.addCandidateBtn', '+ Nhập hồ sơ ứng viên')}
        </Button>
      </div>

      <StaffRecruitmentStats applications={applications} />

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tên hoặc số điện thoại ứng viên..."
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterPos}
            onChange={(e) => setFilterPos(e.target.value)}
            className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Tất cả vị trí</option>
            <option value="barista">Pha chế (Barista)</option>
            <option value="service">Thu ngân & Phục vụ</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Chờ liên hệ</option>
            <option value="contacted">Đã liên hệ</option>
            <option value="interview">Phỏng vấn</option>
            <option value="hired">Trúng tuyển</option>
            <option value="rejected">Từ chối</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-sm text-destructive mb-2">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => fetchApplications()}>
            {t('common.retry', 'Thử lại')}
          </Button>
        </div>
      ) : applications.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <p className="text-base font-medium text-foreground">Chưa có hồ sơ ứng tuyển nào</p>
            <p className="text-xs text-muted mt-1">Khi ứng viên quét mã QR trên poster A3 nộp form, hồ sơ sẽ hiển thị tại đây.</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <Card key={app.id} className="border border-border hover:border-primary/40 transition-colors">
              <CardBody className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base text-foreground">{app.fullName}</span>
                    <Badge color="secondary">{POSITION_LABELS[app.position] || app.position}</Badge>
                    <Badge color={STATUS_CONFIG[app.status]?.color || 'warning'}>
                      {STATUS_CONFIG[app.status]?.label || app.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted flex-wrap">
                    <span className="inline-flex items-center gap-1 font-medium text-foreground">
                      <Phone className="w-3.5 h-3.5 text-primary" /> {app.phone}
                    </span>
                    {app.birthYear && <span>Năm sinh: {app.birthYear}</span>}
                    {app.shifts?.length > 0 && (
                      <span>Ca làm: {app.shifts.map((s) => SHIFT_LABELS[s] || s).join(', ')}</span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(app.createdAt).toLocaleDateString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </span>
                  </div>

                  {app.note && (
                    <p className="text-xs text-muted bg-surface/80 p-2 rounded border border-border/40 mt-1">
                      <span className="font-medium text-foreground">Ghi chú:</span> {app.note}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap pt-2 md:pt-0 border-t md:border-t-0 border-border">
                  <a
                    href={`tel:${cleanPhone(app.phone)}`}
                    className="p-2 text-primary hover:bg-primary/10 rounded-lg border border-primary/20 inline-flex items-center justify-center transition-colors"
                    title="Gọi điện"
                  >
                    <Phone className="w-4 h-4" />
                  </a>

                  <a
                    href={`https://zalo.me/${cleanPhone(app.phone)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg border border-blue-400/20 inline-flex items-center justify-center transition-colors"
                    title="Nhắn Zalo"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </a>

                  <select
                    value={app.status}
                    onChange={(e) => updateStatus(app.id, e.target.value as RecruitmentApplication['status'])}
                    className="text-xs bg-surface border border-border rounded-lg px-2.5 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="pending">Chờ liên hệ</option>
                    <option value="contacted">Đã liên hệ</option>
                    <option value="interview">Phỏng vấn</option>
                    <option value="hired">Trúng tuyển</option>
                    <option value="rejected">Từ chối</option>
                  </select>

                  <button
                    onClick={() => {
                      if (window.confirm(`Xác nhận xóa hồ sơ ứng viên ${app.fullName}?`)) {
                        deleteApplication(app.id);
                      }
                    }}
                    className="p-2 text-muted hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    title="Xóa hồ sơ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <AddCandidateModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={addCandidate}
      />
    </div>
  );
}
