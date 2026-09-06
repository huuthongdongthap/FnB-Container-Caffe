# Phase 1 — Baseline and SLOs

## Overview
**Priority:** P0 · **Status:** Completed 2026-08-25 → `readiness-baseline-inventory.md`

Inventory current production paths and define measurable launch gates without changing runtime behavior.

## Steps
1. Map request, order, payment, webhook, notification, admin, cron, and D1/KV flows.
2. Record current health endpoints, metrics, logs, deployment scripts, and provider dependencies.
3. Define initial SLOs: API availability, p95 latency, payment success, webhook processing, KDS/order SLA, and notification delivery.
4. Define alert thresholds, owners, severity, and evidence source for each SLO.
5. Document gaps and select staging-safe validation targets.

## Files
- Modify: `docs/03_ARCHITECTURE.md`, `docs/04_ROADMAP.md`, deployment documentation.
- Create: readiness inventory/report under this plan directory.

## Success criteria
- Every critical flow has an owner, metric, threshold, and runbook link.
- No secret values are copied into reports.
