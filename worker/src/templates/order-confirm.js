/**
 * Order Confirmation Email Template
 *
 * @param {object} order
 * @param {string} order.id — Order ID
 * @param {Array<{name: string, qty: number, price: number}>} order.items
 * @param {number} order.total — Total amount (VND)
 * @param {string} order.payment_method — Payment method label
 * @returns {string} HTML email body
 */
export function renderOrderConfirm(order) {
  const fmt = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + '₫';

  const itemsHtml = (order.items || [])
    .map((i) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #e0e0e0">${i.name} × ${i.qty || 1}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e0e0e0;text-align:right">${fmt((i.price || 0) * (i.qty || 1))}</td>
      </tr>`)
    .join('');

  return `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0A1A2E;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden">
    <tr style="background:#0A1A2E">
      <td style="padding:24px;text-align:center">
        <h1 style="color:#C9D6DF;margin:0;font-size:24px">AURA CAFE</h1>
        <p style="color:#6B9FB8;margin:4px 0 0;font-size:14px">Xác Nhận Đơn Hàng</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px">
        <p style="color:#333;font-size:16px">Cảm ơn bạn đã đặt hàng tại AURA CAFE!</p>
        <p style="color:#666;font-size:14px;margin-bottom:16px">Mã đơn: <strong style="color:#0A1A2E">#${order.id}</strong></p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
          <thead>
            <tr style="background:#f5f5f5">
              <th style="padding:8px;text-align:left;font-size:13px">Món</th>
              <th style="padding:8px;text-align:right;font-size:13px">Thành tiền</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
          <tfoot>
            <tr>
              <td style="padding:12px 8px 0;font-weight:bold;font-size:15px">Tổng cộng</td>
              <td style="padding:12px 8px 0;font-weight:bold;font-size:15px;text-align:right;color:#0A1A2E">${fmt(order.total || 0)}</td>
            </tr>
          </tfoot>
        </table>

        <p style="color:#666;font-size:13px">Thanh toán: ${order.payment_method || 'COD'}</p>
        <p style="color:#999;font-size:12px;margin-top:16px">Nếu có thắc mắc, vui lòng liên hệ qua Zalo hoặc gọi 0912 345 678.</p>
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
