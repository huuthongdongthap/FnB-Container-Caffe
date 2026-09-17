# Phase 02: Customer Domain & Tree Consolidation

## Context Links
- Master Plan: [plan.md](plan.md)
- Domain Contracts: `.ai/specs/domain-contracts.md`
- Target State: `docs/architecture/TARGET_STATE.md` §4

## Overview
- **Priority**: High (P1)
- **Current Status**: Pending Review
- **Description**: Sửa lỗi rò rỉ kiến trúc (dependency inversion) khi domain package `@aura/domain-order` import ngược từ `worker/src/tree/customer`. Xoá bỏ 5 file logic trùng lặp hoàn toàn trong `worker/src/tree/customer/` và giữ lại shim re-export chuẩn tới `@aura/domain-customer`.

## Key Insights
1. **Rò rỉ kiến trúc nghiêm trọng**:
   - `packages/domain/order/commands/create-order.ts`:
     ```typescript
     const { identifyCustomer, linkOrder } = await import('worker/src/tree/customer');
     ```
   - `packages/domain/order/commands/update-order.ts`:
     ```typescript
     const { recordVisit } = await import('worker/src/tree/customer');
     ```
   - Luật DDD: Domain package phải độc lập với worker framework hoặc chỉ import từ sibling domain package (`@aura/domain-*`). Việc import `worker/src/tree/*` làm đảo ngược chiều phụ thuộc.
2. **Trùng lặp mã nguồn (Code Duplication)**:
   - Thư mục `worker/src/tree/customer/` đã có `index.ts` làm shim re-export từ `@aura/domain-customer`.
   - Tuy nhiên, 5 file implementation cũ vẫn còn nằm song song:
     - `helpers.ts`
     - `identify-customer.ts`
     - `link-order.ts`
     - `record-consent.ts`
     - `record-visit.ts`
   - Test suite `worker/src/__tests__/tree/customer/customer-domain.test.ts` vẫn trỏ vào các file cũ thay vì package chính thức `@aura/domain-customer`.

## Requirements
### Functional
- Sửa dynamic imports trong `@aura/domain-order` thành `@aura/domain-customer`.
- Chuyển toàn bộ imports trong `worker/src/__tests__/tree/customer/customer-domain.test.ts` sang `@aura/domain-customer`.
- Xoá 5 file trùng lặp trong `worker/src/tree/customer/`, chỉ giữ lại `index.ts` (re-export shim) phục vụ tương thích ngược cho các route worker còn sót lại.

### Non-Functional
- 100% tests liên quan đến Customer và Order tiếp tục pass.
- Không có lỗi module resolution hay circular dependency.

## Architecture
```
[Domain: @aura/domain-order] ──(imports)──▶ [Domain: @aura/domain-customer] (Pure TS)
                                                        ▲
[worker/src/tree/customer/index.ts (Shim)] ──────────────┘
```

## Related Code Files
### Files to Modify
- `packages/domain/order/commands/create-order.ts` (import từ `@aura/domain-customer`)
- `packages/domain/order/commands/update-order.ts` (import từ `@aura/domain-customer`)
- `worker/src/__tests__/tree/customer/customer-domain.test.ts` (import từ `@aura/domain-customer`)

### Files to Delete
- `worker/src/tree/customer/helpers.ts`
- `worker/src/tree/customer/identify-customer.ts`
- `worker/src/tree/customer/link-order.ts`
- `worker/src/tree/customer/record-consent.ts`
- `worker/src/tree/customer/record-visit.ts`

## Implementation Steps
1. Mở `packages/domain/order/commands/create-order.ts`, đổi:
   ```typescript
   const { identifyCustomer, linkOrder } = await import('@aura/domain-customer');
   ```
2. Mở `packages/domain/order/commands/update-order.ts`, đổi:
   ```typescript
   const { recordVisit } = await import('@aura/domain-customer');
   ```
3. Mở `worker/src/__tests__/tree/customer/customer-domain.test.ts`, cập nhật import sang `@aura/domain-customer`.
4. Chạy `npx vitest run worker/src/__tests__/tree/customer/customer-domain.test.ts` xác nhận test xanh.
5. Xoá an toàn 5 file implementation trùng lặp tại `worker/src/tree/customer/`.
6. Chạy toàn bộ test suite `npx vitest run --reporter=dot` và `npx tsc --noEmit` để chứng minh không còn file nào phụ thuộc vào 5 file vừa xoá.

## Todo List
- [ ] Chuyển dynamic import trong `packages/domain/order/commands/create-order.ts` sang `@aura/domain-customer`
- [ ] Chuyển dynamic import trong `packages/domain/order/commands/update-order.ts` sang `@aura/domain-customer`
- [ ] Chuyển test imports trong `worker/src/__tests__/tree/customer/customer-domain.test.ts` sang `@aura/domain-customer`
- [ ] Xoá 5 file thừa tại `worker/src/tree/customer/`
- [ ] Chạy Vitest & TSC xác thực

## Success Criteria
- Thư mục `worker/src/tree/customer/` chỉ còn duy nhất `index.ts` đóng vai trò re-export shim.
- Domain Order không còn bất kỳ import nào trỏ vào `worker/`.
- 100% test liên quan đến order và customer đều pass.

## Risk Assessment
- **Nguy cơ**: Một số route trong worker vẫn import deep file (e.g. `import from '.../tree/customer/record-consent'`).
- **Giảm thiểu**: Grep toàn codebase xác nhận mọi import đều qua `tree/customer` (index shim) hoặc trực tiếp `@aura/domain-customer`.

## Next Steps
- Chuyển sang [Phase 03: Schema & Contract Consolidation](phase-03-schema-and-contract-consolidation.md).
