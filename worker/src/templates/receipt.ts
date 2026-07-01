export interface ReceiptData {
  id: string;
  total: number;
  payment_method: string;
  payment_time?: string;
}

export function renderReceipt(order: ReceiptData): string {
  const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + '₫';
  const paidAt = order.payment_time
    ? new Date(order.payment_time).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    : 'Vừa xong';

  return `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0A1A2E;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden">
    <tr style="background:#1A2A4E">
      <td style="padding:24px;text-align:center">
        <h1 style="color:#C9D6DF;margin:0;font-size:24px">AURA CAFE</h1>
        <p style="color:#4A7C59;margin:4px 0 0;font-size:14px;font-weight:bold">✓ Thanh Toán Thành Công</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px">
        <p style="color:#333;font-size:16px">Biên nhận thanh toán đơn hàng <strong>#${order.id}</strong></p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:6px;padding:16px;margin:16px 0">
          <tr><td style="padding:4px 0;color:#666;font-size:13px">Tổng tiền</td><td style="padding:4px 0;text-align:right;font-weight:bold;font-size:18px;color:#0A1A2E">${fmt(order.total || 0)}</td></tr>
          <tr><td style="padding:4px 0;color:#666;font-size:13px">Phương thức</td><td style="padding:4px 0;text-align:right;font-size:13px">${order.payment_method || '—'}</td></tr>
          <tr><td style="padding:4px 0;color:#666;font-size:13px">Thời gian</td><td style="padding:4px 0;text-align:right;font-size:13px">${paidAt}</td></tr>
        </table>

        <p style="color:#999;font-size:12px;margin-top:16px">Cảm ơn bạn đã ủng hộ AURA CAFE. Hẹn gặp lại!</p>
      </td>
    </tr>
    <tr style="background:#f5f5f5">
      <td style="padding:16px;text-align:center">
        <p style="color:#999;font-size:11px;margin:0">AURA CAFE — Sa Đéc, Đồng Tháp<br>Where Flavor Meets Design</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
