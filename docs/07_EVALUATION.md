---
date: 2025-06-19
version: 1.0
status: stable
---

# EVALUATION FRAMEWORK — AURA CAFE CONTAINER

## Overview

This document defines Key Performance Indicators (KPIs), evaluation methods, and review cadence for the F&B Container Caffe system.

## Key Performance Indicators

### Technical KPIs

| KPI | Target | Current | Measurement | Frequency |
|-----|--------|---------|-------------|-----------|
| **API Response Time (p95)** | <200ms | ~100ms | Cloudflare Workers Analytics | Continuous |
| **API Response Time (p99)** | <500ms | ~200ms | Cloudflare Workers Analytics | Continuous |
| **System Uptime** | 99.9% | 100% (since launch) | Cloudflare Pages Uptime Monitor | Continuous |
| **Error Rate** | <0.1% | ~0.05% | Cloudflare Workers Error Rate | Continuous |
| **Test Coverage** | ≥80% | 95% | Jest coverage reports | On every build |
| **Lighthouse Score** | ≥90 | 92 | Lighthouse CI | On every PR |
| **LCP (Largest Contentful Paint)** | <2.5s | ~1.8s | Web Vitals | Continuous |
| **FCP (First Contentful Paint)** | <1.8s | ~1.2s | Web Vitals | Continuous |
| **CLS (Cumulative Layout Shift)** | <0.1 | ~0.05 | Web Vitals | Continuous |

### Business KPIs

| KPI | Target | Current | Measurement | Frequency |
|-----|--------|---------|-------------|-----------|
| **Daily Active Users (DAU)** | >50 | 80 | Google Analytics / self-hosted | Daily |
| **Order Conversion Rate** | >15% | 18% | Orders / Sessions | Daily |
| **Average Order Value (AOV)** | >100K VND | 125K VND | Revenue / Orders | Daily |
| **Customer Retention (30d)** | >30% | 35% | Repeat customers | Weekly |
| **Loyalty Enrollment Rate** | >40% | 45% | Signups / New customers | Daily |
| **Payment Success Rate** | >98% | 99.2% | Successful PayOS callbacks | Daily |
| **KDS Processing Time (avg)** | <10min | 8min | Time pending → ready | Real-time |

### Operational KPIs

| KPI | Target | Current | Measurement | Frequency |
|-----|--------|---------|-------------|-----------|
| **Deployment Frequency** | >1/week | 2-3/week | GitHub Actions logs | Weekly |
| **Lead Time (commit → prod)** | <2h | ~1h | GitHub timestamps | Weekly |
| **Mean Time to Recovery (MTTR)** | <30min | ~15min | Incident logs | Per incident |
| **Test Pass Rate** | 100% | 100% | Jest/Playwright results | On every build |
| **Production Incidents** | <1/month | 0 (last 3 months) | Incident reports | Monthly |

---

## Evaluation Framework

### Monitoring Stack

**Cloudflare Dashboard:**
- Workers metrics (requests, errors, CPU time)
- Pages metrics (bandwidth, build status)
- D1 database metrics (storage, query count)

**Web Vitals:**
- Client-side reporting via `web-vitals` library
- Aggregated in admin dashboard

**Error Tracking:**
- Cloudflare logs (console.error)
- Consider Sentry integration if error rate increases

**Business Analytics:**
- Built-in admin dashboard (`admin/dashboard.html`)
- Export to CSV for deeper analysis
- Monthly financial review

---

## Review Cadence

### Daily (Operations Team)
- Check uptime monitor
- Review error rate (if >0.5%)
- Monitor order volume vs targets

### Weekly (Management)
- Business KPI dashboard review
- Customer feedback trends
- Incident post-mortems (if any)

### Monthly (CTO + Founder)
- Full technical and business review
- Cost analysis (Cloudflare usage, payment fees)
- Roadmap adjustment based on metrics
- Security review

### Quarterly (Board / Stakeholders)
- Strategic review
- ROI calculation
- Planning for next quarter

---

## Success Thresholds

Each KPI has defined thresholds:

| Status | Green | Yellow | Red |
|--------|-------|--------|-----|
| **Uptime** | ≥99.9% | 99.5-99.8% | <99.5% |
| **Error Rate** | <0.1% | 0.1-0.5% | >0.5% |
| **Response Time (p95)** | <200ms | 200-500ms | >500ms |
| **Test Coverage** | ≥80% | 70-79% | <70% |
| **Order Conversion** | ≥15% | 10-14% | <10% |

**Red threshold** triggers immediate investigation and mitigation.

---

## Evaluation Tools

### Automated Alerts

Configure Cloudflare notifications for:
- Worker error rate > 0.5%
- Pages build failure
- D1 storage > 80% capacity
- KV operations near limit

### Dashboard Access

- **Admin Dashboard:** `admin/dashboard.html` (authenticated)
- **Cloudflare Dashboard:** Shared with owner/dev
- **PayOS Dashboard:** For payment reconciliation

---

## Improvement Loop

1. **Measure**: Collect KPI data continuously
2. **Analyze**: Identify trends, anomalies, opportunities
3. **Plan**: Create tasks in `05_TASKS/` for improvements
4. **Implement**: Deploy fixes via standard workflow
5. **Verify**: Re-measure KPIs to confirm improvement
6. **Iterate**: Repeat

---

## Related Documents

- `01_GOAL.md` — Project objectives and success criteria
- `03_ARCHITECTURE.md` — System components that generate metrics
- `05_TASKS/` — Tasks for addressing metric gaps
- `10_RISK_REGISTER.md` — Risks that could impact KPIs
- `docs/performance-optimizations.md` — Web Vitals details
- `CEO-HANDOVER.md` — Operational procedures
