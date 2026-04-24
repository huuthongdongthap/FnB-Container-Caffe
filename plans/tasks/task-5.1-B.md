PHẦN B: VIẾT BACKEND PROPOSAL

Dựa trên kết quả phân tích từ task-5.1-A, tạo file `docs/backend-proposals.md`.

## Bước 1: Đọc kết quả từ task-5.1-A

File input: /Users/mac/mekong-cli/FnB-Container-Caffe/plans/results/task-5.1-A-result.md
Nếu file không tồn tại, đọc kết quả trả về từ task-5.1-A trực tiếp.

## Bước 2: Tạo file docs/backend-proposals.md

Create file với cấu trúc sau:

```markdown
# Backend Proposal — FnB Container Caffe

> Generated from codebase audit. P2 items are proposals only, not implemented.

## 1. Existing Features ✅

### 1.1 Authentication & User Management
- [Feature] + [Endpoint] + [Status]

### 1.2 Menu & Products
- [Feature] + [Endpoint] + [Status]

### 1.3 Ordering & Payments
- [Feature] + [Endpoint] + [Status]

### 1.4 Loyalty System
- [Feature] + [Endpoint] + [Status]

### 1.5 Analytics & Operations
- [Feature] + [Endpoint] + [Status]

### 1.6 WebSocket / Real-time
- [Channels] + [Events]

### 1.7 Database Schema Overview
| Table | Key Columns | Relationships |
|-------|-------------|---------------|

## 2. Gaps & Missing 🔴

### 2.1 Frontend has UI, Backend missing
- List features with frontend UI but no backend support (🔴)

### 2.2 Incomplete APIs
- Endpoints that exist but are incomplete/wrong

## 3. New Proposals 🆕

### P0 (Critical)
- [Feature] + [Why] + [Proposed Endpoint]

### P1 (Important)
- [Feature] + [Why] + [Proposed Endpoint]

### P2 (Proposals Only - Not Implemented)
- Analytics Aggregation
- Inventory Tracking
- QR Code Ordering
- Export/Report
- [Each with proposed API endpoints]

## 4. Roadmap & Priority Matrix

| Phase | Feature | Priority | Effort | Status |
|-------|---------|----------|--------|--------|
| Phase 1 | ... | P0 | ... | 🔴 Missing |
| Phase 2 | ... | P1 | ... | 🆕 Proposal |
| Phase 3 | ... | P2 | ... | 🆕 Proposal |

## 5. Implementation Dependencies
- Dependencies between features
- Recommended implementation order
```

## Bước 3: Validate file

- Verify file được tạo tại đúng path: `FnB-Container-Caffe/docs/backend-proposals.md`
- Verify markdown formatting đúng
- Verify tất cả sections có nội dung đầy đủ
