---
title: Automated Marketing Campaigns
date: 2026-07-02
status: completed
priority: P1
---

# Automated Marketing Campaigns

Build a self-service campaign engine that sends SMS/email to customers based on behavior triggers.

**Goal:** Turn customer data into repeat visits via automated messaging.
**Approach:** 5 phases, TDD per phase.
**Existing infra:** SpeedSMS ✅, SendGrid ✅, Zalo ZNS ✅, Mautic (CRM sync only), cron schedule.

## Phases

| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 1 | Campaign engine + types | 2h | completed |
| 2 | SMS/email channel modules | 2h | completed |
| 3 | Campaign triggers (5 triggers) | 4h | completed |
| 4 | Cron integration | 2h | completed |
| 5 | E2E + deploy | 2h | completed |

**Total:** ~12h

**Key constraint:** Keep existing 1,033+ tests passing. No breaking changes to existing routes.
