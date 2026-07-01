export interface WelcomeCustomerData {
  name: string;
  loyalty_tier?: 'basic' | 'premium' | 'enterprise' | 'master';
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function renderWelcome(customer: WelcomeCustomerData): string {
  const tierLabels: Record<string, string> = { basic: 'Thành viên', premium: 'Premium', enterprise: 'Enterprise', master: 'Master' };
  const tierLabel = tierLabels[customer.loyalty_tier || ''] || 'Thành viên';

  return `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0A1A2E;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden">
    <tr style="background:#1A2D1F">
      <td style="padding:24px;text-align:center">
        <h1 style="color:#A8C5A0;margin:0;font-size:24px">AURA CAFE</h1>
        <p style="color:#C9D6DF;margin:4px 0 0;font-size:14px">Chào mừng đến với AURA!</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px">
        <h2 style="color:#0A1A2E;font-size:18px;margin:0 0 8px">Xin chào ${escapeHtml(customer.name) || 'bạn'}!</h2>
        <p style="color:#333;font-size:15px;line-height:1.6">
          Cảm ơn bạn đã đăng ký tài khoản tại <strong>AURA CAFE</strong> — không gian cà phê container industrial-luxury giữa lòng Sa Đéc.
        </p>
        <p style="color:#333;font-size:15px;line-height:1.6">
          Hạng thành viên hiện tại: <strong style="color:#3A6B80">${tierLabel}</strong>
        </p>

        <div style="background:#f5f7fa;border-radius:6px;padding:16px;margin:16px 0">
          <p style="margin:0 0 8px;font-weight:bold;color:#0A1A2E;font-size:14px">🎁 Quyền lợi của bạn:</p>
          <ul style="margin:0;padding-left:20px;color:#555;font-size:13px;line-height:1.8">
            <li>Tích điểm mỗi lần mua hàng</li>
            <li>Cashback lên đến 10% cho hạng Platinum</li>
            <li>Giảm giá sinh nhật</li>
            <li>Giới thiệu bạn bè — nhận 30% hoa hồng</li>
          </ul>
        </div>

        <p style="color:#666;font-size:14px">Ghé AURA Cafe ngay hôm nay để nhận ưu đãi chào mừng!</p>
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
