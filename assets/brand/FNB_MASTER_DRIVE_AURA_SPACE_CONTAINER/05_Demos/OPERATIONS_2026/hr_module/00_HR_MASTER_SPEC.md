# 👥 HR MODULE — MASTER SPEC

> **Đây là file SPEC TỔNG HỢP cho HR module. Đọc file này TRƯỚC khi đọc 5 task riêng (19-23).**
> **Ngày:** T3 03/06/2026
> **Mục đích:** Audit hiện trạng + spec đầy đủ HR features cho Claude Code CLI worker thực thi
> **Output:** 5 PRs (Tasks 19-23), ~20-26h worker, ~1 tuần calendar

---

## 1️⃣ AUDIT HIỆN TRẠNG

### 1.1 Inventory Module — 5 specs đã có

| Task | File | Status |
|---|---|---|
| 14 | `inventory_plan/14-inventory-schema-multi-supplier.md` | ✅ Spec, chưa dispatch |
| 15 | `inventory_plan/15-inventory-receiving-po.md` | ✅ Spec, chưa dispatch |
| 16 | `inventory_plan/16-recipe-auto-deduct.md` | ✅ Spec, chưa dispatch |
| 17 | `inventory_plan/17-waste-cogs-margin.md` | ✅ Spec, chưa dispatch |
| 18 | `inventory_plan/18-inventory-admin-ui.md` | ✅ Spec, chưa dispatch |

### 1.2 SOP — 7 files

| File | HR mentions |
|---|---|
| `01_OPENING_CHECKLIST.md` | ✅ Anh đã thêm "Điểm danh + Chấm công + Đồng phục" |
| `02_CLOSING_CHECKLIST.md` | ✅ Anh đã thêm "Check-out + đồng phục cuối ca" |
| `03-07` | ❌ Không có HR sections |

### 1.3 🔴 Gaps phát hiện

SOP nói "app chấm công" + "đánh giá NV" nhưng **KHÔNG có backend**:
- ❌ DB schema cho staff/attendance/uniform/performance
- ❌ API endpoints check-in/out, uniform check, review
- ❌ Admin UI timesheet, payroll, performance dashboard
- ❌ Tích hợp payroll auto

→ **Cần build HR Module từ schema đến UI.**

---

## 2️⃣ DECISIONS — Anh Còn chốt 02/06

| # | Question | Answer |
|---|---|---|
| Q1 | Biometric device | **Chưa có** → dùng **QR mobile** (Task 20) |
| Q2 | Pay method | **Monthly fixed** (KHÔNG hourly) |
| Q3 | Review frequency | **Quarterly** |
| Q4 | Lương 4 staff (giả định) | Cường 7.5tr / Thư 7tr / Khánh 6.5tr / Ngọc 5tr |
| Q5 | Departments | Cường + Thư = **barista**, Khánh = **cashier**, Ngọc = **mixed** (probation) |

---

## 3️⃣ 5 TASKS — Spec summary table

| # | Task | Branch | Worker time | Calendar | File |
|---|---|---|---|---|---|
| **19** | HR Schema v1 (4 tables + 2 views + 4 staff seed) | `feat/hr-schema-v1` | 3-4h | T2 08/6 | [19-hr-schema.md](./19-hr-schema.md) |
| **20** | Attendance API + QR mobile (6 endpoints + frontend) | `feat/hr-attendance-qr` | 4-6h | T3 09/6 | [20-hr-attendance-qr.md](./20-hr-attendance-qr.md) |
| **21** | Uniform Check Daily (3 endpoints + UI 5-item) | `feat/hr-uniform-check` | 3-4h | T4 10/6 | [21-hr-uniform-check.md](./21-hr-uniform-check.md) |
| **22** | Performance Review Quarterly (4 endpoints + auto-calc KPI) | `feat/hr-performance-review` | 5-6h | T5-T6 11-12/6 | [22-hr-performance-review.md](./22-hr-performance-review.md) |
| **23** | HR Admin UI (7 pages + 1 staff QR landing) | `feat/hr-admin-ui` | 5-6h | T7-CN 13-14/6 | [23-hr-admin-ui.md](./23-hr-admin-ui.md) |
| **Dispatch** | Commands send_task.sh + apply migration + verify | — | — | — | [DISPATCH_HR_COMMANDS.md](./DISPATCH_HR_COMMANDS.md) |

**Tổng:** 20-26h worker, **~1 tuần calendar**.

---

## 4️⃣ KEY DESIGN DECISIONS

### 4.1 Schema (Task 19)

**4 tables + 2 views:**
- `staff_profiles` — master 4 NV + monthly_salary_vnd
- `staff_attendance` — check-in/out, late/overtime auto-calc, UNIQUE(staff, date, shift)
- `uniform_check_log` — 5 items boolean + auto-classify status
- `performance_review` — 5 KPI weighted (P 20% + U 10% + Q 30% + A 20% + T 20%)
- `v_staff_monthly_summary` — aggregate giờ + lương
- `v_uniform_violations` — count vi phạm/tháng

### 4.2 Attendance QR mobile (Task 20)

**Flow:**
```
Owner in QR cá nhân cho 4 staff (A6 laminate, đeo keychain)
  ↓
Staff scan QR bằng phone camera → mở /staff/checkin?staff_id=X&signature=Y
  ↓
App load staff info → staff chọn ca → bấm CHECK IN
  ↓
Backend verify HMAC signature → INSERT attendance → return late warning
```

**Security:** HMAC SHA256 với JWT_SECRET → chống fake QR.

### 4.3 Uniform check (Task 21)

**5 items checklist:**
1. Áo thun AURA
2. Tạp dề
3. Đầu tóc gọn
4. Giày kín mũi
5. Vệ sinh tay

**Auto status:**
- 0 fail → `ok`
- 1 fail → `minor_violation`
- ≥ 2 fail → `major_violation` (chụp ảnh evidence)

### 4.4 Performance review (Task 22)

**Auto-calc formula:**

```js
scorePunctuality = max(1, min(5, 5 - avg_late_per_day / 5))
  // 0 trễ = 5⭐, 10p avg = 3⭐, 25p+ = 1⭐

scoreUniform = max(1, min(5, 5 - violations_weighted / 4))
  // major nặng gấp 2 minor

scoreTotal = P×0.20 + U×0.10 + Q×0.30 + A×0.20 + T×0.20
```

**Bonus matrix:**

| Score | Action |
|---|---|
| 4.5 - 5.0 | Bonus 500k-1tr + raise 5-10% |
| 4.0 - 4.4 | Bonus 200-500k |
| 3.5 - 3.9 | Ghi nhận |
| 3.0 - 3.4 | Warning verbal |
| 2.5 - 2.9 | Warning written |
| < 2.5 | Final / consider termination |

### 4.5 Admin UI (Task 23)

**7 pages:**
1. `index.html` — Dashboard (today attendance, alerts, quick actions)
2. `staff.html` — CRUD profile + Print QR
3. `timesheet.html` — Bảng chấm công tháng (like Excel BCC)
4. `uniform-check.html` — Daily check form
5. `review.html` — List + detail edit
6. `payroll.html` — Tính lương monthly (fixed - deductions + bonus)
7. `reports.html` — Turnover, top performer, training needs

**Plus 1 public page:**
- `staff/checkin.html` — QR landing (Task 20)

---

## 5️⃣ EXECUTION CHECKLIST cho worker

Worker đọc file 00 này → quyết định approach → dispatch theo thứ tự 19 → 20 → 21 → 22 → 23.

### Pre-dispatch (anh Còn làm):

- [ ] Backup D1 production: `npx wrangler d1 export ... > backups/pre-hr.sql`
- [ ] Verify tmux: `tmux list-panes -t mekong-cto:cto-worker`
- [ ] Copy 6 file specs vào `.claude-tasks/hr/` trong repo
- [ ] Tạo 4 user KV cho 4 staff (Cường/Thư/Khánh/Ngọc) nếu chưa có:
  ```bash
  curl -X POST .../api/auth/register-staff \
    -H "Authorization: Bearer $OWNER_TOKEN" \
    -d '{"email":"cuong@auraspace.vn","password":"<temp>","name":"Cường","role":"staff"}'
  ```

### During dispatch:

- [ ] Task 19 → worker tạo migration + apply local + open PR
- [ ] Anh review PR + apply remote → merge
- [ ] Task 20 → worker code endpoints + frontend → PR → merge → deploy worker
- [ ] Task 21 → tương tự
- [ ] Task 22 → tương tự (test generate quarterly)
- [ ] Task 23 → tương tự (deploy Pages)

### Post-dispatch:

- [ ] In QR A6 cho 4 staff
- [ ] Train staff 30 phút mỗi người
- [ ] Update SOP 01 + 02 với URL chính xác
- [ ] First review Q2-2026 cuối tháng 6

---

## 6️⃣ DEPENDENCIES

```
Task 19 (Schema)
  ↓ (must merge first)
Task 20 (Attendance) ← reference staff_profiles
  ↓
Task 21 (Uniform)    ← reference staff_profiles + checker_id
  ↓
Task 22 (Review)     ← aggregate from attendance + uniform
  ↓
Task 23 (Admin UI)   ← consume all above APIs
```

→ **Sequential dispatch BẮT BUỘC** — không thể chạy song song.

---

## 7️⃣ INTEGRATION POINTS

### SOP linkage

File `01_OPENING_CHECKLIST.md` line 13:
> "Chấm công đầu ca: Thực hiện quét vân tay / quét FaceID check-in trên app chấm công của AURA"

→ Sau deploy Task 20, em sẽ update thành:
> "Chấm công đầu ca: Scan QR cá nhân (đeo keychain) → mở `/staff/checkin` → bấm CHECK IN trong 30 giây"

### Existing system integration

- **Reuse:** `loyalty_audit_log` cho tracking HR actions (vd `action='hr_attendance'`)
- **Reuse:** `users` KV cho JWT auth (staff đã có account)
- **Add:** `staff_profiles` table mới — link bằng email

### Future enhancements (out of scope)

- Self-service portal staff
- Zalo OA notification (sau Task 13 Zalo)
- Multi-location (khi mở chi nhánh 2)
- Tax integration cho thuế thu nhập cá nhân

---

## 8️⃣ RISK + ROLLBACK

| Risk | Mitigation |
|---|---|
| QR signature forge | HMAC SHA256 + expiration time |
| Staff cheat (nhờ người chấm) | Audit log + Khánh kiểm tra hôm sau qua dashboard |
| Migration fail remote | Backup pre-hr.sql sẵn để restore |
| Performance review tính sai | Re-generate bằng DELETE + POST /generate |

---

## 9️⃣ NEXT STEPS

**Cho anh Còn:**

1. Đọc 6 files (00, 19, 20, 21, 22, 23, DISPATCH) trong folder `hr_module/`
2. Confirm OK với spec → ping em
3. Anh chọn 1:
   - 🚀 **Tự dispatch** qua Mekong CLI (em sẽ standby verify)
   - 🤖 **Em dispatch** qua GitHub MCP từng task
   - ⏸ **Pause** đến sau khai trương 6/6 + ổn định 1 tuần

**Cho em (sau khi anh confirm):**

1. Sau Task 19 merge → em update SOP 01 + 02 với URL chấm công chuẩn
2. Sau Task 20 merge → em tạo SVG QR A6 cho 4 staff
3. Sau Task 23 merge → em viết hướng dẫn train staff 1 trang A4

---

## 🔚 TÓM TẮT 1 CÂU

**5 tasks (19-23) build HR module hoàn chỉnh: schema + QR check-in + uniform check + quarterly review + 7 admin pages. ~1 tuần worker, dispatch sau khai trương 6/6 ổn.**

---

📂 **Files trong folder `hr_module/`:**

```
hr_module/
├── 00_HR_MASTER_SPEC.md       ← FILE NÀY (đọc đầu tiên)
├── 19-hr-schema.md
├── 20-hr-attendance-qr.md
├── 21-hr-uniform-check.md
├── 22-hr-performance-review.md
├── 23-hr-admin-ui.md
└── DISPATCH_HR_COMMANDS.md
```
