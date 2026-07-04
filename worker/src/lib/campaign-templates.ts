/**
 * Campaign Templates — Vietnamese marketing message templates
 */

export interface CampaignTemplate {
  subject: string;
  html: string;
  sms: string;
}

export function winbackTemplate(name?: string, locale: 'vi' | 'en' = 'vi'): CampaignTemplate {
  const safeName = name || (locale === 'en' ? 'you' : 'bạn');

  if (locale === 'en') {
    const subject = `AURA CAFE — We miss you, ${safeName}!`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <h1 style="color:#8B4513;">AURA CAFE</h1>
  <p>Hi ${safeName},</p>
  <p>It's been a while since your last visit! We miss you and want to offer you a special deal.</p>
  <p>Come to AURA CAFE and enjoy your favorite coffee!</p>
  <p>— AURA CAFE Team</p>
</body>
</html>`;

    const sms = `Aura Cafe misses ${safeName}! Here's a 20% voucher for your next visit. Enjoy your favorite coffee! 🎉`;

    return { subject, html, sms };
  }

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

export function birthdayTemplate(name?: string, tier?: string, discountPct?: number, locale: 'vi' | 'en' = 'vi'): CampaignTemplate {
  const safeName = name || (locale === 'en' ? 'you' : 'bạn');
  const pct = discountPct || 15;

  if (locale === 'en') {
    const subject = `🎂 Happy Birthday, ${safeName}!`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <h1 style="color:#8B4513;">AURA CAFE</h1>
  <p>🎂 Happy Birthday ${safeName}!</p>
  <p>On your special day, AURA CAFE gives you <strong>${pct}% off</strong> on all beverages.</p>
  <p>Bring your friends to AURA CAFE and celebrate your birthday with us!</p>
  <p>— AURA CAFE Team</p>
</body>
</html>`;

    const sms = `Aura Cafe wishes ${safeName} a happy birthday! Enjoy ${pct}% off today. Come celebrate with us! 🎂🎉`;

    return { subject, html, sms };
  }

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

export function promoTemplate(name?: string, promoTitle?: string, promoDesc?: string, locale: 'vi' | 'en' = 'vi'): CampaignTemplate {
  const safeName = name || (locale === 'en' ? 'you' : 'bạn');
  const title = promoTitle || (locale === 'en' ? 'Special Promotion' : 'Khuyến mãi đặc biệt');
  const desc = promoDesc || '';

  if (locale === 'en') {
    const subject = `AURA CAFE — ${title}`;

    const descHtml = desc ? `<p>${desc}</p>` : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <h1 style="color:#8B4513;">AURA CAFE</h1>
  <p>Hi ${safeName},</p>
  <p><strong>${title}</strong></p>
  ${descHtml}
  <p>Don't miss out! Visit AURA CAFE today.</p>
  <p>— AURA CAFE Team</p>
</body>
</html>`;

    const sms = desc ? `Aura Cafe: ${title} — ${desc} 🎉` : `Aura Cafe: ${title} 🎉`;

    return { subject, html, sms };
  }

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

  const sms = desc ? `Aura Cafe: ${title} — ${desc} 🎉` : `Aura Cafe: ${title} 🎉`;

  return { subject, html, sms };
}
