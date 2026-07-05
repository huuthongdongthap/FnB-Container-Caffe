---
name: 260705-2219-aura-cafe-25-step-complete-ideation
title: AURA CAFE — 25-Step Ideation Pipeline (Complete)
status: completed
date: 2026-07-05
stage: Zero→PSF
verdict: GO (26/30)
project: /Users/macbook/FnB-Container-Caffe
thoughts: |
  Scope was large (existing production SaaS + physical F&B launch).
  Split into: ideation plan (this) + implementation plan (/ck:plan --deep --parallel).
---

# AURA CAFE — 25 Bước Ideation Pipeline

## Verdict: GO / 26 điểm

## Bước đã qua

| # | Bước | Status |
|---|------|--------|
| 1–3 | GO/NO-GO → BMC → PRD | done |
| 4–25 | Agentic Architecture → Gap Report | done |

## Trạng thái tổng thể

**Digital:** LIVE (1,163 tests, 318 TS files, 27 routes, 26 D1 tables)
**Physical:** BLOCKER — container build + regulatory not started
**Team:** 0/10 hired
**Revenue:** 0 (chưa mở cửa)

## Phases cần implement (xem plan chi tiết: `/ck:plan --deep --parallel`)

### Phase 1: Physical Buildout (T-8 to W-0, 8 weeks, ~750M VND)
Container fabrication → Interior → Equipment → Staffing

### Phase 2: Regulatory + Pre-Launch (T-6 to W-0, 6 weeks)
GPKD + PCCC + VSATTP + Tax + Labor contracts

### Phase 3: Digital Gap Closure (Month 1-3)
28 Stitch screens → React, MoMo payment, domain link, real-time inventory

### Phase 4: Marketing Launch (T-3 to Month 3)
Presale loyalty, Grand Opening campaign, TikTok/IG/FB/Zalo content calendar

### Phase 5: Steady-State Operations (Month 3+)
Hiring complete, ERPNext full sync, events programming, OKR tracking

## Files trong plan này

| File | Nội dung |
|------|----------|
| `plan.md` | Tổng quan (file này) |
| `go-nogo-report.md` | Điểm + verdict chi tiết |
| `bmc.md` | Business Model Canvas |
| `prd.md` | Product Requirements Document |
| `reports/final-gap-report.md` | 12 gaps + critical path |
| `reports/unit-economics.md` | Chi tiết tài chính 3 năm |
| `reports/risk-assessment.md` | 7 rủi ro + mitigation |
| `reports/industry-analysis.md` | Phân tích thị trường VN F&B |
| `reports/marketing-strategy.md` | Chiến lược content + channels |
| `reports/personas.md` | 3 personas chi tiết |
| `reports/talent-plan.md` | Nhân sự + hiring plan |
| `reports/ops-governance.md` | OKR + governance + ESG + crisis |

## Next

```
/ck:plan --deep --parallel
```

## Câu hỏi còn mở

1. Vendor container ở Đồng Tháp — ai build? (frame/turnkey?)
2. Staff housing có gần 39 Nguyễn Tất Thành không?
3. Zalo OA — approval timeline trước launch được không?
4. Token migration: manual vs bulk replace (916 --st-* → --aura-*)?
5. aura-deploy CLI: npm publish hay local script?
