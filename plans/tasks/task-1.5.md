Tương tự Task 1.4 — thay navbar/footer cũ bằng shared-nav cho:
- `checkout.html` → initNavbar('checkout')
- `table-reservation.html` → initNavbar('reservation')

Thêm <div id="shared-navbar"></div> ở đầu body, <div id="shared-footer"></div> trước </body>, và script import initNavbar + initFooter từ './js/shared-nav.js'.

RULES: KHÔNG xóa inline <style>. KHÔNG thay đổi page content. Chỉ thay navbar/footer.
