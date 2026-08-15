import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useAdminReservationsStore, type AdminReservation } from '@/hooks/stores/admin/use-admin-reservations-store';

type FilterValue = 'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed';

const FILTER_KEYS: Record<FilterValue, string> = {
  all: 'adminReservations.filterAll',
  pending: 'adminReservations.filterPending',
  confirmed: 'adminReservations.filterConfirmed',
  cancelled: 'adminReservations.filterCancelled',
  completed: 'adminReservations.filterCompleted',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  confirmed: 'bg-green-500/10 text-green-600 border-green-500/20',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
  completed: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
};

function ReservationCard({
  reservation: r,
  processing,
  onApprove,
  onReject,
  t,
}: {
  reservation: AdminReservation;
  processing: boolean;
  onApprove: () => void;
  onReject: () => void;
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
  const { reservations, loading, error, fetchReservations, approveReservation, rejectReservation } = useAdminReservationsStore();
  const [filter, setFilter] = useState<FilterValue>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

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

  const filterValues: FilterValue[] = ['all', 'pending', 'confirmed', 'cancelled', 'completed'];

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
