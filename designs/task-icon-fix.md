Fix icon "ROOFTOP" text tran ra ngoai card:

Trong index.html, tim feature card co icon rooftop_deck. Material Symbols dang hien thi chu "ROOFTOP_DECK" thay vi icon.

Kiem tra:
1. Dau trang co CDN chua: <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined">
2. Neu chua co thi THEM vao trong <head>
3. Kiem tra cac span co class="material-symbols-outlined" dung chua
4. Icon names PHAI la: eco, rooftop_deck, domain (chu thuong, khong viet hoa)

Sau do:
- Them CSS cho icon: .material-symbols-outlined { font-size: 24px; color: var(--md-sys-color-primary); vertical-align: middle; overflow: hidden; width: 24px; height: 24px; }

VIET CODE NGAY. KHONG HOI THEM.
