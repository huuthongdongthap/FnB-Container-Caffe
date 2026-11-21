import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useAdminReservationsStore, type AdminReservation } from '@/hooks/stores/admin/use-admin-reservations-store';

type FilterValue = 'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'seated';

const FILTER_KEYS: Record<FilterValue, string> = {
  seated: 'Đã đón khách / Seated',
  all: 'adminReservations.filterAll',
  pending: 'adminReservations.filterPending',
  confirmed: 'adminReservations.filterConfirmed',
  cancelled: 'adminReservations.filterCancelled',
  completed: 'adminReservations.filterCompleted',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
  confirmed: 'bg-green-500/10 text-green-300 border-green-500/20',
  cancelled: 'bg-red-500/10 text-red-300 border-red-500/20',
  completed: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
};

function ReservationCard({
  reservation: r,
  processing,
  onApprove,
  onReject,
  onStatus,
  onEdit,
  t,
}: {
  reservation: AdminReservation;
  processing: boolean;
  onApprove: () => void;
  onReject: () => void;
  onStatus: (status: string) => void;
  onEdit: () => void;
  t: (key: string) => string;
}) {
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardBody className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-base">{r.customerName || t('adminReservations.guestPlaceholder')}</p>
            <p className="text-sm text-muted mt-1">
              {r.date} {r.time} — {r.guests} {t('adminReservations.guests')}
            </p>
            <p className="text-sm text-muted">{t('adminReservations.table')}: {r.tableNumber || t('adminReservations.notAssigned')}</p>
          </div>
          <Badge className={STATUS_COLORS[r.status] || ''}>
            {t(`adminReservations.status${r.status.charAt(0).toUpperCase() + r.status.slice(1)}`) || r.status}
          </Badge>
        </div>

        <p className="text-sm text-muted">{r.customerPhone} · {r.zone} · {r.id}</p>
        {r.notes && <p className="text-sm text-muted">{r.notes}</p>}
        {["pending", "confirmed", "approved"].includes(r.status) && <Button size="sm" variant="secondary" disabled={processing} onClick={onEdit}>Sửa / Edit</Button>}
        {["confirmed", "approved", "seated"].includes(r.status) && <div className="flex gap-2 mt-4">
          {r.status !== "seated" && <Button size="sm" disabled={processing} onClick={() => onStatus("seated")}>Đón khách / Seat</Button>}
          <Button size="sm" disabled={processing} onClick={() => onStatus("completed")}>Hoàn tất / Finish</Button>
          <Button size="sm" variant="secondary" disabled={processing} onClick={() => onStatus("cancelled")}>Hủy / Cancel</Button>
        </div>}
        {r.status === 'pending' && (
          <div className="flex gap-2 mt-4">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={processing} onClick={onApprove}>
              {processing ? '...' : t('adminReservations.confirmBtn')}
            </Button>
            <Button size="sm" variant="secondary" disabled={processing} onClick={onReject}>
              {processing ? '...' : t('adminReservations.rejectBtn')}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default function AdminReservationsPage() {
  const { t } = useTranslation();
  const { reservations, loading, error, fetchReservations, approveReservation, rejectReservation, updateReservation, changeStatus, offset = 0, hasNext = false } = useAdminReservationsStore();
  const [filter, setFilter] = useState<FilterValue>('all');
  const [date, setDate] = useState('');
  const [editing, setEditing] = useState<AdminReservation | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    void fetchReservations({ offset: 0, date, status: filter });
  }, [fetchReservations, date, filter]);

  const filtered = filter === 'all'
    ? reservations
    : reservations.filter((r) => r.status === filter);

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try { await approveReservation(id); } finally { setProcessingId(null); }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try { await rejectReservation(id); } finally { setProcessingId(null); }
  };

  const handleStatus = async (id: string, status: string) => {
    if (['cancelled', 'completed'].includes(status) && !window.confirm('Xác nhận thao tác? / Confirm action?')) return;
    setProcessingId(id);
    try { await changeStatus(id, status); } finally { setProcessingId(null); }
  };
  const filterValues: FilterValue[] = ['all', 'pending', 'confirmed', 'seated', 'cancelled', 'completed'];

  return (
    <>
      <HelmetHead
        title={`${t('adminReservations.title')} — AURA CAFE`}
        description={t('adminReservations.subtitle')}
      />
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-display font-bold">{t('adminReservations.title')}</h1>
            <div className="flex gap-2">
              {filterValues.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    filter === f ? 'bg-foreground text-background' : 'bg-muted/20 text-muted hover:bg-muted/30'
                  }`}
                >
                  {t(FILTER_KEYS[f])}
                </button>
              ))}
            </div>
          </div>

          <label>Ngày / Date <input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          {editing && <form onSubmit={async e => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setProcessingId(editing.id);
            try {
              if (await updateReservation(editing.id, {
                customer_name: String(data.get('name')), customer_phone: String(data.get('phone')), notes: String(data.get('notes')),
                date: String(data.get('date')), time: String(data.get('time')),
                guest_count: Number(data.get('guests')), table_id: String(data.get('table')),
              })) setEditing(null);
            } finally { setProcessingId(null); }
          }} className="space-y-3 my-4">
            <label>Họ tên / Name<input required maxLength={100} name="name" defaultValue={editing.customerName} /></label>
            <label>Điện thoại / Phone<input required minLength={8} maxLength={20} name="phone" defaultValue={editing.customerPhone} /></label>
            <label>Ghi chú / Notes<textarea maxLength={500} name="notes" defaultValue={editing.notes} /></label>
            <label>Ngày / Date<input required name="date" type="date" defaultValue={editing.date} /></label>
            <label>Giờ / Time<input required name="time" type="time" defaultValue={editing.time} /></label>
            <label>Số khách / Guests<input required name="guests" type="number" min="1" max="200" defaultValue={editing.guests} /></label>
            <label>Bàn / Table<input required name="table" defaultValue={editing.tableId || editing.tableNumber} /></label>
            <button type="submit" disabled={processingId !== null}>Lưu / Save</button>
            <button type="button" onClick={() => setEditing(null)}>Đóng / Close</button>
          </form>}
          <div className="flex gap-2 my-4">
            <Button disabled={loading || offset === 0} onClick={() => fetchReservations({ offset: Math.max(0, offset - 50), date, status: filter })}>Trước / Previous</Button>
            <span>{Math.floor(offset / 50) + 1}</span>
            <Button disabled={loading || !hasNext} onClick={() => fetchReservations({ offset: offset + 50, date, status: filter })}>Tiếp / Next</Button>
          </div>
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-sm text-muted">{t('common.loading')}</p>
            </div>
          )}

          {error && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardBody className="text-center py-8">
                <p className="text-sm text-destructive mb-2">{error}</p>
                <Button variant="secondary" size="sm" onClick={() => fetchReservations()}>{t('common.retry')}</Button>
              </CardBody>
            </Card>
          )}

          {!loading && !error && filtered.length === 0 && (
            <Card>
              <CardBody className="text-center py-12">
                <p className="text-sm text-muted">{t('adminReservations.emptyTitle')}</p>
              </CardBody>
            </Card>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="space-y-3">
              {filtered.map((r) => (
                <ReservationCard
                  key={r.id}
                  reservation={r}
                  processing={processingId === r.id}
                  onApprove={() => handleApprove(r.id)}
                  onReject={() => handleReject(r.id)}
                  onStatus={status => handleStatus(r.id, status)}
                  onEdit={() => setEditing(r)}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
