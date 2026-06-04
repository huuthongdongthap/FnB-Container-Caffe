# 📋 TASK 23 — HR Admin UI Complete

> **Branch:** `feat/hr-admin-ui`
> **Estimated:** 5-6h worker
> **Dependency:** Tasks 19, 20, 21, 22 merged

---

## 🎯 Objective

7 admin pages dưới `/admin/hr/` cho owner manage HR end-to-end.

```
admin/hr/
├── index.html              — Dashboard HR (today + alerts)
├── staff.html              — CRUD staff profiles + print QR
├── timesheet.html          — Bảng chấm công tháng (giống Excel BCC)
├── uniform-check.html      — Daily uniform check form (Task 21)
├── review.html             — Performance review list + edit
├── payroll.html            — Tính lương tháng (monthly fixed - deductions + bonus)
└── reports.html            — Reports: turnover, top performer, training needs
```

Plus 1 page public:
- `staff/checkin.html` — QR landing cho staff check-in (Task 20)

---

## 📋 Acceptance Criteria

- [ ] 7 admin pages + 1 public page render đúng brand AURA dark gold
- [ ] Mobile responsive 375-1920px
- [ ] Export Excel/CSV payroll + timesheet
- [ ] Auto-calc preview real-time khi nhập manual score (Task 22)
- [ ] PR mở: "feat(hr): admin UI complete 7 pages"

---

## 🎨 Page details

### Page 1: `admin/hr/index.html` — Dashboard

```
┌──────────────────────────────────────────────────┐
│ 👥 HR DASHBOARD                                   │
│                                                  │
│ ┌────────┬────────┬────────┬────────┐           │
│ │Hôm nay │Đi trễ  │Vi phạm │Review  │           │
│ │ 3/4 ✅  │1 (5p)  │ 0      │1 chờ ký│           │
│ └────────┴────────┴────────┴────────┘           │
│                                                  │
│ ┌─ Attendance hôm nay ────────────────────────┐ │
│ │ ✅ Cường  06:00 → ⏳                          │ │
│ │ ✅ Khánh  06:05 (5p trễ) → ⏳                 │ │
│ │ ✅ Thư    16:00 → ⏳                          │ │
│ │ ⏳ Ngọc   chưa check-in                       │ │
│ └────────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ Quick actions ─────────────────────────────┐ │
│ │ [👔 Check đồng phục] [⏰ Override timesheet] │ │
│ │ [📋 Tạo review Q3]   [💰 Tính lương tháng]  │ │
│ └────────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ Alerts ────────────────────────────────────┐ │
│ │ ⚠ Ngọc probation hết hạn 25/7 — cần review  │ │
│ │ ⚠ Khánh trễ 3 lần tuần này → discuss        │ │
│ └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### Page 2: `admin/hr/staff.html` — CRUD

Table 4 staff + Add new button. Click row → modal edit:
- Edit name, phone, department, monthly_salary, probation_end
- Toggle is_active
- **[📄 Print QR chấm công]** button → mở `/api/hr/staff/qr/STAFF_xxx` SVG → in laminate

### Page 3: `admin/hr/timesheet.html` — Bảng chấm công

Giống Excel BCC tháng 5 anh quen:

```
Tháng: [6/2026 ▼] [Export Excel]

┌─────┬──────────┬──────────┬──────────┬──────────┐
│Ngày │ Cường    │ Khánh    │ Thư      │ Ngọc     │
├─────┼──────────┼──────────┼──────────┼──────────┤
│ 01  │ 8h       │ 8h       │ 8h       │ 5h       │
│ 02  │ 11h      │ 11h      │ 8.5h     │ 6h       │
│ ... │ ...      │ ...      │ ...      │ ...      │
│ 30  │ 8h       │ 8h       │ 0 (off)  │ 5h       │
├─────┼──────────┼──────────┼──────────┼──────────┤
│Total│ 254h     │ 252h     │ 201.5h   │ 50h      │
└─────┴──────────┴──────────┴──────────┴──────────┘
```

Click cell → mini modal edit/override.

### Page 4: `admin/hr/uniform-check.html`

Đã spec trong Task 21.

### Page 5: `admin/hr/review.html`

List view + detail view:

```
┌──────────────────────────────────────────────────┐
│ 📊 PERFORMANCE REVIEW                              │
│                                                  │
│ Period: [Q3-2026 ▼] [+ Generate quarter này]    │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ Cường   — 4.6⭐ ✅ Signed                    │ │
│ │   Punc: 5.0  Unif: 5.0  Qual: 4.5  Att: 4.0│ │
│ │   Bonus: +500k                              │ │
│ │ [View]                                       │ │
│ │                                              │ │
│ │ Khánh   — 4.2⭐ ⏳ Draft (chưa sign)         │ │
│ │   Punc: 4.0  Unif: 5.0  Qual: 4.5  ...      │ │
│ │ [Edit] [Sign reviewer]                       │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

Detail page (`/admin/hr/review.html?id=REV_xxx`):

```
┌──────────────────────────────────────────────────┐
│ Review: Cường — Q3 2026 (07/01 - 09/30)          │
│                                                  │
│ Auto-calc (từ data):                             │
│   • Tổng giờ:        254h                        │
│   • Số ngày:         30                          │
│   • Trễ:             45 phút (1.5p/ngày)         │
│   • Uniform violations: 0                        │
│                                                  │
│ Scores (1-5⭐):                                   │
│   • Punctuality:   ▓▓▓▓░ 4.7 (auto)              │
│   • Uniform:       ▓▓▓▓▓ 5.0 (auto)              │
│   • Quality:       [4.5  ] (owner rate)          │
│   • Attitude:      [4.0  ] (owner rate)          │
│   • Teamwork:      [4.2  ] (owner rate)          │
│   ═══════════════════════════════                │
│   • Total:         4.4⭐ (weighted)               │
│                                                  │
│ Feedback:                                        │
│   Strengths:    [________________________]      │
│   Improvements: [________________________]      │
│   Goals next Q: [________________________]      │
│                                                  │
│ Reward:                                          │
│   Bonus: [500.000đ]                              │
│   Raise: [0%]                                    │
│   Warning: [None ▼]                              │
│                                                  │
│ [💾 Save draft]  [✍️ Sign as reviewer]            │
└──────────────────────────────────────────────────┘
```

### Page 6: `admin/hr/payroll.html` — Tính lương

Vì pay_method = monthly, tính lương đơn giản hơn hourly:

```
Tháng: [6/2026 ▼] [Tính lại]

┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Staff    │ Base/tháng│ Hours    │ Bonus    │ Khấu trừ │ Net      │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Cường    │ 7.500k   │ 254h ✅  │ +500k    │ 0        │ 8.000k   │
│ Thư      │ 7.000k   │ 202h ✅  │ 0        │ 0        │ 7.000k   │
│ Khánh    │ 6.500k   │ 252h ✅  │ +300k    │ -50k late│ 6.750k   │
│ Ngọc     │ 5.000k*  │ 50h ⚠    │ 0        │ -200k pro│ 4.800k   │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘

* Ngọc đang probation đến 25/7
⚠ Ngọc chỉ 50h → check probation criteria

Total payroll: 26.550k
[Export Excel]  [Confirm + Lock]
```

Logic:
- Monthly fixed → không phụ thuộc hours (nhưng hiển thị để owner check)
- Bonus từ performance review nếu signed trong period
- Khấu trừ: late > 10 phút × N lần → trừ X% (anh Còn config rule)
- Lock payroll cuối tháng → không edit được

### Page 7: `admin/hr/reports.html`

3 reports:
- **Turnover rate** — nhân viên nghỉ/quý
- **Top performer** — leaderboard scores quarter
- **Training needs** — staff có score < 3.5 cần training

---

## 🛡 Style guide (consistent existing admin)

```css
:root {
  --bg: #0A0A0A; --card: #1A1A1A;
  --gold: #C9A200; --electric: #FFD700;
  --success: #4ADE80; --warn: #FBBF24; --danger: #EF4444;
}

/* Tier-like badges cho score */
.score-high { color: var(--success); }   /* >= 4.5 */
.score-mid  { color: var(--warn); }      /* 3.5 - 4.4 */
.score-low  { color: var(--danger); }    /* < 3.5 */
```

Mobile sidebar collapse hamburger < 768px.

---

## 🧪 Test cases

```js
// T1: Dashboard load → 3 KPIs + alerts auto-fetch
// T2: Print QR → SVG download cho 4 staff
// T3: Timesheet click cell empty → modal "Add attendance manual"
// T4: Review generate Q3 → 4 drafts created
// T5: Payroll click "Tính lại" → tổng đúng
// T6: Export Excel timesheet + payroll
```

---

## ⏭ Khả năng mở rộng tương lai

- Self-service portal staff xem timesheet + payroll của họ
- Mobile app native (React Native) cho check-in offline
- Integration với báo cáo thuế thu nhập cá nhân
- Multi-location support (khi mở chi nhánh 2)
