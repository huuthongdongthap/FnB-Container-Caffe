Files: `index.html`, `menu.html`
Với MỖI file:
1. Tìm navbar HTML cũ (thường nằm trong <header> hoặc <nav>) → XÓA
2. Tìm footer HTML cũ → XÓA
3. Thêm `<div id="shared-navbar"></div>` ở đầu body
4. Thêm `<div id="shared-footer"></div>` trước </body>
5. Thêm script import:

Cho index.html:
<script type="module">
  import { initNavbar, initFooter } from './js/shared-nav.js';
  initNavbar('home');
  initFooter();
</script>

Cho menu.html:
<script type="module">
  import { initNavbar, initFooter } from './js/shared-nav.js';
  initNavbar('menu');
  initFooter();
</script>

RULES: KHÔNG xóa inline <style>. KHÔNG thay đổi page content. Chỉ thay navbar/footer.
