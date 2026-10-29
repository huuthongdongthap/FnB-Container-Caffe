# Allocate resources — Đề xuất nguồn lực audit

**Goal:** deep check luồng đăng nhập Admin, KDS, Staff/mobile và customer.
**Phụ thuộc:** [select audits](./select-audits.md). Đây là capacity scenario, **không booking nhân sự, tạo agent mới, mua credit hoặc cam kết thời gian sửa lỗi**.

| Vai trò đề xuất | Hạng mục | Phút-người |
|---|---|---|
| Backend/auth/privacy/realtime | AUTH-01, AUTH-02, AUTH-04, AUTH-07, AUTH-08 | 225 |
| Frontend/auth/integration | AUTH-03, AUTH-06, AUTH-09 | 150 |
| Data/release | AUTH-05 | 45 |
| Reviewer độc lập nếu có | Đối chiếu findings, proof kind, test acceptance, route ownership | 30 |
| Người tổng hợp | Báo cáo, blocker handoff và next gate | 30 |
| **Tổng giả định** | | **480 phút = 8 giờ-người** |

Một người có thể giữ nhiều vai trò; chưa biết nhân sự thật. Nếu reviewer không độc lập phải ghi hạn chế, không ghi “đã review độc lập”. Hai người đủ chuyên môn có thể chia browser và API sau baseline; lịch thực tế còn tùy quyền truy cập, fixture và runtime.

## Phụ thuộc và ownership

- Audit lead giữ goal/baseline/risk register; không để hai người chỉnh cùng fixture hoặc chuyển nguồn auth khi chưa chốt contract.
- Backend chịu customer proof, private API, D1 authority và transport; frontend chịu kết quả login/hydration/cache/browser. Data/release kiểm schema directory/password/device, không tự áp migration remote.
- Nhánh client AUTH-03 có thể kiểm bằng fixture API reject độc lập; kết luận browser end-to-end cần hội tụ API + identity đúng.
- Team capacity ít hơn scenario: làm AUTH-01/02/03 trước, giữ regression Staff, ghi phần còn lại NOT_RUN. Không giảm acceptance để vừa thời gian.

## Công cụ và tài nguyên

Reuse Vitest 4.1.9, app router, bootstrap SQLite fixture, shared client-session/private-store, local Worker/browser harness. Probe chỉ thay provider/API boundary khi cần tạo lỗi; không giả business response để chứng minh integration PASS. Chặn outbound và không dùng tài khoản/dữ liệu khách thật.

Recipe gốc ghi estimated 3 credits/10 phút; đó là metadata của recipe, không là số credit đã sử dụng hoặc thời lượng audit đã đo. Native Mekong cook trả exit 1, vì vậy lần này dùng stage adapters local với DAGScheduler hiện có; [trace](./dag-run.json) ghi rõ native subcommands không được thực thi thành công.

## Deliverables và handoff

1. [Risk rank](./risk-rank.md), [selection](./select-audits.md), bảng allocation này và JSON tương ứng.
2. [Regression JSON](./evidence/regression-results.json), backend/UI probe source và observations; giữ test FAIL làm repro cho remediation.
3. Handoff sang phase 02/03/05/06 của kế hoạch chung; không đặt lại phase 01 source đã DONE thành TODO hoặc gọi nó là runtime proof.
4. Staging schema, real-browser/device và production config/access là external gates, cần chỉ định người có quyền khi lên lịch. Không đoán account/password hoặc đọc secrets để tự vượt gate.

Đầu ra máy đọc: [resource-allocation.json](./resource-allocation.json). Mốc thời gian, staffing và budget thật chưa được xác nhận; không có hợp đồng/chi phí được phát sinh bởi bản allocation này.
