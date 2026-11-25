import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { apiFetch } from '@/lib/api-client';
import { useAdminReservationsStore, type AdminReservation } from '@/hooks/stores/admin/use-admin-reservations-store';

type FilterValue = 'all' | 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'completed' | 'no_show';

interface TableOption {
  id: string;
  table_number: string | number;
  zone: string;
  capacity?: number;
  status?: string;
  is_active?: number | boolean;
}

const INACTIVE_TABLE_STATUS_SET = new Set(['maintenance', 'out_of_order', 'outoforder', 'disabled', 'inactive']);
const ACTIVE_RESERVATION_STATUS_SET = new Set(['pending', 'confirmed', 'approved', 'seated']);

function parseHHMMToMinutes(val?: string | null): number | null {
  if (!val) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(val.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function filterCandidateTablesForSlot(
  tables: TableOption[],
  reservations: AdminReservation[],
  slotDate: string,
  slotTime: string,
  guestCount: number,
  excludeReservationId?: string,
  preserveTableId?: string,
): TableOption[] {
  const slotMinutes = parseHHMMToMinutes(slotTime);
  const reqGuests = Number.isFinite(guestCount) && guestCount > 0 ? guestCount : 1;

  return tables.filter((tb) => {
    if (preserveTableId && (tb.id === preserveTableId || String(tb.table_number) === preserveTableId)) {
      return true;
    }
    const statusLower = String(tb.status || 'available').trim().toLowerCase();
    if (INACTIVE_TABLE_STATUS_SET.has(statusLower)) return false;
    if (tb.is_active === 0 || tb.is_active === false) return false;
    const cap = typeof tb.capacity === 'number' && Number.isFinite(tb.capacity) ? tb.capacity : 4;
    if (cap < reqGuests) return false;

    if (slotDate && slotMinutes !== null) {
      const hasOverlap = reservations.some((r) => {
        if (excludeReservationId && r.id === excludeReservationId) return false;
        if (!ACTIVE_RESERVATION_STATUS_SET.has(r.status)) return false;
        if (r.date !== slotDate) return false;
        const matchesTable = r.tableId === tb.id || String(r.tableNumber) === String(tb.table_number);
        if (!matchesTable) return false;
        const rMin = parseHHMMToMinutes(r.time);
        if (rMin === null) return r.time === slotTime;
        return Math.abs(slotMinutes - rMin) < 90;
      });
      if (hasOverlap) return false;
    }
    return true;
  });
}

const FILTER_KEYS: Record<FilterValue, string> = {
  all: 'adminReservations.filterAll',
  pending: 'adminReservations.filterPending',
  confirmed: 'adminReservations.filterConfirmed',
  seated: 'adminReservations.filterSeated',
  cancelled: 'adminReservations.filterCancelled',
  completed: 'adminReservations.filterCompleted',
  no_show: 'adminReservations.filterNoShow',
};

const STATUS_KEYS: Record<string, string> = {
  pending: 'adminReservations.statusPending',
  confirmed: 'adminReservations.statusConfirmed',
  approved: 'adminReservations.statusApproved',
  seated: 'adminReservations.statusSeated',
  cancelled: 'adminReservations.statusCancelled',
  rejected: 'adminReservations.statusRejected',
  no_show: 'adminReservations.statusNoShow',
  completed: 'adminReservations.statusCompleted',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
  confirmed: 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30',
  approved: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  seated: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  cancelled: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  rejected: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  no_show: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  completed: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
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
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const statusKey = STATUS_KEYS[r.status] || '';
  const statusText = statusKey ? t(statusKey, { defaultValue: r.status }) : r.status;
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
            {statusText}
          </Badge>
        </div>

        <p className="text-sm text-muted mt-1">{r.customerPhone} · {r.zone} · {r.id}</p>
        {r.notes && <p className="text-sm text-muted mt-1">{r.notes}</p>}
        <div className="flex flex-wrap gap-2 mt-4">
          {['pending', 'confirmed', 'approved'].includes(r.status) && (
            <Button size="sm" variant="secondary" disabled={processing} onClick={onEdit}>
              {t('adminReservations.editBtn')}
            </Button>
          )}
          {['confirmed', 'approved'].includes(r.status) && (
            <>
              <Button size="sm" disabled={processing} onClick={() => onStatus('seated')}>
                {t('adminReservations.seatBtn')}
              </Button>
              <Button size="sm" variant="secondary" disabled={processing} onClick={() => onStatus('no_show')}>
                {t('adminReservations.noShowBtn')}
              </Button>
              <Button size="sm" variant="secondary" disabled={processing} onClick={() => onStatus('cancelled')}>
                {t('adminReservations.cancelBtn')}
              </Button>
            </>
          )}
          {r.status === 'seated' && (
            <>
              <Button size="sm" disabled={processing} onClick={() => onStatus('completed')}>
                {t('adminReservations.finishBtn')}
              </Button>
              <Button size="sm" variant="secondary" disabled={processing} onClick={() => onStatus('cancelled')}>
                {t('adminReservations.cancelBtn')}
              </Button>
            </>
          )}
          {r.status === 'pending' && (
            <>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={processing} onClick={onApprove}>
                {processing ? '...' : t('adminReservations.confirmBtn')}
              </Button>
              <Button size="sm" variant="secondary" disabled={processing} onClick={onReject}>
                {processing ? '...' : t('adminReservations.rejectBtn')}
              </Button>
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

export default function AdminReservationsPage() {
  const { t } = useTranslation();
  const { reservations, loading, error, fetchReservations, approveReservation, rejectReservation, updateReservation, changeStatus, offset = 0, hasNext = false } = useAdminReservationsStore();
  const [filter, setFilter] = useState<FilterValue>('all');
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [editing, setEditing] = useState<AdminReservation | null>(null);
  const [creating, setCreating] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tables, setTables] = useState<TableOption[]>([]);

  const defaultBookingDate = useMemo(
    () => date || new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10),
    [date],
  );
  const [createGuests, setCreateGuests] = useState<number>(2);
  const [createDate, setCreateDate] = useState<string>(defaultBookingDate);
  const [createTime, setCreateTime] = useState<string>('19:00');

  const [editGuests, setEditGuests] = useState<number>(2);
  const [editDate, setEditDate] = useState<string>('');
  const [editTime, setEditTime] = useState<string>('19:00');

  useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      setDebouncedSearch('');
      return;
    }
    const timer = setTimeout(() => setDebouncedSearch(trimmed), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const loadTables = useCallback(async () => {
    try {
      const res = await apiFetch<{ success?: boolean; data?: TableOption[] }>('/api/tables');
      if (Array.isArray(res?.data)) setTables(res.data);
    } catch {
      /* ignore table load errors */
    }
  }, []);

  useEffect(() => {
    if (debouncedSearch) {
      void fetchReservations({ offset: 0, date, status: filter, search: debouncedSearch });
    } else {
      void fetchReservations({ offset: 0, date, status: filter });
    }
  }, [fetchReservations, date, filter, debouncedSearch]);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  const createTableOptions = useMemo(
    () => filterCandidateTablesForSlot(tables, reservations, createDate, createTime, createGuests),
    [tables, reservations, createDate, createTime, createGuests],
  );
  const editTableOptions = useMemo(
    () =>
      editing
        ? filterCandidateTablesForSlot(
            tables,
            reservations,
            editDate || editing.date,
            editTime || editing.time,
            editGuests || editing.guests,
            editing.id,
            editing.tableId || editing.tableNumber,
          )
        : [],
    [tables, reservations, editing, editDate, editTime, editGuests],
  );

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = reservations.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (!normalizedSearch) return true;
    return (
      String(r.customerName || '').toLowerCase().includes(normalizedSearch) ||
      String(r.customerPhone || '').toLowerCase().includes(normalizedSearch) ||
      String(r.id || '').toLowerCase().includes(normalizedSearch)
    );
  });

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    setActionError(null);
    try {
      await approveReservation(id);
      const storeErr = useAdminReservationsStore.getState().error;
      if (storeErr) setActionError(storeErr);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve reservation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    setActionError(null);
    try {
      await rejectReservation(id);
      const storeErr = useAdminReservationsStore.getState().error;
      if (storeErr) setActionError(storeErr);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reject reservation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleStatus = async (id: string, status: string) => {
    if (['cancelled', 'completed', 'no_show'].includes(status) && !window.confirm(t('adminReservations.confirmAction'))) return;
    setProcessingId(id);
    setActionError(null);
    try {
      const ok = await changeStatus(id, status);
      if (!ok) {
        const storeErr = useAdminReservationsStore.getState().error;
        setActionError(storeErr || 'Failed to update reservation status');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update reservation status');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setProcessingId('CREATE');
    setActionError(null);
    try {
      const res = await apiFetch<{ success?: boolean; error?: string }>('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: String(data.get('name') || '').trim(),
          customer_phone: String(data.get('phone') || '').trim(),
          date: String(data.get('date') || ''),
          time: String(data.get('time') || ''),
          guest_count: Number(data.get('guests') || 2),
          table_id: String(data.get('table') || ''),
          notes: String(data.get('notes') || '').trim() || undefined,
        }),
      });
      if (res?.success === false) {
        throw new Error(res.error || 'Failed to create reservation');
      }
      setCreating(false);
      await fetchReservations({ offset: 0, date, status: filter, ...(debouncedSearch ? { search: debouncedSearch } : {}) });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create reservation');
    } finally {
      setProcessingId(null);
    }
  };

  const filterValues: FilterValue[] = ['all', 'pending', 'confirmed', 'seated', 'no_show', 'cancelled', 'completed'];

  return (
    <>
      <HelmetHead
        title={t('adminReservations.title')}
        description={t('adminReservations.subtitle')}
      />
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h1 className="text-2xl font-display font-bold">{t('adminReservations.title')}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setCreateGuests(2);
                  setCreateDate(defaultBookingDate);
                  setCreateTime('19:00');
                  setCreating(true);
                  setEditing(null);
                  setActionError(null);
                }}
              >
                {t('adminReservations.createBtn')}
              </Button>
              {filterValues.map((f) => (
                <button
                  key={f}
                  type="button"
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

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('adminReservations.searchPlaceholder')}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm min-w-[240px]"
            />
            <label className="flex items-center gap-2 text-sm">
              <span>{t('adminReservations.dateLabel')}</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              />
            </label>
          </div>

          {actionError && (
            <div role="alert" className="mb-4 flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              <span>{actionError}</span>
              <button type="button" className="underline ml-4" onClick={() => setActionError(null)}>
                {t('adminReservations.closeBtn')}
              </button>
            </div>
          )}

          {creating && (
            <Card className="mb-6">
              <CardBody className="p-5">
                <h2 className="text-lg font-semibold mb-4">{t('adminReservations.createTitle')}</h2>
                <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('adminReservations.nameLabel')}</span>
                    <input required maxLength={100} name="name" className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm" />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('adminReservations.phoneLabel')}</span>
                    <input required minLength={8} maxLength={20} name="phone" className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm" />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('adminReservations.guestsLabel')}</span>
                    <input
                      required
                      name="guests"
                      type="number"
                      min="1"
                      max="200"
                      value={createGuests}
                      onChange={(e) => setCreateGuests(Math.max(1, Number(e.target.value) || 1))}
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('adminReservations.dateLabel')}</span>
                    <input
                      required
                      name="date"
                      type="date"
                      value={createDate}
                      onChange={(e) => setCreateDate(e.target.value)}
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('adminReservations.timeLabel')}</span>
                    <input
                      required
                      name="time"
                      type="time"
                      value={createTime}
                      onChange={(e) => setCreateTime(e.target.value)}
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('adminReservations.table')}</span>
                    {tables.length > 0 ? (
                      <select required name="table" className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
                        {createTableOptions.length === 0 && (
                          <option value="">{t('adminReservations.notAssigned')}</option>
                        )}
                        {createTableOptions.map((tb) => (
                          <option key={tb.id} value={tb.id}>
                            {t('adminReservations.table')} {tb.table_number} — {tb.zone} ({tb.capacity ?? 4} {t('adminReservations.guests')})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input required name="table" className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm" />
                    )}
                  </label>
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2 lg:col-span-3">
                    <span>{t('adminReservations.notesLabel')}</span>
                    <textarea maxLength={500} name="notes" rows={2} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm" />
                  </label>
                  <div className="sm:col-span-2 lg:col-span-3 flex gap-2 pt-2">
                    <Button type="submit" size="sm" disabled={processingId !== null}>{t('adminReservations.saveBtn')}</Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setCreating(false)}>{t('adminReservations.closeBtn')}</Button>
                  </div>
                </form>
              </CardBody>
            </Card>
          )}

          {editing && (
            <Card key={editing.id} className="mb-6">
              <CardBody className="p-5">
                <h2 className="text-lg font-semibold mb-4">{t('adminReservations.editTitle')}</h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    setProcessingId(editing.id);
                    setActionError(null);
                    try {
                      const ok = await updateReservation(editing.id, {
                        customer_name: String(data.get('name')),
                        customer_phone: String(data.get('phone')),
                        notes: String(data.get('notes')),
                        date: String(data.get('date')),
                        time: String(data.get('time')),
                        guest_count: Number(data.get('guests')),
                        table_id: String(data.get('table')),
                      });
                      if (ok) {
                        setEditing(null);
                      } else {
                        const storeErr = useAdminReservationsStore.getState().error;
                        setActionError(storeErr || 'Failed to update reservation');
                      }
                    } catch (err) {
                      setActionError(err instanceof Error ? err.message : 'Failed to update reservation');
                    } finally {
                      setProcessingId(null);
                    }
                  }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                >
                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('adminReservations.nameLabel')}</span>
                    <input required maxLength={100} name="name" defaultValue={editing.customerName} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm" />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('adminReservations.phoneLabel')}</span>
                    <input required minLength={8} maxLength={20} name="phone" defaultValue={editing.customerPhone} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm" />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('adminReservations.guestsLabel')}</span>
                    <input
                      required
                      name="guests"
                      type="number"
                      min="1"
                      max="200"
                      value={editGuests}
                      onChange={(e) => setEditGuests(Math.max(1, Number(e.target.value) || 1))}
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('adminReservations.dateLabel')}</span>
                    <input
                      required
                      name="date"
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('adminReservations.timeLabel')}</span>
                    <input
                      required
                      name="time"
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('adminReservations.table')}</span>
                    {tables.length > 0 ? (
                      <select required name="table" defaultValue={editing.tableId || editing.tableNumber} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
                        {editTableOptions.map((tb) => (
                          <option key={tb.id} value={tb.id}>
                            {t('adminReservations.table')} {tb.table_number} — {tb.zone} ({tb.capacity ?? 4} {t('adminReservations.guests')})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input required name="table" defaultValue={editing.tableId || editing.tableNumber} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm" />
                    )}
                  </label>
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2 lg:col-span-3">
                    <span>{t('adminReservations.notesLabel')}</span>
                    <textarea maxLength={500} name="notes" rows={2} defaultValue={editing.notes} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm" />
                  </label>
                  <div className="sm:col-span-2 lg:col-span-3 flex gap-2 pt-2">
                    <Button type="submit" size="sm" disabled={processingId !== null}>{t('adminReservations.saveBtn')}</Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(null)}>{t('adminReservations.closeBtn')}</Button>
                  </div>
                </form>
              </CardBody>
            </Card>
          )}

          <div className="flex items-center gap-2 my-4">
            <Button size="sm" variant="secondary" disabled={loading || offset === 0} onClick={() => fetchReservations({ offset: Math.max(0, offset - 50), date, status: filter, ...(debouncedSearch ? { search: debouncedSearch } : {}) })}>
              {t('adminReservations.previousBtn')}
            </Button>
            <span className="text-sm px-2">{Math.floor(offset / 50) + 1}</span>
            <Button size="sm" variant="secondary" disabled={loading || !hasNext} onClick={() => fetchReservations({ offset: offset + 50, date, status: filter, ...(debouncedSearch ? { search: debouncedSearch } : {}) })}>
              {t('adminReservations.nextBtn')}
            </Button>
          </div>
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-sm text-muted">{t('common.loading')}</p>
            </div>
          )}

          {error && reservations.length === 0 && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardBody className="text-center py-8">
                <p className="text-sm text-destructive mb-2">{error}</p>
                <Button variant="secondary" size="sm" onClick={() => fetchReservations()}>{t('common.retry')}</Button>
              </CardBody>
            </Card>
          )}

          {!loading && !(error && reservations.length === 0) && filtered.length === 0 && (
            <Card>
              <CardBody className="text-center py-12">
                <p className="text-sm text-muted">{t('adminReservations.emptyTitle')}</p>
              </CardBody>
            </Card>
          )}

          {!loading && filtered.length > 0 && (
            <div className="space-y-3">
              {filtered.map((r) => (
                <ReservationCard
                  key={r.id}
                  reservation={r}
                  processing={processingId === r.id}
                  onApprove={() => handleApprove(r.id)}
                  onReject={() => handleReject(r.id)}
                  onStatus={(status) => handleStatus(r.id, status)}
                  onEdit={() => {
                    setEditGuests(r.guests);
                    setEditDate(r.date);
                    setEditTime(r.time);
                    setEditing(r);
                    setCreating(false);
                    setActionError(null);
                  }}
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
