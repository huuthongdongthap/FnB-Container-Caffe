# 📋 TASK 21 — Uniform Check Daily

> **Branch:** `feat/hr-uniform-check`
> **Estimated:** 3-4h worker
> **Dependency:** Task 19 + 20 merged

---

## 🎯 Objective

UI cho manager/owner check đồng phục 5 items đầu mỗi ca → log vào `uniform_check_log`.

**5 items checklist (theo SOP 01):**
1. Áo thun đồng phục AURA (sạch + ủi)
2. Tạp dề AURA (sạch + buộc dây gọn)
3. Đầu tóc gọn gàng (nữ buộc cao, nam vuốt gọn)
4. Giày kín mũi (không dép lê)
5. Vệ sinh cá nhân (tay rửa xà phòng)

**Auto-classify status:**
- All 5 OK → `ok`
- 1 sai → `minor_violation`
- ≥ 2 sai → `major_violation`

---

## 📋 Acceptance Criteria

- [ ] 3 endpoints test pass
- [ ] UI `/admin/hr/uniform-check.html` mobile-first
- [ ] Auto-classify status đúng
- [ ] Camera upload photo cho major_violation (Cloudflare R2 hoặc inline base64)
- [ ] PR mở: "feat(hr): uniform check daily"

---

## 🔌 Endpoints

### 1. `POST /api/hr/uniform/check`
**Auth:** Owner/Manager JWT

```json
{
  "staff_id": "STAFF_CUONG",
  "shift_type": "morning",
  "shirt_ok": true,
  "apron_ok": true,
  "hair_ok": true,
  "shoes_ok": false,
  "hygiene_ok": true,
  "violation_note": "Đi dép lê — đã yêu cầu đổi giày",
  "photo_url": null
}
```

**Logic:**
```js
async function logUniformCheck(env, body, checkerId) {
  const items = [body.shirt_ok, body.apron_ok, body.hair_ok, body.shoes_ok, body.hygiene_ok];
  const failCount = items.filter(x => !x).length;
  const status = failCount === 0 ? 'ok'
               : failCount === 1 ? 'minor_violation'
               : 'major_violation';

  const id = `UNIF_${new Date().toISOString().slice(0,10).replace(/-/g,'')}_${Math.random().toString(36).slice(2,8)}`;

  await env.AURA_DB.prepare(`
    INSERT INTO uniform_check_log
      (id, staff_id, check_date, shift_type, status,
       shirt_ok, apron_ok, hair_ok, shoes_ok, hygiene_ok,
       violation_note, photo_url, checker_id)
    VALUES (?, ?, date('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, body.staff_id, body.shift_type, status,
    body.shirt_ok ? 1 : 0, body.apron_ok ? 1 : 0, body.hair_ok ? 1 : 0,
    body.shoes_ok ? 1 : 0, body.hygiene_ok ? 1 : 0,
    body.violation_note || null, body.photo_url || null, checkerId
  ).run();

  return { success: true, id, status, fail_count: failCount };
}
```

### 2. `GET /api/hr/uniform/today`
List vi phạm hôm nay cho dashboard.

### 3. `GET /api/hr/uniform/staff/:id/violations?period=2026-Q2`
Count vi phạm 1 staff/quý cho performance review.

---

## 🎨 UI `/admin/hr/uniform-check.html`

```
┌──────────────────────────────────────┐
│ 👔 Check đồng phục                    │
│                                      │
│ Staff: [Cường (Barista) ▼]          │
│ Ca:    [Sáng ▼]                      │
│                                      │
│ Checklist 5 items:                   │
│ ☑ Áo thun AURA sạch + ủi             │
│ ☑ Tạp dề AURA gọn                    │
│ ☑ Đầu tóc gọn                        │
│ ☐ Giày kín mũi          ← FAIL       │
│ ☑ Vệ sinh tay                        │
│                                      │
│ ⚠️ Status: MINOR VIOLATION (1 sai)   │
│                                      │
│ Ghi chú: [Đi dép lê — đổi giày____]  │
│                                      │
│ 📷 Chụp ảnh (optional cho major)     │
│                                      │
│ [✅ Log check]                       │
│                                      │
│ ─────────────────────────────────    │
│ Vi phạm gần đây:                     │
│ • Khánh 02/6 minor (đầu tóc)         │
│ • Ngọc 01/6 minor (giày)             │
└──────────────────────────────────────┘
```

JS pseudocode:

```js
const checkboxes = ['shirt','apron','hair','shoes','hygiene'];
function calcStatus() {
  const fails = checkboxes.filter(c => !$(`chk_${c}`).checked).length;
  const status = fails === 0 ? 'ok' : fails === 1 ? 'minor_violation' : 'major_violation';
  $('statusPreview').textContent = status.toUpperCase();
  $('statusPreview').className = `status-${status}`;
}
checkboxes.forEach(c => $(`chk_${c}`).addEventListener('change', calcStatus));

$('btnLog').addEventListener('click', async () => {
  const body = {
    staff_id: $('staffSelect').value,
    shift_type: $('shiftSelect').value,
    shirt_ok: $('chk_shirt').checked,
    apron_ok: $('chk_apron').checked,
    hair_ok: $('chk_hair').checked,
    shoes_ok: $('chk_shoes').checked,
    hygiene_ok: $('chk_hygiene').checked,
    violation_note: $('note').value || null,
    photo_url: photoUploaded ? photoUrl : null
  };
  const res = await fetch('/api/hr/uniform/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (data.success) {
    showToast(`Logged: ${data.status} (${data.fail_count} fail)`);
    loadRecent();
  }
});
```

---

## 🧪 Test cases

```js
// T1: All 5 OK → status='ok'
// T2: 1 fail (shoes) → status='minor_violation'
// T3: 3 fail → status='major_violation'
// T4: GET /today → list theo created_at desc
// T5: GET /staff/STAFF_CUONG/violations?period=2026-Q2 → return count breakdown
```

---

## 🎯 Integration với SOP

File SOP 01 đã có section "👔 Điểm danh, Chấm công & Đồng phục" — manager/Khánh (sang chiều) sẽ:
1. Sau khi staff arrive 6:00
2. Mở `/admin/hr/uniform-check.html` trên tablet
3. Chọn staff + 5 checkbox
4. Submit
5. Nếu violation → discuss với staff + ghi note
