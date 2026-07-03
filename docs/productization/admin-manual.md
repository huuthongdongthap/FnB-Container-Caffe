# Admin Manual / Huong Dan Quan Tri

> **Bilingual guide for FnB Container Caffe administrators.**
> **Huong dan song ngu danh cho quan tri vien.**
>
> Last updated / Cap nhat: 2026-07-03

---

## Table of Contents / Muc Luc

1. [Dashboard / Bang Dieu Khien](#1-dashboard--bang-dieu-khien)
2. [Orders / Don Hang](#2-orders--don-hang)
3. [Menu / Thuc Don](#3-menu--thuc-don)
4. [Customers / Khach Hang](#4-customers--khach-hang)
5. [Staff / Nhan Vien](#5-staff--nhan-vien)
6. [KDS (Kitchen Display)](#6-kds-kitchen-display)
7. [POS / Ban Tai Quay](#7-pos--ban-tai-quay)
8. [Payments / Thanh Toan](#8-payments--thanh-toan)
9. [Marketing / Tiep Thi](#9-marketing--tiep-thi)
10. [Analytics / Phan Tich](#10-analytics--phan-tich)
11. [Reservations / Dat Ban](#11-reservations--dat-ban)
12. [Audit Logs / Nhat Ky](#12-audit-logs--nhat-ky)
13. [Sales Reports / Bao Cao](#13-sales-reports--bao-cao)

---

## 1. Dashboard / Bang Dieu Khien

### Overview / Tong Quan

The Dashboard is the first screen you see after logging in. It shows a real-time summary of your store's performance.
**Bang Dieu Khien** la man hinh dau tien sau khi dang nhap. No hien thi tong quan hoat dong cua cua hang theo thoi gian thuc.

[SCREENSHOT: Dashboard overview showing 4 metric cards at the top, a range selector, and a chart below]

### 4 Metric Cards / 4 The Chi So

The top of the Dashboard displays four key metric cards. Each card shows the current value and a trend arrow (up/down).

**Bon the chi so o phia tren Bang Dieu Khien:**

1. **Orders / Don Hang** — Total number of orders in the selected period.
   Tong so don hang trong khoang thoi gian da chon.
2. **Revenue / Doanh Thu** — Total revenue (VND) in the selected period.
   Tong doanh thu (VND) trong khoang thoi gian da chon.
3. **Success Rate / Ty Le Thanh Cong** — Percentage of orders completed without errors.
   Phan tram don hang hoan tat khong co loi.
4. **Latency / Do Tre** — Average API response time in milliseconds.
   Thoi gian phan hoi API trung binh (ms).

> **If a card shows "---" or an error:** Click the refresh button (icon mui ten vong tron) in the top-right corner. If the issue continues, click **"Thu lai / Retry"** on the error banner.
>
> **Neu the hien thi "---" hoac loi:** Nhan nut lam moi (bieu tuong mui ten vong tron) o goc phai phia tren. Neu van con loi, nhan **"Thu lai / Retry"** tren thanh thong bao loi.

### Range Selector / Bo Chon Khoang Thoi Gian

Use the range selector below the metric cards to change the time window for all dashboard data.

**Su dung bo chon khoang thoi gian ben duoi cac the chi so de thay doi khung gio cho tat ca du lieu:**

1. Click the dropdown labeled **"24h"** (default / mac dinh).
2. Select one of three options / Chon mot trong ba tuy chon:
   - **24h** — Last 24 hours / 24 gio qua
   - **7d** — Last 7 days / 7 ngay qua
   - **30d** — Last 30 days / 30 ngay qua
3. All metric cards and the chart below will update automatically.
   Tat ca cac the chi so va bieu do ben duoi se tu dong cap nhat.

> **Error state:** If the dropdown is empty or options do not load, refresh the page (F5 or Cmd+R). If the issue persists, check your internet connection, then click **"Thu lai / Retry"**.
>
> **Loi:** Neu dropdown trong hoac cac tuy chon khong hien thi, lam moi trang (F5 hoac Cmd+R). Neu van con loi, kiem tra ket noi internet, sau do nhan **"Thu lai / Retry"**.

### Top Request Paths Chart / Bieu Do Duong Dan Duoc Goi Nhieu Nhat

Below the metrics, a bar chart shows the top 10 most-accessed API paths in the selected period.

**Ben duoi cac chi so, bieu do cot hien thi 10 duong dan API duoc goi nhieu nhat trong khoang thoi gian da chon.**

- Each bar represents one API path (e.g., `/api/orders`, `/api/menu`).
- The height of the bar shows the request count.
- Hover over any bar to see the exact number of requests.

> **If the chart is blank:** Make sure the range selector has a value selected. If it still shows no data, try a different time range (7d or 30d).
>
> **Neu bieu do trong:** Dam bao bo chon khoang thoi gian co gia tri. Neu van khong co du lieu, thu doi sang khung gio khac (7d hoac 30d).

---

## 2. Orders / Don Hang

### Viewing Orders by Status / Xem Don Hang Theo Trang Thai

The Orders page lists every order placed in your store. You can filter by status.

**Trang Don Hang liet ke tat ca don hang. Ban co the loc theo trang thai.**

[SCREENSHOT: Orders list page with status filter tabs at the top and a table of orders below]

1. Click **"Don Hang / Orders"** in the left sidebar.
   Nhan **"Don Hang / Orders"** o thanh ben trai.
2. At the top of the page, click one of the status tabs / O phia tren trang, nhan mot trong cac tab trang thai:
   - **Tat ca / All** — show every order / hien tat ca don hang
   - **Cho xu ly / Pending** — orders waiting for confirmation / don cho xac nhan
   - **Dang xu ly / Processing** — orders being prepared / don dang chuan bi
   - **Hoan tat / Completed** — finished orders / don hoan tat
   - **Da huy / Cancelled** — cancelled orders / don da huy
3. The order list updates to show only matching orders.
   Danh sach don hang cap nhat chi hien thi don phu hop.

> **Error state:** If the order list shows "Khong the tai du lieu / Cannot load data", click **"Thu lai / Retry"** at the top of the table. If the error repeats, check the Dashboard to confirm the system is online.
>
> **Loi:** Neu danh sach hien thi "Khong the tai du lieu / Cannot load data", nhan **"Thu lai / Retry"** o phia tren bang. Neu loi tiep dien, kiem tra Dashboard de xac nhan he thong dang hoat dong.

### Updating Order Status / Cap Nhat Trang Thai Don Hang

To change an order's status, follow these steps.

**De thay doi trang thai don hang, lam theo cac buoc sau.**

1. Find the order in the list and click its **Order ID** (e.g., `#1024`).
   Tim don hang trong danh sach va nhan vao **Ma Don** (vi du: `#1024`).
2. The order detail page opens. Locate the **"Trang Thai / Status"** section.
   Trang chi tiet don hang mo ra. Tim phan **"Trang Thai / Status"**.
3. Click the dropdown and select the new status / Nhan dropdown va chon trang thai moi:
   - **Cho xu ly / Pending** -> **Dang xu ly / Processing**
   - **Dang xu ly / Processing** -> **Hoan tat / Completed**
   - **Huy / Cancel** (any status / bat ky trang thai nao)
4. Click **"Luu / Save"** to confirm / Nhan **"Luu / Save"** de xac nhan.
5. A green confirmation banner appears: **"Da cap nhat trang thai / Status updated"**.
   Mot thanh thong bao xuat hien: **"Da cap nhat trang thai / Status updated"**.

> **Warning:** Changing status to **"Da huy / Cancelled"** cannot be undone. Double-check before confirming.
>
> **Canh bao:** Doi trang thai sang **"Da huy / Cancelled"** khong the hoan tac. Kiem tra ky truoc khi xac nhan.

### Searching and Filtering / Tim Kiem va Loc

Use the search bar and filters to find specific orders quickly.

**Su dung thanh tim kiem va bo loc de tim don hang nhanh chong.**

1. Type an Order ID, customer name, or phone number in the search bar at the top.
   Nhap Ma Don, ten khach hang, hoac so dien thoai vao thanh tim kiem o phia tren.
2. Click the **"Loc / Filter"** button next to the search bar.
   Nhan nut **"Loc / Filter"** ben canh thanh tim kiem.
3. Set your filter options / Dat cac tuy chon loc:
   - **Ngay / Date** — pick a start and end date / chon ngay bat dau va ket thuc
   - **Gia tri / Amount** — minimum or maximum order value / gia tri toi thieu hoac toi da
   - **Kenh / Channel** — POS, web, or KDS / POS, web, hoac KDS
4. Click **"Ap dung / Apply"**. The table updates to show filtered results.
   Nhan **"Ap dung / Apply"**. Bang cap nhat hien thi ket qua da loc.
5. To clear filters, click **"Xoa bo loc / Clear filters"**.
   De xoa bo loc, nhan **"Xoa bo loc / Clear filters"**.

> **No results:** If the table is empty after filtering, widen your date range or remove some filters. Double-check the search term for typos.
>
> **Khong co ket qua:** Neu bang trong sau khi loc, mo rong khoang ngay hoac bo bot loc. Kiem tra tu khoa tim kiem xem co loi chinh ta khong.

---

## 3. Menu / Thuc Don

### Adding New Products / Them San Pham Moi

Use the Menu page to add new food and drink items to your store.

**Su dung trang Thuc Don de them mon an va do uong moi.**

[SCREENSHOT: Menu management page with product list on the left and add/edit form on the right]

1. Click **"Thuc Don / Menu"** in the left sidebar.
   Nhan **"Thuc Don / Menu"** o thanh ben trai.
2. Click the **"+ Them mon moi / + Add new product"** button in the top-right corner.
   Nhan nut **"+ Them mon moi / + Add new product"** o goc phai phia tren.
3. Fill in the product details / Nhap thong tin san pham:
   - **Ten mon / Product name** (required / bat buoc)
   - **Mo ta / Description** (optional / tuy chon)
   - **Gia / Price** (VND, required / bat buoc)
   - **Danh muc / Category** (select from dropdown / chon tu dropdown)
   - **Hinh anh / Image** (click "Tai anh len / Upload image" to choose a file)
4. Toggle **"Con hang / Available"** to ON if the product is ready for sale.
   Chuyen **"Con hang / Available"** sang ON neu san pham san sang ban.
5. Click **"Luu / Save"** at the bottom.
   Nhan **"Luu / Save"** o phia duoi.
6. The product appears in the menu list immediately.
   San pham xuat hien trong danh sach thuc don ngay lap tuc.

> **Error state:** If the form shows a red error like "Truong nay la bat buoc / This field is required", check that all required fields (name, price) are filled. If the image upload fails, check the file size (max 5MB, JPG or PNG only).
>
> **Loi:** Neu form hien thi loi do nhu "Truong nay la bat buoc / This field is required", kiem tra tat ca truong bat buoc (ten, gia) da duoc nhap. Neu tai anh that bai, kiem tra kich thuoc file (toi da 5MB, chi JPG hoac PNG).

### Editing Products / Chinh Sua San Pham

To update an existing product's details.

**De cap nhat thong tin san pham hien co.**

1. In the menu list, find the product and click the **pen icon (bieu tuong cay viet)** in the Actions column.
   Trong danh sach, tim san pham va nhan **bieu tuong cay viet** o cot Hanh dong.
2. The edit form opens with the current values. Make your changes.
   Form chinh sua mo ra voi gia tri hien tai. Thuc hien thay doi.
3. Click **"Luu / Save"** to apply changes / Nhan **"Luu / Save"** de ap dung.
4. A confirmation banner appears: **"Da cap nhat / Updated"**.
   Thanh thong bao xuat hien: **"Da cap nhat / Updated"**.

### Categories Management / Quan Ly Danh Muc

Organize products into categories (e.g., Coffee, Tea, Pastry).

**Sap xep san pham vao cac danh muc (vi du: Cafe, Tra, Banh).**

1. On the Menu page, click the **"Danh muc / Categories"** tab at the top.
   Tren trang Thuc Don, nhan tab **"Danh muc / Categories"** o phia tren.
2. You will see a list of all categories / Ban se thay danh sach tat ca danh muc.
3. To add a category / De them danh muc:
   - Click **"+ Them danh muc / + Add category"**.
   - Enter the category name (bilingual recommended: "Cafe / Coffee").
   - Click **"Luu / Save"**.
4. To edit a category / De chinh sua:
   - Click the name of the category / Nhan vao ten danh muc.
   - Change the name and click **"Luu / Save"**.
5. To delete a category / De xoa:
   - Click the **trash icon (bieu tuong thung rac)** next to the category.
   - A confirmation popup appears. Click **"Xac nhan xoa / Confirm delete"**.
   - **Note:** Products in this category will become "uncategorized". You must reassign them manually.
   - **Luu y:** San pham trong danh muc nay se tro thanh "khong co danh muc". Ban phan cong lai thu cong.

> **If delete fails:** You cannot delete a category that has active products assigned. Remove or reassign all products first, then try again.
>
> **Neu xoa that bai:** Khong the xoa danh muc co san pham dang hoat dong. Xoa hoac phan lai san pham truoc, sau do thu lai.

### Setting Availability / Cai Dat Tinh Trang Con Hang

Quickly mark products as available or unavailable without editing the full form.

**Nhanh chong danh dau san pham con hang hoac het hang ma khong can chinh sua toan bo form.**

1. In the menu list, find the product row.
   Trong danh sach thuc don, tim dong san pham.
2. Locate the toggle switch in the **"Con hang / Available"** column.
   Tim cong tac chuyen o cot **"Con hang / Available"**.
3. Click the toggle to switch between **On** (available / con hang) and **Off** (unavailable / het hang).
   Nhan cong tac de chuyen giua **On** (con hang) va **Off** (het hang).
4. The change saves automatically. A gray badge shows "Het hang / Sold out" when toggled Off.
   Thay doi tuu dong luu. Huy hieu mau xam hien thi "Het hang / Sold out" khi tat.

---

## 4. Customers / Khach Hang

### Customer List View / Xem Danh Sach Khach Hang

The Customers page shows all registered customers with their contact info and order history.

**Trang Khach Hang hien thi tat ca khach hang da dang ky kem thong tin lien lac va lich su don hang.**

[SCREENSHOT: Customers list page showing a table with name, phone, email, loyalty tier, and total spent columns]

1. Click **"Khach Hang / Customers"** in the left sidebar.
   Nhan **"Khach Hang / Customers"** o thanh ben trai.
2. The customer table displays with columns / Bang khach hang hien thi voi cac cot:
   - **Ten / Name**
   - **So dien thoai / Phone**
   - **Email**
   - **Hang / Tier** (Bronze, Silver, Gold, Platinum)
   - **Tong chi tieu / Total spent**
   - **Lan cuoi / Last visit**
3. Click any customer row to view their full profile and order history.
   Nhan vao bat ky dong khach hang de xem ho so day du va lich su don hang.

> **If the list is empty:** This means no customers have registered yet. Customers appear automatically after their first order.
>
> **Neu danh sach trong:** Khong co khach hang nao dang ky. Khach hang xuat hien tu dong sau don hang dau tien.

### Searching by Name or Phone / Tim Kiem Theo Ten hoac So Dien Thoai

Use the search bar at the top of the customer list to find a specific customer.

**Su dung thanh tim kiem o phia tren danh sach khach hang de tim khach hang cu the.**

1. Click the search bar labeled **"Tim khach hang... / Search customers..."**.
   Nhan vao thanh tim kiem co nhan **"Tim khach hang... / Search customers..."**.
2. Type the customer's name or phone number (partial matches work).
   Nhap ten hoac so dien thoai (tim kiem mot phan cung hoat dong).
3. The list filters in real time as you type.
   Danh sach loc theo thoi gian thuc khi ban nhap.
4. To clear the search, click the **"X"** icon inside the search bar.
   De xoa tim kiem, nhan bieu tuong **"X"** ben trong thanh tim kiem.

> **No match found:** Check for typos or try searching by the other field (phone instead of name, or vice versa).
>
> **Khong tim thay:** Kiem tra loi chinh ta hoac thu tim bang truong kia (so dien thoai thay vi ten, hoac nguoc lai).

### Loyalty Tier Filters / Bo Loc Hang Thanh Vien

Filter the customer list by loyalty tier.

**Loc danh sach khach hang theo hang thanh vien.**

1. Above the customer table, find the tier filter buttons.
   Phia tren bang khach hang, tim cac nut loc hang.
2. Click a tier button to show only customers in that tier / Nhan nut hang de chi hien thi khach hang trong hang do:
   - **Tat ca / All** — show everyone / hien tat ca
   - **Bronze** — 0-2 million VND total spent / 0-2 trieu chi tieu
   - **Silver** — 2-10 million VND / 2-10 trieu
   - **Gold** — 10-50 million VND / 10-50 trieu
   - **Platinum** — 50+ million VND / 50+ trieu
3. Click the same button again or click "Tat ca / All" to remove the filter.
   Nhan lai nut do hoac nhan "Tat ca / All" de bo loc.

> **Filter shows no customers:** It means no customers have reached that tier yet. Try a lower tier to see results.
>
> **Loc khong co khach hang:** Khong co khach hang nao dat hang do. Thu hang thap hon de xem ket qua.

---

## 5. Staff / Nhan Vien

### Adding Staff Accounts / Them Tai Khoan Nhan Vien

Create accounts for employees who need access to the admin system.

**Tao tai khoan cho nhan vien can truy cap he thong quan tri.**

[SCREENSHOT: Staff management page with a list of staff accounts and an "Add Staff" form]

1. Click **"Nhan Vien / Staff"** in the left sidebar.
   Nhan **"Nhan Vien / Staff"** o thanh ben trai.
2. Click the **"+ Them nhan vien / + Add staff"** button in the top-right corner.
   Nhan nut **"+ Them nhan vien / + Add staff"** o goc phai phia tren.
3. Fill in the details / Nhap thong tin:
   - **Ho va ten / Full name** (required / bat buoc)
   - **Email** (required, used for login / bat buoc, dung de dang nhap)
   - **So dien thoai / Phone number**
   - **Mat khau / Password** (auto-generated; click "Tao mat khau / Generate" or type manually / tu dong tao; nhan "Tao mat khau / Generate" hoac nhap thu cong)
   - **Vai tro / Role** (select from the role dropdown / chon tu dropdown vai tro)
4. Click **"Luu / Save"**.
5. An invitation email is sent to the staff's email address with login instructions.
   Email moi duoc gui den dia chi email cua nhan vien kem huong dan dang nhap.

> **Error state:** If you see "Email da ton tai / Email already exists", this email is already registered to another staff account. Use a different email.
>
> **Loi:** Neu thay "Email da ton tai / Email already exists", email nay da duoc dang ky cho tai khoan khac. Su dung email khac.

### Role Management / Quan Ly Vai Tro

Each staff member has a role that determines what they can access.

**Moi nhan vien co mot vai tro xac dinh quyen truy cap.**

Available roles / Cac vai tro co san:

| Role / Vai Tro | Permissions / Quyen |
|---------------|-------------------|
| **Admin** | Full access. Can manage staff, payments, settings. Toan quyen. Quan ly nhan vien, thanh toan, cai dat. |
| **Manager / Quan Ly** | Orders, menu, customers, reports. Cannot manage staff or payments. Don hang, thuc don, khach hang, bao cao. Khong the quan ly nhan vien hoac thanh toan. |
| **Staff / Nhan Vien** | POS, KDS, orders only. Chi POS, KDS, don hang. |
| **Kitchen / Bep** | KDS display only. Chi man hinh KDS. |

To change a staff member's role / De doi vai tro nhan vien:

1. Click the staff member's row in the list.
   Nhan vao dong nhan vien trong danh sach.
2. In the profile panel, find the **"Vai tro / Role"** dropdown.
   Trong bang ho so, tim dropdown **"Vai tro / Role"**.
3. Select a new role and click **"Cap nhat / Update"**.
   Chon vai tro moi va nhan **"Cap nhat / Update"**.

> **Warning:** Changing a role takes effect immediately. The staff member will be logged out on their next action and must log in again.
>
> **Canh bao:** Doi vai tro co hieu luc ngay lap tuc. Nhan vien se bi dang xuat o lan thao tac tiep theo va phai dang nhap lai.

### Shift Tracking (Clock-In/Out) / Theo Doi Ca Lam

Staff can clock in and out to track their working hours.

**Nhan vien co the cham cong de theo doi gio lam viec.**

[SCREENSHOT: Shift overview page showing a list of staff with clock-in/out times and total hours]

1. Staff click the **clock icon (bieu tuong dong ho)** in the top navigation bar.
   Nhan vien nhan **bieu tuong dong ho** o thanh dieu huong phia tren.
2. The clock-in/out modal opens / Cua so cham cong mo ra.
3. Click **"Bat dau ca / Clock in"** to start the shift.
   Nhan **"Bat dau ca / Clock in"** de bat dau ca.
4. At the end of the shift, click **"Ket thuc ca / Clock out"**.
   Khi ket thuc ca, nhan **"Ket thuc ca / Clock out"**.
5. Total hours are calculated automatically and displayed in the staff list.
   Tong so gio duoc tinh toan tu dong va hien thi trong danh sach nhan vien.

> **If a staff member forgot to clock out:** Go to the staff profile, click **"Chinh sua gio / Edit hours"**, and set the correct clock-out time manually.
>
> **Neu nhan vien quen ket thuc ca:** Vao ho so nhan vien, nhan **"Chinh sua gio / Edit hours"**, va nhap gio ket thuc ca dung bang tay.

---

## 6. KDS (Kitchen Display)

### Real-Time Order Display / Hien Thi Don Hang Theo Thoi Gian Thuc

The Kitchen Display System shows incoming orders to the kitchen staff in real time.

**He thong hien thi don hang cho nhan vien bep theo thoi gian thuc.**

[SCREENSHOT: KDS screen showing multiple order cards with items, timer, and status badges]

1. Open the KDS page by navigating to the KDS device or URL (provided during setup).
   Mo trang KDS bang cach truy cap thiet bi KDS hoac URL (duoc cung cap khi cai dat).
2. New orders appear as cards on the screen automatically (no refresh needed).
   Don hang moi xuat hien tu dong duoi dang the tren man hinh (khong can lam moi).
3. Each card shows / Moi the hien thi:
   - **Order ID / Ma Don**
   - **Items ordered / Cac mon da goi**
   - **Order time / Thoi gian dat**
   - **Preparation status / Trang thai chuan bi**
   - **Note from customer / Ghi chu tu khach hang** (if any / neu co)

> **If the screen is blank or shows "Dang ket noi... / Connecting...":** Check that the KDS device is connected to the internet. Refresh the page. If the issue persists, click **"Thu lai / Retry"** on the connection error message.
>
> **Neu man hinh trong hoac hien thi "Dang ket noi... / Connecting...":** Kiem tra thiet bi KDS da ket noi internet. Lam moi trang. Neu van con loi, nhan **"Thu lai / Retry"** tren thong bao loi ket noi.

### Sound Alerts / Am Thanh Canh Bao

When a new order arrives, the KDS plays a sound alert.

**Khi co don hang moi, KDS phat am thanh canh bao.**

1. By default, a chime sound plays when any new order arrives.
   Mac dinh, am thanh chuong phat khi co don hang moi.
2. To change the sound / De thay doi am thanh:
   - Click the **gear icon (bieu tuong banh rang)** in the KDS top-right corner.
   - Select a new sound from the **"Am thanh / Sound"** dropdown.
   - Click **"Test"** to preview / Nhan **"Test"** de ngay thu.
   - Click **"Luu / Save"**.
3. To mute alerts / De tat am thanh:
   - Click the **speaker icon (bieu tuong loa)** in the KDS top bar. It will show a strikethrough when muted.
   - Nhan **bieu tuong loa** o thanh tren KDS. No hien thi gach ngang khi tat tieng.

> **If no sound plays:** Check that the KDS device volume is turned up. Click the speaker icon to confirm it is not muted. Try a different browser (Chrome recommended).
>
> **Neu khong co am thanh:** Kiem tra am luong thiet bi KDS. Nhan bieu tuong loa de xac nhan khong bi tat. Thu trinh duyet khac (khuyen nghi Chrome).

### Preparation Timer / Bo Dem Chuan Bi

The KDS tracks how long each order has been in preparation.

**KDS theo doi thoi gian chuan bi cua moi don hang.**

1. Each order card shows a timer starting from when the order was placed.
   Moi the don hang hien thi bo dem tu luc dat hang.
2. The timer color changes based on elapsed time / Mau bo dem thay doi theo thoi gian:
   - **Xanh / Green** (0-5 min) — on time / dung gio
   - **Vang / Yellow** (5-10 min) — approaching limit / sap toi han
   - **Do / Red** (10+ min) — overdue / qua han
3. When the food is ready, click **"Hoan tat / Complete"** on the order card.
   Khi mon an san sang, nhan **"Hoan tat / Complete"** tren the don hang.
4. The timer stops and the card moves to the completed section.
   Bo dem dung lai va the chuyen den phan hoan tat.

> **If timer shows incorrect time:** The KDS uses server time, not device time. Check that your device clock is synchronized, or refresh the page to resync.
>
> **Neu bo dem sai gio:** KDS dung gio may chu, khong phai gio thiet bi. Kiem tra dong ho thiet bi da dong bo, hoac lam moi trang de dong bo lai.

---

## 7. POS / Ban Tai Quay

### Table Map View / Xem So Do Ban

The POS screen starts with a visual map of your store's tables.

**Man hinh POS bat dau voi so do truc quan cac ban trong quan.**

[SCREENSHOT: Table map showing different tables with status colors (green=available, red=occupied, yellow=waiting)]

1. Click **"POS / Ban Tai Quay"** in the left sidebar.
   Nhan **"POS / Ban Tai Quay"** o thanh ben trai.
2. You see a grid of tables / Ban thay luoi cac ban:
   - **Xanh / Green** — empty / ban trong
   - **Do / Red** — occupied / co khach
   - **Vang / Yellow** — waiting for payment / cho thanh toan
3. Click a green table to start a new order. Click a red/ yellow table to view the current order.
   Nhan ban xanh de bat dau don moi. Nhan ban do/vang de xem don hien tai.

> **Error state:** If the table map shows "Khong tai duoc / Cannot load", refresh the page. If tables appear in the wrong positions, go to **Settings > Table Layout / Cai Dat > So Do Ban** to reconfigure.
>
> **Loi:** Neu so do ban hien thi "Khong tai duoc / Cannot load", lam moi trang. Neu ban o sai vi tri, vao **Cai Dat > So Do Ban / Settings > Table Layout** de cau hinh lai.

### Order Creation / Tao Don Hang

Create a new order for a table.

**Tao don hang moi cho mot ban.**

1. Click an empty (green) table on the map.
   Nhan vao ban trong (xanh) tren so do.
2. A side panel opens. Click **"Them mon / Add items"** to open the menu.
   Bang ben mo ra. Nhan **"Them mon / Add items"** de mo thuc don.
3. Browse or search for products. Click the **"+"** button next to each item to add it.
   Duyet hoac tim san pham. Nhan nut **"+"** ben canh moi mon de them.
4. The order summary updates on the right with quantities and total.
   Tom tat don hang cap nhat ben phai voi so luong va tong tien.
5. When finished, click **"Gui don / Send order"**.
   Khi xong, nhan **"Gui don / Send order"**.
6. The order is sent to KDS for preparation.
   Don hang duoc gui den KDS de chuan bi.

> **If an item cannot be added:** Check the menu management page — the item may be marked as unavailable (Het hang / Sold out). Enable it in Menu > Availability.
>
> **Neu khong the them mon:** Kiem tra trang quan ly thuc don — mon co the dang "Het hang / Sold out". Bat lai trong Thuc Don > Tinh trang con hang.

### Payment Processing / Xu Ly Thanh Toan

Process payment for a completed order.

**Xu ly thanh toan cho don hang da hoan tat.**

1. On the table map, click an occupied (red) table.
   Tren so do ban, nhan ban dang co khach (do).
2. The order summary shows the total amount. Click **"Thanh toan / Pay"**.
   Tom tat don hang hien thi tong tien. Nhan **"Thanh toan / Pay"**.
3. Select a payment method / Chon phuong thuc thanh toan:
   - **Tien mat / Cash**
   - **Chuyen khoan / Bank transfer** (PayOS QR code)
   - **The / Card** (card terminal / may quet the)
4. Enter the amount received (for Cash) or confirm the transaction (for Bank/Card).
   Nhap so tien nhan duoc (cho Tien mat) hoac xac nhan giao dich (cho Chuyen khoan/The).
5. Click **"Xac nhan thanh toan / Confirm payment"**.
6. The system prints a receipt (if a printer is connected) and the table turns green.
   He thong in hoa don (neu co may in) va ban chuyen sang mau xanh.

> **If payment fails:** A red error banner appears. Check the internet connection. For bank transfers, verify the customer completed the QR scan. Click **"Thu lai / Retry"** to try again, or switch to Cash payment.
>
> **Neu thanh toan that bai:** Thanh thong bao do xuat hien. Kiem tra ket noi internet. Voi chuyen khoan, xac nhan khach hang da quet QR. Nhan **"Thu lai / Retry"** de thu lai, hoac chuyen sang Tien mat.

---

## 8. Payments / Thanh Toan

### PayOS Setup / Cai Dat PayOS

PayOS handles bank transfer payments via QR code.

**PayOS xu ly thanh toan chuyen khoan qua ma QR.**

[SCREENSHOT: Payments settings page showing PayOS configuration fields]

1. Click **"Cai Dat > Thanh Toan / Settings > Payments"** in the sidebar.
   Nhan **"Cai Dat > Thanh Toan / Settings > Payments"** o thanh ben.
2. In the **PayOS** section, enter your PayOS API credentials:
   Trong phan **PayOS**, nhap thong tin API PayOS:
   - **Client ID** — from your PayOS dashboard / tu bang dieu khien PayOS
   - **API Key** — from your PayOS dashboard / tu bang dieu khien PayOS
   - **Checksum Key** — from your PayOS dashboard / tu bang dieu khien PayOS
3. Toggle **"Kich hoat PayOS / Enable PayOS"** to ON.
   Chuyen **"Kich hoat PayOS / Enable PayOS"** sang ON.
4. Click **"Kiem tra ket noi / Test connection"**.
   Nhan **"Kiem tra ket noi / Test connection"**.
5. If successful, you see **"Ket noi thanh cong / Connection successful"**. Click **"Luu / Save"**.
   Neu thanh cong, ban thay **"Ket noi thanh cong / Connection successful"**. Nhan **"Luu / Save"**.

> **Error state:** If "Kiem tra ket noi / Test connection" shows "That bai / Failed", double-check your Client ID, API Key, and Checksum Key. Make sure your PayOS account is active. Contact PayOS support if credentials are correct but still failing.
>
> **Loi:** Neu "Kiem tra ket noi / Test connection" hien thi "That bai / Failed", kiem tra lai Client ID, API Key, va Checksum Key. Dam bao tai khoan PayOS dang hoat dong. Lien he ho tro PayOS neu thong tin dung ma van loi.

### COD Handling / Xu Ly COD (Tien Mat)

Cash on Delivery orders need manual confirmation.

**Don hang COD (tien mat) can xac nhan thu cong.**

1. When an order is paid by Cash, it appears in the Orders page with status "Cho xu ly / Pending".
   Khi don hang thanh toan bang Tien mat, no xuat hien trong trang Don Hang voi trang thai "Cho xu ly / Pending".
2. Confirm the payment was received, then update the order status:
   Xac nhan da nhan tien, sau do cap nhat trang thai don hang:
   - Go to the order detail page / Vao trang chi tiet don hang.
   - Set status to **"Da thanh toan / Paid"**.
   - Click **"Luu / Save"**.
3. The total and payment method are displayed in the order summary.
   Tong tien va phuong thuc thanh toan hien thi trong tom tat don hang.

> **If COD is not showing as an option:** Make sure "Tien mat / Cash" is enabled in **Settings > Payments > Tien mat / Cash** toggle.
>
> **Neu COD khong hien thi la tuy chon:** Dam bao "Tien mat / Cash" dang bat trong **Cai Dat > Thanh Toan > Tien mat / Cash**.

### Refund Process / Quy Trinh Hoan Tien

Process a refund for a cancelled or incorrect order.

**Xu ly hoan tien cho don hang da huy hoac sai.**

[SCREENSHOT: Refund form showing order ID, amount, reason field, and refund button]

1. Go to the order detail page of the order to refund.
   Vao trang chi tiet cua don hang can hoan tien.
2. Click the **"Hoan tien / Refund"** button in the payment section.
   Nhan nut **"Hoan tien / Refund"** trong phan thanh toan.
3. Enter the refund details / Nhap thong tin hoan tien:
   - **So tien / Amount** (defaults to full order total; you can enter a partial amount / mac dinh la tong don; co the nhap so tien mot phan)
   - **Ly do / Reason** (required / bat buoc — e.g., "Khach huy / Customer cancelled", "Sai mon / Wrong item")
4. Click **"Xac nhan hoan tien / Confirm refund"**.
5. The refund is processed and a confirmation appears: **"Da hoan tien / Refund completed"**.
   Hoan tien duoc xu ly va thong bao xuat hien: **"Da hoan tien / Refund completed"**.

> **If refund fails:** Ensure the order was paid (not pending). For PayOS refunds, check that the transaction is within the refund window. Contact PayOS support if the issue persists.
>
> **Neu hoan tien that bai:** Dam bao don hang da duoc thanh toan (khong phai dang cho). Voi hoan tien PayOS, kiem tra giao dich con trong thoi han hoan tien. Lien he ho tro PayOS neu van con loi.

---

## 9. Marketing / Tiep Thi

### Broadcast (ZNS/SMS/Email) / Gui Tin Nhan Hang Loat

Send promotional messages to customers via ZNS (Zalo), SMS, or Email.

**Gui tin nhan khuyen mai den khach hang qua ZNS (Zalo), SMS, hoac Email.**

[SCREENSHOT: Broadcast creation form with audience selection, message template, and channel picker]

1. Click **"Tiep Thi > Phat song / Marketing > Broadcast"** in the sidebar.
   Nhan **"Tiep Thi > Phat song / Marketing > Broadcast"** o thanh ben.
2. Click **"+ Tao chien dich moi / + Create new campaign"**.
   Nhan **"+ Tao chien dich moi / + Create new campaign"**.
3. Choose the channel / Chon kenh:
   - **ZNS** — Zalo Notification Service (requires Zalo OA setup / can cai dat Zalo OA)
   - **SMS** — Text message (requires SMS provider setup / can cai dat SMS provider)
   - **Email** — Email (requires SMTP setup / can cai dat SMTP)
4. Select the audience / Chon doi tuong nhan:
   - **Tat ca khach hang / All customers**
   - **Theo hang / By tier** (select one or more tiers / chon mot hoac nhieu hang)
   - **Theo ngay sinh / By birthday month** (select month / chon thang)
   - **Tai su dung mau tin / Reuse template** (pick from saved templates / chon tu mau co san)
5. Write your message / Viet tin nhan:
   - For ZNS: Select a Zalo template (pre-approved by Zalo / duoc Zalo phe duyet truoc).
   - For SMS: Type the message (max 160 characters per segment / toi da 160 ky tu moi doan).
   - For Email: Enter subject + body (supports HTML / ho tro HTML).
6. Click **"Xem truoc / Preview"** to review / Nhan **"Xem truoc / Preview"** de xem lai.
7. Click **"Gui / Send"** to broadcast. Or click **"Lap lich / Schedule"** to set a future date/time.
   Nhan **"Gui / Send"** de phat song. Hoac nhan **"Lap lich / Schedule"** de dat lich tuong lai.

> **Error state:** If "Gui / Send" is grayed out, check that all required fields are filled. For ZNS, ensure the Zalo template is approved by Zalo (pending templates cannot be sent).
>
> **Loi:** Neu "Gui / Send" bi mo, kiem tra tat ca truong bat buoc da duoc nhap. Voi ZNS, dam bao mau Zalo da duoc Zalo phe duyet (mau dang cho khong the gui).

### Campaign Management (Birthday, Winback, Welcome) / Quan Ly Chien Dich

Pre-built automated campaigns for common scenarios.

**Chien dich tu dong duoc xay dung san cho cac tinh huong pho bien.**

1. Click **"Tiep Thi > Chien Dich / Marketing > Campaigns"** in the sidebar.
   Nhan **"Tiep Thi > Chien Dich / Marketing > Campaigns"** o thanh ben.
2. You will see three default campaigns / Ban se thay ba chien dich mac dinh:

   **a) Sinh nhat / Birthday Campaign**
   - Automatically sends a voucher to customers on their birthday.
   - Tu dong gui voucher cho khach hang vao ngay sinh nhat.
   - Click the campaign to set the voucher value and message.
   - Nhan vao chien dich de dat gia tri voucher va tin nhan.

   **b) Quay lai / Winback Campaign**
   - Sends a re-engagement message to customers inactive for 30+ days.
   - Gui tin nhan tai tuong tac cho khach hang khong hoat dong tren 30 ngay.
   - Click to set the inactivity threshold (default 30 days) and offer.
   - Nhan de dat nguong khong hoat dong (mac dinh 30 ngay) va uu dai.

   **c) Chao mung / Welcome Campaign**
   - Sends a welcome message and first-order discount to new customers.
   - Gui tin nhan chao mung va giam gia don dau cho khach hang moi.
   - Click to set the welcome discount percentage and message.
   - Nhan de dat phan tram giam gia chao mung va tin nhan.

3. Toggle the campaign **ON** to activate or **OFF** to disable.
   Chuyen chien dich sang **ON** de kich hoat hoac **OFF** de tat.

4. Click **"Luu / Save"** after making changes.
   Nhan **"Luu / Save"** sau khi thay doi.

> **If a campaign is not sending:** Check that the channel (ZNS/SMS/Email) is properly configured in **Settings > Channels / Cai Dat > Kenh**.
>
> **Neu chien dich khong gui:** Kiem tra kenh (ZNS/SMS/Email) da duoc cau hinh dung trong **Cai Dat > Kenh / Settings > Channels**.

### Promotions / Vouchers / Khuyen Mai / Voucher

Create discount vouchers for customers.

**Tao voucher giam gia cho khach hang.**

[SCREENSHOT: Voucher creation form with discount type, value, expiry date, and usage limit fields]

1. Click **"Tiep Thi > Khuyen Mai / Marketing > Promotions"** in the sidebar.
   Nhan **"Tiep Thi > Khuyen Mai / Marketing > Promotions"** o thanh ben.
2. Click **"+ Tao voucher / + Create voucher"**.
3. Fill in the details / Nhap thong tin:
   - **Ma voucher / Voucher code** (auto-generated or type manually / tu dong tao hoac nhap thu cong)
   - **Loai giam / Discount type**:
     - **Phan tram / Percentage** (e.g., 10% off / giam 10%)
     - **So tien / Fixed amount** (e.g., 20,000 VND off / giam 20,000 VND)
   - **Gia tri / Value** (number / con so)
   - **Ngay het han / Expiry date** (pick a date / chon ngay)
   - **Gioi han su dung / Usage limit** (max number of times it can be used / so lan su dung toi da)
   - **Ap dung toi thieu / Minimum order** (optional / tuy chon)
4. Click **"Tao / Create"**. The voucher code is now active.
   Nhan **"Tao / Create"**. Ma voucher hien dang hoat dong.
5. Share the code with customers via broadcast or in-store display.
   Chia se ma voi khach hang qua phat song hoac bang hien thi tai quan.

> **If a voucher does not work at checkout:** Check that the voucher has not expired, is not over its usage limit, and the customer's order meets the minimum amount.
>
> **Neu voucher khong hoat dong khi thanh toan:** Kiem tra voucher chua het han, chua vuot qua gioi han su dung, va don hang cua khach dat gia tri toi thieu.

---

## 10. Analytics / Phan Tich

### Revenue Overview / Tong Quan Doanh Thu

The Analytics page shows revenue trends over time.

**Trang Phan Tich hien thi xu huong doanh thu theo thoi gian.**

[SCREENSHOT: Analytics dashboard with a revenue line chart, top products list, and peak hours bar chart]

1. Click **"Phan Tich / Analytics"** in the left sidebar.
   Nhan **"Phan Tich / Analytics"** o thanh ben trai.
2. The main chart shows a revenue line graph over the selected period.
   Bieu do chinh hien thi doanh thu dang duong theo khoang thoi gian da chon.
3. Use the date range picker at the top to change the period (7d, 30d, 90d, Tuychon / Custom).
   Su dung bo chon ngay o phia tren de thay doi khoang thoi gian (7d, 30d, 90d, Tuychon / Custom).
4. Hover over the line to see exact revenue for a specific day.
   Di chuot qua duong de xem doanh thu chinh xac cho mot ngay cu the.

> **If the chart shows "Khong co du lieu / No data":** Select a different time range. If you just opened the store today, choose a shorter period (24h or 7d).
>
> **Neu bieu do hien thi "Khong co du lieu / No data":** Chon khoang thoi gian khac. Neu cua hang moi mo hom nay, chon khoang thoi gian ngan hon (24h hoac 7d).

### Top Products / San Pham Ban Chay

View which products sell the most.

**Xem san pham nao ban chay nhat.**

1. Below the revenue chart, find the **"Top san pham / Top Products"** section.
   Ben duoi bieu do doanh thu, tim phan **"Top san pham / Top Products"**.
2. A bar chart shows the top 10 products by quantity sold.
   Bieu do cot hien thi 10 san pham ban chay nhat theo so luong.
3. Each bar shows the product name and total quantity.
   Moi cot hien thi ten san pham va tong so luong.
4. Hover over a bar to see exact numbers and total revenue for that product.
   Di chuot qua cot de xem con so chinh xac va tong doanh thu cho san pham do.

> **If the list is incomplete:** Make sure your date range is wide enough. A 24h range may not show enough data.
>
> **Neu danh sach khong day du:** Dam bao khoang thoi gian du rong. Khoang 24h co the khong hien thi du du lieu.

### Peak Hours / Gio Cao Diem

Identify the busiest hours of the day.

**Xac dinh gio ban nhieu nhat trong ngay.**

1. Scroll down to **"Gio cao diem / Peak Hours"** section.
   Keo xuong phan **"Gio cao diem / Peak Hours"**.
2. A heatmap or bar chart shows order volume for each hour of the day.
   Bieu do nhiet hoac bieu do cot hien thi so luong don hang cho tung gio trong ngay.
3. Darker/higher bars indicate peak hours.
   Cot dam/cao hon cho thay gio cao diem.
4. Use this information to schedule staff shifts and prep during off-peak hours.
   Su dung thong tin nay de sap xep ca nhan vien va chuan bi trong gio thap diem.

> **If peak hours show flat data:** This means you have even distribution across all hours. For a more useful view, switch to a shorter date range (7d or 24h).
>
> **Neu gio cao diem hien thi du lieu deu:** Dieu nay co nghia la phan bo deu qua cac gio. De co cai nhin huu ich hon, chuyen sang khoang thoi gian ngan hon (7d hoac 24h).

### CSV Export / Xuat CSV

Download analytics data as a CSV file.

**Tai du lieu phan tich duoi dang file CSV.**

1. In the Analytics page, click the **"Xuat CSV / Export CSV"** button in the top-right corner.
   Tren trang Phan Tich, nhan nut **"Xuat CSV / Export CSV"** o goc phai phia tren.
2. Select the data to export / Chon du lieu can xuat:
   - **Doanh thu / Revenue** — daily revenue breakdown / doanh thu theo ngay
   - **San pham / Products** — product-level sales data / du lieu ban hang theo san pham
   - **Khach hang / Customers** — customer activity data / du lieu hoat dong khach hang
3. Click **"Tai xuong / Download"**.
4. The CSV file downloads to your computer. Open it in Excel or Google Sheets.
   File CSV tai ve may tinh. Mo bang Excel hoac Google Sheets.

> **Error state:** If the export button is unresponsive, check your popup blocker. The download may be blocked. Allow popups for this site and try again.
>
> **Loi:** Neu nut xuat khong phan hoi, kiem tra trinh chan popup. Tai xuong co the bi chan. Cho phep popup cho trang nay va thu lai.

---

## 11. Reservations / Dat Ban

### Viewing Reservations / Xem Dat Ban

The Reservations page shows all table bookings.

**Trang Dat Ban hien thi tat ca dat truoc ban.**

[SCREENSHOT: Reservations list showing date, time, customer name, party size, and status columns]

1. Click **"Dat Ban / Reservations"** in the left sidebar.
   Nhan **"Dat Ban / Reservations"** o thanh ben trai.
2. The list shows all upcoming reservations by default.
   Danh sach hien thi tat ca dat ban sap toi theo mac dinh.
3. Use the date filter at the top to view reservations for a specific date.
   Su dung bo loc ngay o phia tren de xem dat ban cho ngay cu the.
4. Each reservation shows / Moi dat ban hien thi:
   - **Khach hang / Customer name**
   - **So dien thoai / Phone number**
   - **So khach / Party size**
   - **Gio / Time**
   - **Ban / Table number**
   - **Trang thai / Status** (Cho xac nhan / Pending, Da xac nhan / Confirmed, Da huy / Cancelled)

> **If reservations do not appear:** Check that you are viewing the correct date. Click **"Hom nay / Today"** to reset the filter.
>
> **Neu dat ban khong xuat hien:** Kiem tra ban dang xem dung ngay. Nhan **"Hom nay / Today"** de dat lai bo loc.

### Confirming/Cancelling Reservations / Xac Nhan/Huy Dat Ban

Manage reservation status.

**Quan ly trang thai dat ban.**

**To confirm a reservation / De xac nhan dat ban:**

1. Click the reservation row to open the details.
   Nhan vao dong dat ban de mo chi tiet.
2. In the **"Trang thai / Status"** section, click **"Xac nhan / Confirm"**.
   Trong phan **"Trang thai / Status"**, nhan **"Xac nhan / Confirm"**.
3. Optionally, select a table number from the dropdown (if not already assigned).
   Tuy chon, chon so ban tu dropdown (neu chua duoc gan).
4. Click **"Luu / Save"**. The status changes to **"Da xac nhan / Confirmed"**.
   Nhan **"Luu / Save"**. Trang thai thay doi thanh **"Da xac nhan / Confirmed"**.

**To cancel a reservation / De huy dat ban:**

1. Click the reservation row to open the details.
   Nhan vao dong dat ban de mo chi tiet.
2. Click **"Huy dat / Cancel reservation"**.
   Nhan **"Huy dat / Cancel reservation"**.
3. Select a reason from the dropdown / Chon ly do tu dropdown:
   - **Khach huy / Customer requested**
   - **Khong den / No-show**
   - **Qua gio / Late (past reservation time)** (choose "Giu ban / Hold table" if the customer is just late / neu khach chi den tre)
4. Click **"Xac nhan / Confirm"**. The reservation is cancelled.
   Nhan **"Xac nhan / Confirm"**. Dat ban bi huy.

> **If you cannot confirm a reservation:** Check that the reservation time has not passed. Past reservations cannot be confirmed.
>
> **Neu khong the xac nhan dat ban:** Kiem tra gio dat ban chua qua. Dat ban qua gio khong the xac nhan.

---

## 12. Audit Logs / Nhat Ky

### Viewing Admin Actions / Xem Hanh Dong Quan Tri

The Audit Logs page records every action performed by admin and staff accounts.

**Trang Nhat Ky ghi lai moi hanh dong cua tai khoan quan tri va nhan vien.**

[SCREENSHOT: Audit log table showing columns: time, actor, action, target, and IP address]

1. Click **"Nhat Ky / Audit Logs"** in the left sidebar.
   Nhan **"Nhat Ky / Audit Logs"** o thanh ben trai.
2. The table displays a chronological list of all actions.
   Bang hien thi danh sach theo thu tu thoi gian cua tat ca hanh dong.
3. Each log entry shows / Moi muc nhat ky hien thi:
   - **Thoi gian / Timestamp**
   - **Nguoi thuc hien / Actor** (staff name or "He thong / System")
   - **Hanh dong / Action** (e.g., "Cap nhat don hang / Update order", "Dang nhap / Login")
   - **Chi tiet / Details** (additional context / thong tin bo sung)
   - **Dia chi IP / IP address**
4. Logs are read-only. You cannot edit or delete them.
   Nhat ky chi doc. Ban khong the chinh sua hoac xoa.

> **If the log is empty:** Audit logging may be disabled. Go to **Settings > Security > Nhat ky hanh dong / Audit Logs** and toggle it ON.
>
> **Neu nhat ky trong:** Tinh nang ghi nhat ky co the bi tat. Vao **Cai Dat > Bao mat > Nhat ky hanh dong / Settings > Security > Audit Logs** va bat len ON.

### Filtering by Date/Actor/Action / Loc Theo Ngay/Nguoi Hanh Dong/Hanh Dong

Use filters to find specific log entries.

**Su dung bo loc de tim muc nhat ky cu the.**

1. At the top of the Audit Logs page, click **"Loc / Filter"**.
   O phia tren trang Nhat Ky, nhan **"Loc / Filter"**.
2. Set your filter criteria / Dat tieu chi loc:
   - **Khoang ngay / Date range** — pick start and end / chon ngay bat dau va ket thuc
   - **Nguoi thuc hien / Actor** — select a specific staff member / chon nhan vien cu the
   - **Hanh dong / Action** — select from action types / chon tu loai hanh dong (Login, Order, Menu, Payment, Staff, Settings)
3. Click **"Ap dung / Apply"** to filter / Nhan **"Ap dung / Apply"** de loc.
4. To reset, click **"Xoa bo loc / Clear filters"**.
   De dat lai, nhan **"Xoa bo loc / Clear filters"**.

> **No results after filtering:** Try a wider date range. The combination of filters may be too narrow — remove one filter at a time to find matching entries.
>
> **Khong co ket qua sau khi loc:** Thu khoang ngay rong hon. Su ket hop bo loc co the qua hep — bo tung bo loc mot de tim muc phu hop.

---

## 13. Sales Reports / Bao Cao

### Period Comparison / So Sanh Ky

Compare sales between two time periods.

**So sanh doanh so giua hai ky.**

[SCREENSHOT: Sales report page with period comparison fields and a comparison chart]

1. Click **"Bao Cao > Ban Hang / Reports > Sales"** in the sidebar.
   Nhan **"Bao Cao > Ban Hang / Reports > Sales"** o thanh ben.
2. In the **"So sanh ky / Period Comparison"** section:
   Trong phan **"So sanh ky / Period Comparison"**:
3. Set **"Ky 1 / Period 1"** start and end dates.
   Dat ngay bat dau va ket thuc cho **"Ky 1 / Period 1"**.
4. Set **"Ky 2 / Period 2"** start and end dates (or check "So sanh voi ky truoc / Compare with previous period" to auto-fill).
   Dat ngay cho **"Ky 2 / Period 2"** (hoac chon "So sanh voi ky truoc / Compare with previous period" de tu dong dien).
5. Click **"So sanh / Compare"**.
6. The report shows / Bao cao hien thi:
   - **Doanh thu / Revenue** for both periods / cho ca hai ky
   - **Chenh lech / Difference** (percentage + value / phan tram + gia tri)
   - **So don / Order count** comparison / so sanh so don

> **If comparison shows "N/A":** One of the periods may have no data. Check that the dates are correct and orders existed in both periods.
>
> **Neu so sanh hien thi "N/A":** Mot trong cac ky co the khong co du lieu. Kiem tra ngay thang va dam bao co don hang trong ca hai ky.

### Grouped Sales (Hour/Day/Category) / Doanh So Theo Nhom

View sales data grouped by hour, day, or product category.

**Xem du lieu ban hang theo gio, ngay, hoac danh muc san pham.**

1. On the Sales Report page, find the **"Nhom theo / Group by"** dropdown.
   Tren trang Bao Cao Ban Hang, tim dropdown **"Nhom theo / Group by"**.
2. Select a grouping option / Chon tuy chon nhom:
   - **Theo gio / By Hour** — shows sales for each hour of the day / hien thi doanh so tung gio trong ngay
   - **Theo ngay / By Day** — shows sales for each day in the report period / hien thi doanh so tung ngay trong ky bao cao
   - **Theo danh muc / By Category** — shows sales per product category / hien thi doanh so theo danh muc san pham
3. The table and chart update automatically to show the grouped data.
   Bang va bieu do tu dong cap nhat de hien thi du lieu theo nhom.

> **Error state:** If the chart does not render after selecting a group, try a different group option and switch back. If it still fails, refresh the page.
>
> **Loi:** Neu bieu do khong hien thi sau khi chon nhom, thu chon nhom khac roi chon lai. Neu van loi, lam moi trang.

### CSV Export / Xuat CSV

Download sales reports as CSV files.

**Tai bao cao ban hang duoi dang file CSV.**

1. On the Sales Report page, click **"Xuat CSV / Export CSV"**.
   Tren trang Bao Cao Ban Hang, nhan **"Xuat CSV / Export CSV"**.
2. Choose the data scope / Chon pham vi du lieu:
   - **Trang hien tai / Current view** — exports the currently displayed data / xuat du lieu dang hien thi
   - **Toan bo ky / Full period** — exports all data in the selected date range / xuat tat ca du lieu trong khoang ngay
3. Click **"Tai xuong / Download"**.
4. The CSV file contains rows with date, product, quantity, revenue, and payment method columns.
   File CSV chua cac hang voi cot: ngay, san pham, so luong, doanh thu, phuong thuc thanh toan.
5. Open in Excel or Google Sheets for further analysis.
   Mo bang Excel hoac Google Sheets de phan tich sau hon.

> **If the CSV has garbled characters (e.g., "???" instead of Vietnamese text):** Open the file in Excel and select **UTF-8 encoding** (Data > From Text/CSV > choose UTF-8). In Google Sheets, use File > Import > CSV with UTF-8.
>
> **Neu CSV hien thi ky tu lo (vi du: "???" thay vi tieng Viet):** Mo file trong Excel va chon **UTF-8 encoding** (Data > From Text/CSV > chon UTF-8). Trong Google Sheets, dung File > Import > CSV voi UTF-8.

---

## Appendix / Phu Luc

### A. Common Error Messages / Thong Bao Loi Thuong Gap

| Error / Loi | Meaning / Y Nghia | Action / Cach Giai Quyet |
|---|---|---|
| "Khong the tai du lieu / Cannot load data" | Server connection issue / Loi ket noi may chu | Click "Thu lai / Retry". If persistent, check internet. |
| "Phien dang nhap het han / Session expired" | You were logged out due to inactivity / Bi dang xuat do khong hoat dong | Refresh the page and log in again. |
| "Truong nay la bat buoc / This field is required" | A required field is empty / Mot truong bat buoc con trong | Fill in the highlighted field. |
| "Email da ton tai / Email already exists" | Duplicate email / Email da ton tai | Use a different email address. |
| "Loi may chu / Server error (500)" | Internal server problem / Loi may chu ben trong | Wait 1-2 minutes, then try again. Contact support if it persists. |

### B. Quick Keyboard Shortcuts / Phim Tat

| Shortcut / Phim Tat | Action / Hanh Dong |
|---|---|
| **F5** or **Cmd+R** | Refresh current page / Lam moi trang |
| **Ctrl + F** | Open search on the current page / Mo tim kiem |
| **Esc** | Close modal / popup / Dong cua so popup |

### C. Contact Support / Lien He Ho Tro

If you encounter an error that "Thu lai / Retry" does not fix, contact technical support:

**Neu gap loi ma "Thu lai / Retry" khong khac phuc, lien he ho tro ky thuat:**

- **Email:** support@fnb-container-caffe.com
- **Phone / Dien thoai:** [Your support number / So ho tro cua ban]
- **Response time / Thoi gian phan hoi:** Within 2 business hours / Trong vong 2 gio lam viec

---

*End of Admin Manual / Het Huong Dan Quan Tri*
