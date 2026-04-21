# CTO Task: Deep Fix — Checkout Page Cannot Read Cart from localStorage

> Priority: P0 | Deploy đã xong nhưng checkout vẫn báo "Giỏ hàng trống"

## Current State
- Deploy thành công, trang checkout đã KHÔNG CÒN auto-redirect (fix redirect hoạt động)
- Tuy nhiên phần "Tóm Tắt Đơn Hàng" bên phải vẫn hiện "Giỏ hàng trống" + nút "Quay lại menu"
- Nghĩa là `loadCartFromAPI()` trong `js/checkout.js` đọc localStorage nhưng KHÔNG tìm thấy dữ liệu cart

## Debug Steps

### Step 1: Xác định key localStorage mà menu.js dùng để lưu cart
```bash
grep -n "localStorage.setItem\|localStorage.getItem" js/menu.js js/cart.js js/checkout.js js/checkout/cart-summary.js js/script.js | grep -i "cart"
```

### Step 2: So sánh key lưu vs key đọc
- `menu.js` lưu cart vào key nào? (`aura_cart`? `cart`? hay key khác?)
- `checkout.js` đọc từ key nào? (hiện tại là `aura_cart` || `cart`)
- Đảm bảo key KHỚP NHAU

### Step 3: Kiểm tra format dữ liệu
- `menu.js` lưu dạng gì? Array `[{id, name, price, quantity}]` hay Object `{items: [...]}`?
- `checkout.js:loadCartFromAPI()` parse format nào?
- Có thể menu.js lưu array nhưng checkout kiểm tra `parsed.items` trước — nếu `parsed.items` là undefined thì rơi vào nhánh `Array.isArray(parsed)` — cần chắc chắn nhánh này THỰC SỰ hoạt động

### Step 4: Thêm console.log tạm để debug
Thêm vào `loadCartFromAPI()`:
```js
const stored = localStorage.getItem('aura_cart') || localStorage.getItem('cart');
console.log('[CHECKOUT DEBUG] stored raw:', stored);
console.log('[CHECKOUT DEBUG] parsed:', stored ? JSON.parse(stored) : 'null');
```

### Step 5: Kiểm tra xem checkout.html có load đúng file checkout.js không
```bash
grep -n "checkout.js\|cart-summary.js\|type=\"module\"" checkout.html | head -10
```
- Nếu checkout.html dùng `type="module"` nhưng `js/checkout.js` import từ `./checkout/cart-summary.js` → kiểm tra path

### Step 6: Kiểm tra xem có script nào KHÁC trên checkout.html cũng đọc và xóa cart không
```bash
grep -n "<script" checkout.html
```
- Có thể `cart.js` (CartManager) cũng load trên checkout.html và nó có logic riêng clear cart

### Step 7: Fix
- Đảm bảo key localStorage đồng nhất giữa menu.js và checkout.js
- Đảm bảo format parse đúng
- Xóa console.log debug sau khi fix
- Deploy Pages

### Step 8: Verify
```bash
# Build + Deploy
rm -rf /tmp/fnb-deploy
rsync -av \
  --exclude='*.pen' --exclude='node_modules' --exclude='.git' \
  --exclude='*.sqlite*' --exclude='.DS_Store' --exclude='worker/.wrangler' \
  --exclude='_archive' --exclude='plans' --exclude='tasks-done' \
  --exclude='tests' --exclude='docs' --exclude='designs' \
  --exclude='scripts' --exclude='*.txt' --exclude='package-lock.json' \
  --exclude='export.pdf' \
  . /tmp/fnb-deploy/ 2>&1 | tail -3
npx wrangler pages deploy /tmp/fnb-deploy/ --project-name=fnb-caffe-container --branch=main 2>&1 | tail -5
```

## Rules
- KHÔNG sửa giao diện — chỉ fix logic đọc cart
- Commit message: `fix: checkout localStorage cart read — key and format sync`
- Push + Deploy Pages khi xong
