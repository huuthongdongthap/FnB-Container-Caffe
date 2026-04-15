Fix production pages khong mo duoc. Co 3 van de:

## 1. _redirects tao redirect loop (CRITICAL)
Cloudflare Pages TU DONG rewrite /menu.html -> /menu (clean URLs).
Nhung _redirects lai rewrite /menu -> /menu.html -> tao loop vo tan.

FIX: XOA TAT CA redirect rules cho static HTML files trong _redirects.
Chi giu redirect cho admin dashboard va clean URLs KHONG trung voi file co san.

File: _redirects
Noi dung moi:
```
# Cloudflare Pages — _redirects
# AURA SPACE

# Admin dashboard
/admin-dashboard  /admin/dashboard.html  200
/dashboard  /dashboard/admin.html  200

# Layout views (no matching .html file)
/layout-2d  /layout-2d-4k.html  200
/layout-3d  /layout-3d.html  200
/kitchen  /kitchen-display.html  200
```

XOA cac dong: /menu, /checkout, /loyalty, /kds, /success, /failure
Vi chung bi trung voi clean URL cua Cloudflare Pages.

## 2. Service Worker path sai
File: js/script.min.js va js/script.js
Tim: navigator.serviceWorker.register('/public/sw.js')
Thay bang: navigator.serviceWorker.register('/js/sw.js')

## 3. Homepage i18n keys hien raw
Kiem tra index.html co load script i18n khong:
- Tim trong <head> hoac cuoi body co <script src="js/i18n.js"> khong
- Neu chua co thi THEM vao truoc </body>
- Kiem tra file js/i18n.js ton tai khong

VIET CODE NGAY. KHONG HOI THEM.
