import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useAdminStaffStore } from '@/hooks/stores/admin/use-admin-staff-store';
import { useAdminShiftsStore, type ShiftRecord } from '@/hooks/stores/admin/use-admin-shifts-store';

type StaffTab = 'list' | 'shifts';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN');
}

function formatHours(hours: number | null): string {
  if (hours === null) return '--';
  return hours.toFixed(1) + 'h';
}

/* ──────────────────────── Staff List Tab (original) ──────────────────────── */

function StaffListTab() {
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
      setNewStaff({ name: '', role: '', phone: '', email: '', password: '' });
      setShowAddModal(false);
    } catch {
      setRegisterError('Không thể thêm nhân viên');
    }
  };

  const activeStaff = staff.filter((s) => s.isActive);
  const inactiveStaff = staff.filter((s) => !s.isActive);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold">Quản lý nhân viên</h1>
        <Button onClick={() => setShowAddModal(true)}>+ Thêm nhân viên</Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">
          {error}
          <button onClick={fetchStaff} className="ml-3 underline hover:no-underline">
            Thử lại
          </button>
        </div>
      )}

      {loading && staff.length === 0 ? (
        <div className="text-center py-12 text-muted text-sm">Đang tải...</div>
      ) : (
        <>
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

      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Thêm nhân viên">
        <div className="space-y-4">
          {registerError && <div className="text-red-600 text-xs">{registerError}</div>}
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
            <Button onClick={handleAdd}>Thêm</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ──────────────────────── Shifts Tab ──────────────────────── */

function ActiveStaffRow({
  staff,
  todayShifts,
}: {
  staff: { id: string; name: string }[];
  todayShifts: ShiftRecord[];
}) {
  const activeShifts = todayShifts.filter((s) => !s.clock_out);

  if (staff.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <h2 className="text-lg font-display font-semibold">Đang làm việc</h2>
      </CardHeader>
      <CardBody>
        {activeShifts.length === 0 ? (
          <p className="text-sm text-muted">Chưa có ai check-in hôm nay</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {activeShifts.map((shift) => (
              <div key={shift.id} className="flex items-center gap-3 bg-muted/10 rounded-lg px-4 py-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-bold">
                    {shift.staff_name.charAt(0)}
                  </div>
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                </div>
                <div>
                  <p className="text-sm font-medium">{shift.staff_name}</p>
                  <p className="text-xs text-green-600">
                    Đã check-in lúc {formatTime(shift.clock_in)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function ClockInOutGrid({
  staff,
  todayShifts,
  onClockIn,
  onClockOut,
  loading,
}: {
  staff: { id: string; name: string; role: string }[];
  todayShifts: ShiftRecord[];
  onClockIn: (id: string, name: string) => void;
  onClockOut: (id: string) => void;
  loading: { clockIn: boolean; clockOut: boolean };
}) {
  const activeShiftByStaff = new Map<string, ShiftRecord>();
  for (const shift of todayShifts) {
    if (!shift.clock_out) {
      activeShiftByStaff.set(shift.staff_id, shift);
    }
  }

  if (staff.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <h2 className="text-lg font-display font-semibold">Check-in / Check-out</h2>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {staff.map((member) => {
            const activeShift = activeShiftByStaff.get(member.id);
            const isActive = !!activeShift;

            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-white/60"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                      {member.name.charAt(0)}
                    </div>
                    <span
                      className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 border-2 border-white rounded-full ${
                        isActive ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted">{member.role}</p>
                    {isActive && (
                      <p className="text-xs text-green-600 mt-0.5">
                        Đã check-in lúc {formatTime(activeShift.clock_in)}
                      </p>
                    )}
                  </div>
                </div>
                {isActive ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    loading={loading.clockOut}
                    onClick={() => onClockOut(member.id)}
                  >
                    Check-out
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    loading={loading.clockIn}
                    onClick={() => onClockIn(member.id, member.name)}
                  >
                    Check-in
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

function TodayShiftsTable({ shifts, loading }: { shifts: ShiftRecord[]; loading: boolean }) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <h2 className="text-lg font-display font-semibold">Ca hôm nay</h2>
      </CardHeader>
      <CardBody className="p-0">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : shifts.length === 0 ? (
          <p className="text-sm text-muted px-6 py-4">Chưa có ai check-in hôm nay</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted text-xs uppercase tracking-wider">
                  <th className="px-6 py-3 font-medium">Nhân viên</th>
                  <th className="px-6 py-3 font-medium">Check-in</th>
                  <th className="px-6 py-3 font-medium">Check-out</th>
                  <th className="px-6 py-3 font-medium">Số giờ</th>
                  <th className="px-6 py-3 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift) => (
                  <tr key={shift.id} className="border-b border-border/50 hover:bg-muted/5">
                    <td className="px-6 py-3 font-medium">{shift.staff_name}</td>
                    <td className="px-6 py-3">{formatTime(shift.clock_in)}</td>
                    <td className="px-6 py-3">{shift.clock_out ? formatTime(shift.clock_out) : '--'}</td>
                    <td className="px-6 py-3">{formatHours(shift.hours_worked)}</td>
                    <td className="px-6 py-3">
                      {shift.clock_out ? (
                        <Badge variant="default">Đã check-out</Badge>
                      ) : (
                        <Badge variant="success">Đang làm</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function ShiftHistoryTable({ shifts, loading }: { shifts: ShiftRecord[]; loading: boolean }) {
  const [page, setPage] = useState(1);
  const perPage = 15;
  const totalPages = Math.max(1, Math.ceil(shifts.length / perPage));
  const paged = shifts.slice((page - 1) * perPage, page * perPage);

  useEffect(() => {
    setPage(1);
  }, [shifts.length]);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-display font-semibold">Lịch sử chấm công</h2>
      </CardHeader>
      <CardBody className="p-0">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : shifts.length === 0 ? (
          <p className="text-sm text-muted px-6 py-4">Chưa có dữ liệu chấm công</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted text-xs uppercase tracking-wider">
                    <th className="px-6 py-3 font-medium">Ngày</th>
                    <th className="px-6 py-3 font-medium">Nhân viên</th>
                    <th className="px-6 py-3 font-medium">Check-in</th>
                    <th className="px-6 py-3 font-medium">Check-out</th>
                    <th className="px-6 py-3 font-medium">Số giờ</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((shift) => (
                    <tr key={shift.id} className="border-b border-border/50 hover:bg-muted/5">
                      <td className="px-6 py-3">{formatDate(shift.date)}</td>
                      <td className="px-6 py-3 font-medium">{shift.staff_name}</td>
                      <td className="px-6 py-3">{formatTime(shift.clock_in)}</td>
                      <td className="px-6 py-3">
                        {shift.clock_out ? formatTime(shift.clock_out) : '--'}
                      </td>
                      <td className="px-6 py-3">{formatHours(shift.hours_worked)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-border">
                <p className="text-xs text-muted">
                  Trang {page} / {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Trước
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function ShiftsTab() {
  const { staff, fetchStaff } = useAdminStaffStore();
  const {
    todayShifts,
    historyShifts,
    loading,
    error,
    fetchToday,
    fetchHistory,
    clockIn,
    clockOut,
  } = useAdminShiftsStore();

  useEffect(() => {
    fetchStaff();
    fetchToday();
    fetchHistory();
  }, [fetchStaff, fetchToday, fetchHistory]);

  if (loading.today && todayShifts.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">
          {error}
        </div>
      )}

      <ActiveStaffRow staff={staff.filter((s) => s.isActive)} todayShifts={todayShifts} />

      <ClockInOutGrid
        staff={staff.filter((s) => s.isActive)}
        todayShifts={todayShifts}
        onClockIn={clockIn}
        onClockOut={clockOut}
        loading={loading}
      />

      <TodayShiftsTable shifts={todayShifts} loading={loading.today} />

      <ShiftHistoryTable shifts={historyShifts} loading={loading.history} />
    </div>
  );
}

/* ──────────────────────── Main Page ──────────────────────── */

export default function AdminStaffPage() {
  const [tab, setTab] = useState<StaffTab>('list');

  return (
    <>
      <HelmetHead
        title="Quản lý nhân viên — Staff Management — AURA CAFE"
        description="Quản lý nhân viên, ca làm việc và chấm công tại AURA CAFE. Staff management, shifts & timekeeping."
      />
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-muted/10 rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab('list')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'list'
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            Nhân viên
          </button>
          <button
            onClick={() => setTab('shifts')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'shifts'
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            Chấm công
          </button>
        </div>

        {tab === 'list' ? <StaffListTab /> : <ShiftsTab />}
      </div>
    </div>
    </>
  );
}
