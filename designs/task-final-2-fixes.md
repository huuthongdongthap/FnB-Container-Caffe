Fix 2 van de cuoi cung:

1. HEADING BI BLUR: Tim trong css/styles.css tat ca class lien quan den heading "Tu Sa Dec Voi Yeu Thuong" trong section #about. Tim tat ca text-shadow qua muc (nhieu layer, blur > 5px) va filter: blur() tren .gradient-text, .neon-cyan, .neon-magenta. XOA HOAN TOAN text-shadow hoac giam xuong con 1 layer voi blur 0-2px. Heading phai sac net, doc duoc.

2. HINH VIBE CODING: Tim trong index.html tat ca img src co chua hinh nen, signage hien thi chu "VIBE CODING". Day la branding SAI. 
   - Neu img src la hinh AI-generated co chu VIBE CODING, thay bang src="images/night-4k.png" hoac "images/night-2k.png"
   - Neu la background-image trong CSS, thay URL tuong tu
   - Grep: grep -n "VIBE\|vibe\|coding" index.html css/styles.css
   - Kiem tra tung file anh trong folder images/ xem file nao chua "VIBE CODING" text

VIET CODE NGAY. KHONG HOI THEM.
