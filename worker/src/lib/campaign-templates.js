/**
 * Campaign Templates — Vietnamese marketing message templates
 *
 * Three template types for Mautic campaign automation:
 * - winbackTemplate: Re-engage lapsed customers
 * - birthdayTemplate: Birthday wishes with tier-based discount
 * - promoTemplate: General promotional campaigns
 *
 * Each returns { subject, html, sms } for multi-channel (email + SMS) sending.
 * All content in Vietnamese UTF-8 for AURA CAFE customers.
 */

/**
 * Winback template — re-engage customers who haven't visited recently.
 * @param {string} name — Customer name
 * @returns {{ subject: string, html: string, sms: string }}
 */
export function winbackTemplate(name) {
  const safeName = name || 'bạn';
  const subject = `AURA CAFE — Chúng tôi nhớ bạn, ${safeName}!`;

  const html = `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <h1 style="color:#8B4513;">AURA CAFE</h1>
  <p>Chào ${safeName},</p>
  <p>Đã lâu rồi bạn không ghé quán! Chúng tôi nhớ bạn và muốn dành tặng bạn một ưu đãi đặc biệt.</p>
  <p>Hãy đến AURA CAFE để thưởng thức ly cà phê yêu thích nhé!</p>
  <p>— Đội ngũ AURA CAFE</p>
</body>
</html>`;

  const sms = `Aura Cafe nho ${safeName}! Tang ban voucher 20% cho lan tiep theo. Den Aura Cafe huong ly cafe yeu thich nhe! 🎉`;

  return { subject, html, sms };
}

/**
 * Birthday template — send birthday wishes with tier-based discount.
 * @param {string} name — Customer name
 * @param {string} [tier] — Customer loyalty tier
 * @param {number} [discountPct] — Discount percentage (default 15)
 * @returns {{ subject: string, html: string, sms: string }}
 */
export function birthdayTemplate(name, tier, discountPct) {
  const safeName = name || 'bạn';
  const pct = discountPct || 15;
  const subject = `🎂 Chúc Mừng Sinh Nhật, ${safeName}!`;

  const html = `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <h1 style="color:#8B4513;">AURA CAFE</h1>
  <p>🎂 Chúc mừng sinh nhật ${safeName}!</p>
  <p>Nhân dịp sinh nhật của bạn, AURA CAFE dành tặng bạn <strong>${pct}% giảm giá</strong> cho tất cả các loại đồ uống.</p>
  <p>Hãy mang theo bạn bè đến AURA CAFE để tổ chức sinh nhật thật vui vẻ nhé!</p>
  <p>— Đội ngũ AURA CAFE</p>
</body>
</html>`;

  const sms = `Aura Cafe chuc mung sinh nhat ${safeName}! Uu dai ${pct}% danh cho ban. Den Aura Cafe nhan qua sinh nhat ngay hom nay! 🎂🎉`;

  return { subject, html, sms };
}

/**
 * Promo template — general promotional campaign message.
 * @param {string} name — Customer name
 * @param {string} promoTitle — Promotion title
 * @param {string} promoDesc — Promotion description
 * @returns {{ subject: string, html: string, sms: string }}
 */
export function promoTemplate(name, promoTitle, promoDesc) {
  const safeName = name || 'bạn';
  const title = promoTitle || 'Khuyến mãi đặc biệt';
  const desc = promoDesc || '';

  const subject = `AURA CAFE — ${title}`;

  const descHtml = desc ? `<p>${desc}</p>` : '';

  const html = `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <h1 style="color:#8B4513;">AURA CAFE</h1>
  <p>Chào ${safeName},</p>
  <p><strong>${title}</strong></p>
  ${descHtml}
  <p>Đừng bỏ lỡ cơ hội này! Ghé AURA CAFE ngay hôm nay.</p>
  <p>— Đội ngũ AURA CAFE</p>
</body>
</html>`;

  const smsDesc = desc ? ` — ${desc}` : '';
  const sms = `Aura Cafe: ${title}${smsDesc} 🎉`;

  return { subject, html, sms };
}
