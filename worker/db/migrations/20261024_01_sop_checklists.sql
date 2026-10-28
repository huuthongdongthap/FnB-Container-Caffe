-- Staff SOP checklists: templates, runs, run items, and conduct violations.
--
-- The paper SOPs in docs/sop/ are static markdown: staff cannot tick them,
-- a shift leader cannot see progress, and the owner has no evidence of what
-- actually ran. These tables hold the executable form — one template per
-- checklist, one run per execution, one row per ticked item — so a completed
-- checklist becomes an auditable record rather than a scanned page.
--
-- Every table is tenant-scoped with tenant_id as the leading indexed column,
-- matching the multi-tenant convention in 20261004_01_multi_tenant_franchise.

-- ---------------------------------------------------------------- templates

-- A template is the machine-readable checklist. `version` is bumped on every
-- item edit, and each run pins the version it started against so a completed
-- run keeps showing the content the staff member actually saw.
CREATE TABLE IF NOT EXISTS sop_templates (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    -- Which paper SOP this was transcribed from: SOP00 | SOP01 | SOP06 | SOP09.
    source TEXT NOT NULL DEFAULT 'SOP01',
    -- a (6-14h) | b (14-22h) | c (flexible) | monthly (day-15 / day-30 duties).
    shift_type TEXT NOT NULL DEFAULT 'any',
    -- CSV of roles allowed to execute this template; checked in application code
    -- because SQLite has no array type and the role set is small and stable.
    applicable_roles TEXT NOT NULL DEFAULT 'owner,manager,staff',
    version INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sop_templates_tenant_code ON sop_templates(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_sop_templates_shift ON sop_templates(tenant_id, shift_type, is_active);

-- ------------------------------------------------------------ template items

-- One step inside a template. `is_critical` blocks completion while unchecked,
-- distinguishing a mandatory step from an optional one; `requires_note` and
-- `requires_value` force an evidence field (a measurement or an explanation)
-- so a tick cannot stand in for a proof that was never taken.
CREATE TABLE IF NOT EXISTS sop_template_items (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    template_id TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    is_critical INTEGER NOT NULL DEFAULT 0,
    requires_note INTEGER NOT NULL DEFAULT 0,
    requires_value INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sop_template_items_order ON sop_template_items(tenant_id, template_id, order_index);

-- ---------------------------------------------------------------------- runs

-- One execution of a template by one staff member inside one shift. A terminal
-- run (completed or abandoned) is immutable: the row is compliance evidence and
-- must not be editable after submission. `staff_id` and `template_version` are
-- the two invariants that keep the record attributable and historically stable.
CREATE TABLE IF NOT EXISTS sop_runs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    template_id TEXT NOT NULL,
    template_version INTEGER NOT NULL,
    -- Nullable: a checklist that is not tied to a clocked-in shift (day-15 deep
    -- clean, for instance) still has to be recordable.
    shift_id TEXT,
    staff_id TEXT NOT NULL,
    staff_name TEXT,
    shift_type TEXT NOT NULL DEFAULT 'any',
    -- in_progress | completed | abandoned. Terminal states are read-only.
    status TEXT NOT NULL DEFAULT 'in_progress',
    -- Calendar day the run belongs to, so the day-15 and day-30 duties report
    -- on the right date regardless of the hour the work actually happened.
    scheduled_date TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    abandoned_reason TEXT,
    -- Stamp of the last push reminder, so the day's reminder is not repeated.
    reminder_sent_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sop_runs_tenant_day ON sop_runs(tenant_id, scheduled_date, status);
CREATE INDEX IF NOT EXISTS idx_sop_runs_staff ON sop_runs(tenant_id, staff_id, started_at);
CREATE INDEX IF NOT EXISTS idx_sop_runs_shift ON sop_runs(tenant_id, shift_id);
CREATE INDEX IF NOT EXISTS idx_sop_runs_template ON sop_runs(tenant_id, template_id);

-- ---------------------------------------------------------------- run items

-- The ticked state of one template item inside one run. `checked_by` is written
-- from the authenticated session server-side and must never be accepted from a
-- request body, otherwise a tick cannot be attributed to a real person.
CREATE TABLE IF NOT EXISTS sop_run_items (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    run_id TEXT NOT NULL,
    template_item_id TEXT NOT NULL,
    is_checked INTEGER NOT NULL DEFAULT 0,
    checked_at TEXT,
    checked_by TEXT,
    note TEXT,
    value REAL,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sop_run_items_run ON sop_run_items(tenant_id, run_id, is_checked);
CREATE INDEX IF NOT EXISTS idx_sop_run_items_tmpl ON sop_run_items(tenant_id, template_item_id);

-- ---------------------------------------------------------------- violations

-- A breach of the conduct code (SOP 09). Rows are never deleted — a closed
-- violation stays as history, which is what makes the monthly escalation ladder
-- countable. `is_serious` marks the breaches that jump the ladder straight to
-- termination (fraud, sabotage, disclosure). `audit_log_id` ties the record to
-- the shared audit trail rather than keeping a private log.
CREATE TABLE IF NOT EXISTS sop_violations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    staff_id TEXT NOT NULL,
    staff_name TEXT,
    -- time | conduct | assets_finance | secrets | stimulants | workspace.
    category TEXT NOT NULL,
    is_serious INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    occurred_at TEXT,
    recorded_by TEXT NOT NULL,
    -- recorded -> confirmed -> applied, with appealed as a branch from applied,
    -- and closed as the terminal state. Mirrors SOP 09 §4 accountability.
    status TEXT NOT NULL DEFAULT 'recorded',
    -- written_warning | fine | termination.
    discipline_step TEXT,
    confirmed_by TEXT,
    confirmed_at TEXT,
    applied_by TEXT,
    applied_at TEXT,
    -- The employee's own account, per the right of reply in SOP 09 §5.
    appeal_explanation TEXT,
    audit_log_id TEXT,
    closed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sop_violations_tenant_staff ON sop_violations(tenant_id, staff_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_sop_violations_status ON sop_violations(tenant_id, status);
-- Matches the monthly escalation count: prior confirmed offences in the month.
CREATE INDEX IF NOT EXISTS idx_sop_violations_month ON sop_violations(tenant_id, strftime('%Y-%m', occurred_at), staff_id);

-- ---------------------------------------------------------------------- seed
-- Content transcribed from docs/sop/01 (opening and closing), docs/sop/06
-- (clock in/out and shift handover) and docs/sop/00 (day-15 and day-30 duties).
-- Onboarding D1 is deliberately not seeded here: it is a per-employee record
-- run once, not a per-shift checklist.

INSERT OR IGNORE INTO sop_templates (id, tenant_id, code, title, description, source, shift_type, applicable_roles, version)
VALUES
    ('tpl_open_shift_a', 'default', 'open-shift-a', 'Mở cửa đầu ca', 'A1–A6 SOP 01, 38 phút', 'SOP01', 'a', 'owner,manager,staff,barista,chef,kitchen,cashier,waiter', 1),
    ('tpl_close_shift', 'default', 'close-shift', 'Đóng cửa / bàn giao cuối ca', 'B1–B7 SOP 01, 53 phút', 'SOP01', 'any', 'owner,manager,staff,barista,chef,kitchen,cashier,waiter', 1),
    ('tpl_shift_handover', 'default', 'shift-handover', 'Bàn giao ca', 'Clock in/out + bàn giao bàn đang phục vụ', 'SOP06', 'any', 'owner,manager,staff,barista,chef,kitchen,cashier,waiter', 1),
    ('tpl_deep_clean_m15', 'default', 'deep-clean-m15', 'Tổng vệ sinh định kỳ', 'Ngày 15 hàng tháng — toàn bộ nhân sự', 'SOP00', 'monthly', 'owner,manager,staff,barista,chef,kitchen,cashier,waiter', 1),
    ('tpl_inventory_audit_m30', 'default', 'inventory-audit-m30', 'Kiểm kê định kỳ', 'Ngày 30 hàng tháng — Trưởng ca phối hợp nhân viên', 'SOP00', 'monthly', 'owner,manager,staff,barista,chef,kitchen,cashier,waiter', 1);

-- Opening checklist (A1–A6). System check is critical: a shift that opens with
-- no KDS link or no bill printer cannot take orders at all.
INSERT OR IGNORE INTO sop_template_items (id, tenant_id, template_id, label, description, order_index, is_critical, requires_note, requires_value) VALUES
    ('ti_open_system', 'default', 'tpl_open_shift_a', 'A1. Kiểm tra hệ thống', 'Bật máy tính quản lý / tablet KDS; đăng nhập admin; kiểm tra dashboard, Internet, WiFi, máy in bill', 1, 1, 0, 0),
    ('ti_open_ingredients', 'default', 'tpl_open_shift_a', 'A2. Chuẩn bị nguyên liệu đầu ca', 'Đun nước nóng, pha trà, chuẩn bị đá viên theo dự báo doanh số; dọn công cụ phục vụ', 2, 0, 0, 0),
    ('ti_open_clean', 'default', 'tpl_open_shift_a', 'A3. Vệ sinh khu vực', 'Bàn ghế, lối đi, chỗ đậu xe; Restroom đầy đủ giấy/nước rửa tay, khô ráo; bật nhạch/TV theo khung giờ; tưới cây', 3, 0, 0, 0),
    ('ti_open_tables', 'default', 'tpl_open_shift_a', 'A4. Kiểm tra bàn & QR', 'Duyệt Indoor/Outdoor/Rooftop; QR sắc nét không bị che; in lại QR bị mờ; đặt lại bàn Occupied → Available', 4, 0, 0, 0),
    ('ti_open_kds', 'default', 'tpl_open_shift_a', 'A5. Kiểm tra KDS', 'Mở KDS, xác nhận kết nối máy chủ, kiểm tra âm thanh báo đơn, xóa đơn cũ bị kẹt', 5, 1, 0, 0),
    ('ti_open_menu', 'default', 'tpl_open_shift_a', 'A6. Kiểm tra thực đơn & khuyến mãi', 'Món đang Available; món hết nguyên liệu → Unavailable; mã giảm giá còn hiệu lực; xem đặt chỗ hôm nay', 6, 0, 0, 0);

-- Closing checklist (B1–B7). The COD cash reconciliation is the only step that
-- demands a number, because a variance above 50k must be escalated to the owner
-- the same day and the amount is the evidence that triggers the escalation.
INSERT OR IGNORE INTO sop_template_items (id, tenant_id, template_id, label, description, order_index, is_critical, requires_note, requires_value) VALUES
    ('ti_close_orders', 'default', 'tpl_close_shift', 'B1. Kiểm tra đơn hàng cuối ngày', 'Lọc đơn theo ngày, xử lý hết đơn còn Pending/Preparing, xác nhận mọi đơn đã thanh toán', 1, 1, 0, 0),
    ('ti_close_revenue', 'default', 'tpl_close_shift', 'B2. Kiểm tra doanh thu', 'Tổng doanh thu ngày; tách theo PayOS và COD; xuất CSV nếu cần', 2, 0, 0, 0),
    ('ti_close_cod', 'default', 'tpl_close_shift', 'B3. Đối chiếu tiền mặt COD', 'Đếm tiền mặt COD, đối chiếu tổng đơn COD trên hệ thống; nhập số tiền; lệch > 50k → báo Owner ngay', 3, 1, 0, 1),
    ('ti_close_stock', 'default', 'tpl_close_shift', 'B4. Kiểm tra kho', 'Nguyên liệu còn lại; món hết → Unavailable; ghi nhận cần mua thêm', 4, 0, 1, 0),
    ('ti_close_handover', 'default', 'tpl_close_shift', 'B5. Bàn giao ca & vệ sinh', 'Bàn giao bàn khách đang dùng chưa thanh toán; vệ sinh toilet, khu vực quán, phân loại rác; ca tối dọn sau 21:30', 5, 0, 1, 0),
    ('ti_close_loyalty', 'default', 'tpl_close_shift', 'B6. Kiểm tra loyalty & hệ thống', 'Tổng điểm/cashback hôm nay; khách lên tier → chúc mừng; KDS xóa đơn cũ; TV Menu tắt/để chế độ đêm; Service Worker', 6, 0, 0, 0),
    ('ti_close_report', 'default', 'tpl_close_shift', 'B7. Báo cáo cuối ngày', 'Gửi Owner qua Telegram/Zalo: doanh thu, số đơn, phương thức thanh toán, khách mới/quen, vấn đề cần lưu ý; lưu nhật ký đóng cửa', 7, 1, 0, 0);

-- Shift handover: the clock-in/out flow plus the standing note about tables
-- still in use, so the next shift does not clear a table that is still served.
INSERT OR IGNORE INTO sop_template_items (id, tenant_id, template_id, label, description, order_index, is_critical, requires_note, requires_value) VALUES
    ('ti_handover_orders', 'default', 'tpl_shift_handover', 'Xác nhận đơn hàng đã xử lý xong', 'Không để lại đơn còn trạng thái Pending/Preparing khi kết thúc ca', 1, 1, 0, 0),
    ('ti_handover_tables', 'default', 'tpl_shift_handover', 'Bàn giao bàn đang phục vụ', 'Ghi rõ bàn nào khách đang dùng, chưa thanh toán; ghi chú ca sau cần lưu ý', 2, 1, 1, 0),
    ('ti_handover_clock', 'default', 'tpl_shift_handover', 'Bấm Clock Out', 'Hệ thống ghi clock_out tự động; quên clock out phải báo Manager sửa tay và ghi lý do', 3, 1, 0, 0),
    ('ti_handover_area', 'default', 'tpl_shift_handover', 'Trả bàn, dọn dẹp khu vực', 'Sắp xếp lại bàn ghế khu vực phục vụ, dọn rác tại chỗ', 4, 0, 0, 0),
    ('ti_handover_incident', 'default', 'tpl_shift_handover', 'Ghi nhận sự cố ca làm', 'Thiết bị lỗi, khách khiếu nại, nguyên liệu thiếu — ghi lại để ca sau xử lý', 5, 0, 1, 0);

-- Day-15 deep clean (SOP 00 §5). A short checklist by design: the whole store
-- is being cleaned, not audited step by step.
INSERT OR IGNORE INTO sop_template_items (id, tenant_id, template_id, label, description, order_index, is_critical, requires_note, requires_value) VALUES
    ('ti_deep_webs', 'default', 'tpl_deep_clean_m15', 'Quét mạng nhện, lau hệ thống kính', 'Toàn bộ sàn, khu vực quán', 1, 1, 0, 0),
    ('ti_deep_stairs', 'default', 'tpl_deep_clean_m15', 'Bảo dưỡng cầu thang máy & khu vực quan', 'Theo hướng dẫn kỹ thuật; ghi chú nếu phát hiện hư hỏng', 2, 1, 1, 0),
    ('ti_deep_equipment', 'default', 'tpl_deep_clean_m15', 'Vệ sinh thiết bị quầy bar', 'Máy pha cà phê, máy xay, máy ép', 3, 0, 0, 0);

-- Day-30 stocktake (SOP 00 §5). Every count demands a number because the point
-- of the exercise is the variance between counted and system quantity.
INSERT OR IGNORE INTO sop_template_items (id, tenant_id, template_id, label, description, order_index, is_critical, requires_note, requires_value) VALUES
    ('ti_audit_furniture', 'default', 'tpl_inventory_audit_m30', 'Kiểm đếm bàn ghế, CCDC', 'Số lượng thực tế; ghi chênh lệch', 1, 1, 1, 1),
    ('ti_audit_bar', 'default', 'tpl_inventory_audit_m30', 'Kiểm đếm thiết bị quầy bar', 'Tình trạng + số lượng', 2, 1, 1, 1),
    ('ti_audit_stock', 'default', 'tpl_inventory_audit_m30', 'Kiểm kê hàng tồn kho', 'Nguyên liệu, hàng hoá', 3, 1, 1, 1),
    ('ti_audit_report', 'default', 'tpl_inventory_audit_m30', 'Ghi phiếu kiểm kê & báo Quản lý', 'Chênh lệch phải được báo Quản lý trong ngày', 4, 1, 1, 0);
