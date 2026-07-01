import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { useAdminReservationsStore, type AdminReservation } from '@/hooks/stores/admin/use-admin-reservations-store';

type FilterValue = 'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed';

export default function AdminReservationsPage() {
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
    try {
      await approveReservation(id);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      await rejectReservation(id);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-display font-bold">Quản lý đặt bàn</h1>
          <div className="flex gap-2">
            {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-primary text-white'
                    : 'bg-white border border-border text-muted hover:bg-gray-50'
                }`}
              >
                {f === 'all' ? 'Tất cả' : f === 'pending' ? 'Chờ duyệt' : f === 'confirmed' ? 'Đã xác nhận' : f === 'completed' ? 'Hoàn thành' : 'Đã hủy'}
              </button>
            ))}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">
            {error}
            <button onClick={fetchReservations} className="ml-3 underline hover:no-underline">
              Thử lại
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && reservations.length === 0 ? (
          <div className="text-center py-12 text-muted text-sm">Đang tải...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted text-sm">
                Không có đặt bàn nào
              </div>
            ) : (
              filtered.map((reservation) => (
                <ReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  isProcessing={processingId === reservation.id}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ReservationCard({
  reservation,
  isProcessing,
  onApprove,
  onReject,
}: {
  reservation: AdminReservation;
  isProcessing: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">{reservation.customerName}</h3>
          <Badge
            variant={
              reservation.status === 'confirmed'
                ? 'info'
                : reservation.status === 'completed'
                  ? 'success'
                  : reservation.status === 'pending'
                    ? 'warning'
                    : 'destructive'
            }
          >
            {reservation.status === 'pending'
              ? 'Chờ duyệt'
              : reservation.status === 'confirmed'
                ? 'Đã xác nhận'
                : reservation.status === 'completed'
                  ? 'Hoàn thành'
                  : 'Đã hủy'}
          </Badge>
        </div>
      </CardHeader>
      <CardBody>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">SĐT:</span>
            <span className="font-mono text-xs">{reservation.customerPhone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Bàn:</span>
            <span>#{reservation.tableNumber} ({reservation.zone})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Ngày:</span>
            <span>{new Date(reservation.date + 'T00:00:00').toLocaleDateString('vi-VN')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Giờ:</span>
            <span>{reservation.time}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Khách:</span>
            <span>{reservation.guests} người</span>
          </div>
        </div>

        {(reservation.status === 'pending' || reservation.status === 'confirmed') && (
          <div className="mt-4 pt-3 border-t border-border flex gap-2">
            {reservation.status === 'pending' && (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  disabled={isProcessing}
                  onClick={() => onReject(reservation.id)}
                >
                  {isProcessing ? '...' : 'Từ chối'}
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={isProcessing}
                  onClick={() => onApprove(reservation.id)}
                >
                  {isProcessing ? '...' : 'Duyệt'}
                </Button>
              </>
            )}
            {reservation.status === 'confirmed' && (
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                disabled={isProcessing}
                onClick={() => onReject(reservation.id)}
              >
                {isProcessing ? '...' : 'Huỷ đặt bàn'}
              </Button>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
