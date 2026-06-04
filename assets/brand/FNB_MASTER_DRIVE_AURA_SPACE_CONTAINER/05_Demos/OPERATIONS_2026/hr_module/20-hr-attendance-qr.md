# 📋 TASK 20 — Attendance API + QR Mobile

> **Branch:** `feat/hr-attendance-qr`
> **Estimated:** 4-6h worker
> **Dependency:** Task 19 merged

---

## 🎯 Objective

API check-in/out qua **QR mobile** (anh chưa có biometric device → Option B).

**Flow:**
1. Owner in 4 thẻ QR cá nhân (mỗi staff 1 QR encode `staff_id`)
2. Hoặc staff scan QR ở quầy → mở app `/staff/checkin.html`
3. App pre-fill staff_id từ QR + staff confirm submit
4. Backend log + return late warning

---

## 📋 Acceptance Criteria

- [ ] 6 endpoints test pass
- [ ] Frontend `/staff/checkin.html` (mobile-first)
- [ ] QR generator endpoint cho admin print
- [ ] Late detection chính xác
- [ ] Hours_worked auto-calc khi check-out
- [ ] PR mở: "feat(hr): attendance API + QR mobile flow"

---

## 🔌 6 Endpoints

### 1. `GET /api/hr/staff/qr/:staff_id`
**Auth:** Owner JWT
**Purpose:** Sinh QR code PNG/SVG cho 1 staff (in laminate dán quầy)

Response: SVG QR encode URL `https://fnb-caffe-container.pages.dev/staff/checkin?staff_id=STAFF_CUONG&signature=<hmac>`

Signature dùng JWT_SECRET HMAC để chống fake QR.

### 2. `POST /api/hr/attendance/check-in`
**Auth:** Staff JWT (login từ QR landing) OR signed URL từ QR

```json
{
  "staff_id": "STAFF_CUONG",
  "shift_type": "morning",
  "source": "qr_mobile",
  "device_id": "iPhone-Cuong",
  "expected_in": "06:00",
  "expected_out": "11:00"
}
```

**Logic:**
```js
async function checkIn(env, body) {
  // 1. Verify staff
  const staff = await env.AURA_DB.prepare(
    'SELECT id, full_name, is_active FROM staff_profiles WHERE id = ?'
  ).bind(body.staff_id).first();
  if (!staff || !staff.is_active) {
    return { error: 'staff_not_active' };
  }

  // 2. Check duplicate (UNIQUE INDEX)
  const today = new Date().toISOString().slice(0, 10);
  const existing = await env.AURA_DB.prepare(
    `SELECT id FROM staff_attendance
     WHERE staff_id=? AND shift_date=? AND shift_type=?`
  ).bind(body.staff_id, today, body.shift_type).first();
  if (existing) {
    return { error: 'already_checked_in', existing_id: existing.id };
  }

  // 3. Calc late_minutes
  const now = new Date();
  const expectedIn = body.expected_in
    ? new Date(`${today}T${body.expected_in}:00+07:00`)
    : null;
  const lateMin = expectedIn ? Math.max(0, Math.round((now - expectedIn) / 60000)) : 0;

  // 4. Insert
  const attId = `ATT_${today.replace(/-/g,'')}_${Math.random().toString(36).slice(2,8)}`;
  await env.AURA_DB.prepare(`
    INSERT INTO staff_attendance
      (id, staff_id, shift_date, shift_type, check_in_at, expected_in, expected_out,
       late_minutes, source, device_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    attId, body.staff_id, today, body.shift_type, now.toISOString(),
    body.expected_in, body.expected_out, lateMin, body.source, body.device_id || null, body.notes || null
  ).run();

  return {
    success: true,
    attendance_id: attId,
    staff_name: staff.full_name,
    late_minutes: lateMin,
    warning: lateMin > 5 ? `⚠️ Trễ ${lateMin} phút` : null,
    message: lateMin > 5
      ? `Check-in thành công nhưng trễ ${lateMin} phút`
      : 'Check-in thành công đúng giờ'
  };
}
```

### 3. `POST /api/hr/attendance/check-out`
Tương tự, tìm row mở (check_out_at IS NULL) → set check_out_at + calc hours_worked + overtime.

### 4. `GET /api/hr/attendance/today`
List tất cả attendance hôm nay cho admin dashboard.

### 5. `GET /api/hr/attendance/staff/:staff_id?month=YYYY-MM`
Timesheet 1 staff/tháng (cho payroll).

### 6. `POST /api/hr/attendance/admin-override`
Owner-only manual add/edit (vd staff quên check-in):
```json
{
  "staff_id": "STAFF_CUONG",
  "shift_date": "2026-06-03",
  "shift_type": "morning",
  "check_in_at": "2026-06-03T06:05:00+07:00",
  "check_out_at": "2026-06-03T11:00:00+07:00",
  "notes": "Manual override: app down sáng 3/6"
}
```

---

## 🎨 Frontend `/staff/checkin.html`

Mobile-first 1 page:

```html
<!DOCTYPE html>
<html lang="vi">
<head>...</head>
<body>
  <div class="container">
    <h1>⏰ Chấm công AURA</h1>
    <div class="staff-info" id="staffInfo">
      <!-- Loaded từ ?staff_id=... -->
      <div class="avatar">👤</div>
      <div class="name" id="staffName">—</div>
      <div class="dept" id="staffDept">—</div>
    </div>

    <div class="form">
      <label>Ca làm</label>
      <select id="shiftType">
        <option value="morning">Sáng (06:00 - 11:00)</option>
        <option value="afternoon">Trưa (11:00 - 16:00)</option>
        <option value="evening">Tối (16:00 - 22:30)</option>
        <option value="full_day">Cả ngày</option>
      </select>

      <button class="btn-primary" id="btnCheckIn">✅ CHECK IN</button>
      <button class="btn-secondary" id="btnCheckOut">🚪 CHECK OUT</button>
    </div>

    <div id="resultBox"></div>
  </div>

  <script>
  const params = new URLSearchParams(location.search);
  const staffId = params.get('staff_id');
  const signature = params.get('signature');

  if (!staffId) {
    alert('QR không hợp lệ. Vui lòng scan lại.');
  }

  // Lookup staff
  async function loadStaff() {
    const res = await fetch(`/api/hr/staff/${staffId}`);
    const data = await res.json();
    if (data.success) {
      $('staffName').textContent = data.staff.full_name;
      $('staffDept').textContent = data.staff.department;
    }
  }

  // Check-in
  $('btnCheckIn').addEventListener('click', async () => {
    const shift = $('shiftType').value;
    const expected = { morning: {in:'06:00',out:'11:00'}, afternoon: {in:'11:00',out:'16:00'},
                       evening: {in:'16:00',out:'22:30'}, full_day: {in:'06:00',out:'22:30'} }[shift];

    const res = await fetch('/api/hr/attendance/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staff_id: staffId,
        shift_type: shift,
        source: 'qr_mobile',
        device_id: navigator.userAgent.slice(0, 50),
        expected_in: expected.in,
        expected_out: expected.out
      })
    });
    const data = await res.json();
    showResult(data);
  });

  function showResult(data) {
    if (data.success) {
      const cls = data.warning ? 'warn' : 'success';
      $('resultBox').innerHTML = `<div class="alert ${cls}">${data.message}</div>`;
    } else {
      $('resultBox').innerHTML = `<div class="alert danger">${data.error}</div>`;
    }
  }
  </script>
</body>
</html>
```

→ Brand AURA dark gold, responsive mobile.

---

## 🛡 Security note

**QR signature mechanism:**
- Server: `signature = HMAC_SHA256(JWT_SECRET, staff_id + valid_until)`
- QR URL: `?staff_id=STAFF_CUONG&signature=abc123&exp=2027-12-31`
- Endpoint verify signature trước khi accept check-in

→ Nếu staff đưa QR cho người khác → vẫn check-in được. **Trust-based.** Anh Còn audit qua dashboard nếu phát hiện chấm công ảo.

**Anti-fraud:**
- 1 device_id chỉ check-in 1 staff/ngày (optional)
- Cron 22h chạy: alert nếu staff check-out > 14h sau check-in (forgot)
- Audit log mọi attempt vào `loyalty_audit_log` action='hr_attendance'

---

## 🧪 Test cases

```js
// T1: Cường check-in 06:00 → success, late=0
// T2: Cường check-in 06:10 → success, late=10, warning
// T3: Cường check-in lần 2 cùng ngày → 409 already_checked_in
// T4: Cường check-out 11:05 → hours=5.08, overtime=5min
// T5: Cường check-out lần 2 → 409 already_checked_out
// T6: Khánh quên check-in → owner POST /admin-override
// T7: Staff không tồn tại → 404
// T8: Staff inactive → 403
```

---

## ⏭ Dependency cho tasks sau

Task 22 Performance review sẽ aggregate từ `staff_attendance`:
- `total_hours_worked` = SUM(hours_worked) trong period
- `total_days_attended` = COUNT(DISTINCT shift_date)
- `total_late_minutes` = SUM(late_minutes)
- `score_punctuality` = 5 - (total_late_mins / total_days / 10)
