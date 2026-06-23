# 07_EVALUATION

## Evaluation Framework

**Project:** {PROJECT_NAME}
**Version:** {VERSION}
**Effective Date:** {DATE}

---

## Key Performance Indicators (KPIs)

### Technical KPIs

| KPI | Definition | Target | Current | Measurement Tool | Review Cadence |
|-----|------------|--------|---------|------------------|----------------|
| {TECH_METRIC_1} | {DEFINITION_1} | {TARGET_1} | {CURRENT_1} | {TOOL_1} | {CADENCE_1} |
| {TECH_METRIC_2} | {DEFINITION_2} | {TARGET_2} | {CURRENT_2} | {TOOL_2} | {CADENCE_2} |
| {TECH_METRIC_3} | {DEFINITION_3} | {TARGET_3} | {CURRENT_3} | {TOOL_3} | {CADENCE_3} |
| {TECH_METRIC_4} | {DEFINITION_4} | {TARGET_4} | {CURRENT_4} | {TOOL_4} | {CADENCE_4} |

**Technical KPI Details:**

1. **{TECH_METRIC_1}**
   - Calculation: {CALC_METHOD_1}
   - Thresholds: Green ({GREEN_1}), Yellow ({YELLOW_1}), Red ({RED_1})
   - Alerting: {ALERT_1}

2. **{TECH_METRIC_2}**
   - Calculation: {CALC_METHOD_2}
   - Thresholds: Green ({GREEN_2}), Yellow ({YELLOW_2}), Red ({RED_2})
   - Alerting: {ALERT_2}

---

### Business KPIs

| KPI | Definition | Target | Current | Measurement Tool | Review Cadence |
|-----|------------|--------|---------|------------------|----------------|
| {BIZ_METRIC_1} | {DEFINITION_1} | {TARGET_1} | {CURRENT_1} | {TOOL_1} | {CADENCE_1} |
| {BIZ_METRIC_2} | {DEFINITION_2} | {TARGET_2} | {CURRENT_2} | {TOOL_2} | {CADENCE_2} |
| {BIZ_METRIC_3} | {DEFINITION_3} | {TARGET_3} | {CURRENT_3} | {TOOL_3} | {CADENCE_3} |
| {BIZ_METRIC_4} | {DEFINITION_4} | {TARGET_4} | {CURRENT_4} | {TOOL_4} | {CADENCE_4} |

---

### Operational KPIs

| KPI | Definition | Target | Current | Measurement Tool | Review Cadence |
|-----|------------|--------|---------|------------------|----------------|
| {OPS_METRIC_1} | {DEFINITION_1} | {TARGET_1} | {CURRENT_1} | {TOOL_1} | {CADENCE_1} |
| {OPS_METRIC_2} | {DEFINITION_2} | {TARGET_2} | {CURRENT_2} | {TOOL_2} | {CADENCE_2} |
| {OPS_METRIC_3} | {DEFINITION_3} | {TARGET_3} | {CURRENT_3} | {TOOL_3} | {CADENCE_3} |

---

## Evaluation Process

### Data Collection

- **Sources:** {DATA_SOURCES}
- **Frequency:** {COLLECTION_FREQUENCY}
- **Automation:** {AUTOMATION_LEVEL}

### Review Meetings

| Meeting | Frequency | Attendees | Focus |
|---------|-----------|-----------|-------|
| {MEETING_1} | {FREQ_1} | {ATTENDEES_1} | {FOCUS_1} |
| {MEETING_2} | {FREQ_2} | {ATTENDEES_2} | {FOCUS_2} |
| {MEETING_3} | {FREQ_3} | {ATTENDEES_3} | {FOCUS_3} |

### Action Items

- KPI below threshold → Create remediation task within 24h
- Trend declining → Investigate root cause within 1 week
- Target consistently exceeded → Consider raising target

---

## Success Thresholds

### Zone Definitions

| Zone | Meaning | Action Required |
|------|---------|-----------------|
| 🟢 Green | Meeting target | Continue monitoring |
| 🟡 Yellow | {YELLOW_THRESHOLD}% of target | Investigate causes |
| 🔴 Red | Below {RED_THRESHOLD}% of target | Immediate action required |

---

## Monitoring Stack

### Tools Configuration

```yaml
monitoring:
  apm: {APM_TOOL}
  logs: {LOG_TOOL}
  metrics: {METRICS_TOOL}
  dashboards: {DASHBOARD_TOOL}
  alerting: {ALERTING_TOOL}
```

### Dashboard Links

- Technical Dashboard: {TECH_DASHBOARD_URL}
- Business Dashboard: {BIZ_DASHBOARD_URL}
- Operations Dashboard: {OPS_DASHBOARD_URL}

---

## Quality Gates

### Pre-deployment Gates

- [ ] Test coverage ≥ {COVERAGE_TARGET}%
- [ ] Performance benchmarks pass (p95 < {LATENCY_TARGET}ms)
- [ ] Security scan: 0 critical vulnerabilities
- [ ] Documentation updated

### Post-deployment Gates

- [ ] Error rate < {ERROR_RATE_TARGET}% for 1 hour
- [ ] No pager alerts for 24 hours
- [ ] Key business metrics stable (±{METRIC_VARIANCE}%)

---

*Replace placeholders `{}` with project-specific values. Delete unused KPI categories.*
