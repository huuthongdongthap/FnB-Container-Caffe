# Phase 03: Schema & Contract Single Source of Truth

## Context Links
- Master Plan: [plan.md](plan.md)
- Domain Contracts: `.ai/specs/domain-contracts.md`
- Authority Table: `docs/architecture/BLUEPRINT.md` §4

## Overview
- **Priority**: Medium (P2)
- **Current Status**: Pending Review
- **Description**: Phân định rõ ràng ranh giới giữa Transport Schemas (OpenAPI HTTP contracts trong `worker/src/schemas/`) và Domain Validation Schemas (Pure Zod trong `packages/domain/*/schemas`), ngăn chặn rule drift và đảm bảo Single Source of Truth.

## Key Insights
1. **Ranh giới hai tầng Schema**:
   - `worker/src/schemas/*`: Phục vụ tầng Transport API, gắn liền với `@hono/zod-openapi` (`.openapi({...})`, `PaginationQuerySchema`, `SuccessResponseSchema`). Tầng này định hình Swagger/OpenAPI docs cho frontend và external clients.
   - `packages/domain/*/schemas`: Phục vụ tầng Domain Core (Pure Zod, không phụ thuộc framework), định hình các invariants và validation logic (ví dụ `inventoryItemSchema`, `productSchema`).
2. **Nguy cơ Rule Drift**:
   - Hiện tại, một số schema validation (như enum types, phone normalization, order status transitions) có thể bị định nghĩa trùng lặp giữa `worker/src/schemas/common.ts` và các enum/types trong domain packages.
   - Cần đảm bảo các domain package là Single Source of Truth cho các enums và entity validations; `worker/src/schemas/` import lại hoặc mở rộng bằng `.openapi()`.

## Requirements
### Functional
- Rà soát các enum trùng lặp (`OrderStatus`, `PaymentStatus`, `InventoryCategory`, v.v.) giữa `worker/src/schemas/common.ts` và các `packages/domain/*/model/*-types.ts`.
- Đảm bảo `worker/src/schemas/` kế thừa các enum cốt lõi từ `packages/domain/*` thay vì tự hardcode lại độc lập.
- Không để xảy ra circular dependencies giữa worker và domain.

### Non-Functional
- Giữ nguyên Swagger/OpenAPI spec của worker (`/doc`, `/ui`).
- Không làm ảnh hưởng tới các route validation hiện tại.

## Architecture
```
[packages/domain/<domain>/model/*-types.ts]  (Source of Truth for Enums & Invariants)
                  │
                  ▼ (re-exported / referenced)
[worker/src/schemas/<domain>.ts]             (OpenAPI transport annotations)
                  │
                  ▼
[worker/src/routes/*.ts]                    (Hono thin route handlers)
```

## Related Code Files
### Files to Review & Refactor
- `worker/src/schemas/common.ts`
- `worker/src/schemas/orders.ts`
- `worker/src/schemas/inventory.ts`
- `worker/src/schemas/loyalty.ts`
- `packages/domain/order/model/order-state-machine.ts`
- `packages/domain/inventory/src/model/inventory-schemas.ts`

## Implementation Steps
1. Khảo sát danh sách enums cốt lõi trong `worker/src/schemas/common.ts` (ví dụ `OrderStatusEnum`, `PaymentStatusEnum`).
2. Đối chiếu với các state machine và type definitions trong `@aura/domain-order` và `@aura/domain-payment`.
3. Căn chỉnh để các transport schema sử dụng giá trị enum từ domain canonical types.
4. Chạy `npx vitest run worker/src/__tests__/routes/` để đảm bảo toàn bộ route validation không bị gián đoạn.
5. Chạy `npx tsc --noEmit` xác nhận type contract khớp 100%.

## Todo List
- [ ] Audit enums giữa `worker/src/schemas/common.ts` và domain packages
- [ ] Đảm bảo domain enums là Source of Truth
- [ ] Xác nhận không có circular dependency giữa `worker/src/schemas` và `packages/domain`
- [ ] Chạy test suite route validation
- [ ] Kiểm tra Swagger/OpenAPI docs generation

## Success Criteria
- Mọi trạng thái đơn hàng (order status), thanh toán (payment status) chỉ được định nghĩa một lần duy nhất tại domain package.
- 0 lỗi TypeScript build khi compile.

## Risk Assessment
- **Nguy cơ**: Thay đổi schema trong `worker/src/schemas/` có thể làm lệch OpenAPI route generation của Hono.
- **Giảm thiểu**: Giữ nguyên tên export và cấu trúc Zod object của `worker/src/schemas/*`, chỉ đồng bộ hoá nguồn gốc giá trị enum.

## Next Steps
- Chuyển sang [Phase 04: UI Primitives & MD3 Token Consolidation](phase-04-frontend-ui-primitives-consolidation.md).
