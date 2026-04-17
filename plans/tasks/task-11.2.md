# Task 11.2 — Fix Loyalty Page CSS (Vite Build Issue)

## Bug
Trang `/loyalty` bị mất toàn bộ CSS trên Production. 
Nguyên nhân: Vite build KHÔNG bundle được 3 file CSS vì chúng dùng `preload` trick thay vì `<link rel="stylesheet">` trực tiếp.

## Các file CSS bị mất trong dist:
- `css/styles.css` (global)
- `css/loyalty-styles.css` (loyalty page)
- `css/loyalty-m3.css` (M3 theme)
- `css/premium-upgrade.css` (premium UI)

## Fix: loyalty.html lines 131-135

Thay đổi từ `preload` sang `stylesheet` trực tiếp để Vite nhận diện được:

```html
<!-- THAY THẾ (dòng 131-135): -->
<link rel="preload" href="css/styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<link rel="preload" href="css/loyalty-styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<link rel="preload" href="css/loyalty-m3.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="css/styles.css"><link rel="stylesheet" href="css/loyalty-styles.css"><link rel="stylesheet" href="css/loyalty-m3.css"></noscript>
<link rel="stylesheet" href="css/premium-upgrade.css">

<!-- BẰNG: -->
<link rel="stylesheet" href="css/styles.css">
<link rel="stylesheet" href="css/loyalty-styles.css">
<link rel="stylesheet" href="css/loyalty-m3.css">
<link rel="stylesheet" href="css/premium-upgrade.css">
```

## QUAN TRỌNG: Kiểm tra TẤT CẢ các trang khác
Grep toàn bộ project xem trang nào dùng pattern `preload` tương tự:
```bash
grep -r 'rel="preload".*as="style"' *.html --include="*.html" -l
```
Áp dụng fix tương tự cho toàn bộ.

## Deploy
```bash
npm run build
cd worker && npx wrangler deploy
cd .. && npx wrangler pages deploy dist --project-name=fnb-caffe-container
```

## Verify
- [ ] `https://fnb-caffe-container.pages.dev/loyalty` — CSS load đầy đủ, giao diện Cyber-Glass hiện đúng
- [ ] `https://fnb-caffe-container.pages.dev/` — Trang chủ vẫn OK
- [ ] `https://fnb-caffe-container.pages.dev/menu` — Menu vẫn OK
- [ ] `https://fnb-caffe-container.pages.dev/dashboard/admin` — Admin tabs SPA hoạt động
