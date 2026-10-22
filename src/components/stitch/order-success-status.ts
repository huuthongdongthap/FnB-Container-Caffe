/** Presentation follows the server state; a provider return URL is never proof of payment. */
export function orderSuccessStatus(status = 'pending', paymentStatus = 'pending', paymentMethod?: string) {
  const labels: Record<string, [string, number]> = {
    pending: ['Đã nhận đơn', 0], confirmed: ['Đã xác nhận', 0], preparing: ['Đang pha chế', 50],
    ready: ['Sẵn sàng nhận món', 100], served: ['Đã phục vụ', 100], delivered: ['Đã giao', 100],
    completed: ['Đã hoàn tất', 100], cancelled: ['Đơn đã hủy', 0], failed: ['Đơn không thành công', 0],
    expired: ['Đơn đã hết hạn', 0], refunded: ['Đã hoàn tiền', 0],
  };
  const paid = paymentStatus === 'paid' || paymentStatus === 'completed';
  const voided = ['cancelled', 'failed', 'expired', 'refunded'].includes(status);
  const awaitingPayment = !voided && paymentMethod === 'payos' && !paid;
  const [label, progress] = awaitingPayment ? ['Chờ thanh toán PayOS', 0] : labels[status] ?? ['Đang cập nhật đơn', 0];
  const paymentLabel = paid ? 'Đã thanh toán'
    : paymentStatus === 'refunded' ? 'Đã hoàn tiền'
    : paymentStatus === 'partially_refunded' ? 'Đã hoàn tiền một phần'
    : paymentStatus === 'failed' ? 'Thanh toán không thành công'
    : paymentStatus === 'cancelled' ? 'Thanh toán đã hủy'
    : paymentMethod === 'cod' || paymentStatus === 'cod_pending' ? 'COD — chưa thu tiền'
    : 'Chưa xác nhận thanh toán';
  return { label, progress, paymentLabel, activeStep: voided || awaitingPayment ? -1 : progress / 50, voided, awaitingPayment };
}
