# _archive — Legacy Code (Pre-Modularization)

Lưu trữ code cũ trước khi refactor sang ES modules (2026-04-11).

## legacy-monolith-js/
| File | Thay thế bởi |
|------|-------------|
| checkout.js | js/checkout/cart-summary.js, payment.js, qr-code.js |
| kds-app.js | js/kds/kds-api.js, kds-render.js |
| script.js | js/landing/form-validation.js, gallery.js |
| dashboard.js | dashboard/dashboard-api.js, dashboard-render.js |

## legacy-min-files/
*.min.js và *.min.css được tạo thủ công — nay do Vite build tự động sinh ra vào dist/.

## Xóa an toàn khi:
- [ ] Build Vite pass clean (npm run build)
- [ ] Tests pass (npm test)
- [ ] Deploy staging OK
