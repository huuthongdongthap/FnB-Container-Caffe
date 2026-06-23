# 06_ADR/README

## Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for {PROJECT_NAME}. ADRs document significant architectural decisions, including context, alternatives considered, and consequences.

### What is an ADR?

An ADR is a short document that captures an important decision made during the architecture or design of a system. It includes:

- **Context** - Why is this decision needed? What problem are we solving?
- **Decision** - What did we decide? The solution we chose.
- **Consequences** - What are the outcomes (positive and negative)?
- **Alternatives Considered** - What other options did we consider?
- **Related Decisions/ADRs** - Links to related decisions

### When to Create an ADR

Create an ADR when:
- Making a decision with significant technical impact
- Choosing between substantially different approaches
- Introducing new dependencies or technologies
- Changing existing architectural patterns
- The decision is hard to reverse

### ADR Naming Convention

Files are numbered sequentially: `0001-short-title.md`, `0002-another-decision.md`, etc.

### Status Values

- **Accepted** - Decision made and implemented
- **Deprecated** - Decision no longer relevant (superseded)
- **Experimental** - Proposed, under evaluation
- **Rejected** - Considered but not adopted

### Template

Use the template in `TEMPLATE.md` for new ADRs.

### ADR Index

| ID | Title | Status | Date | Alternatives |
|----|-------|--------|------|--------------|
| {ADR_001_ID} | {ADR_001_TITLE} | {STATUS} | {DATE} | {ALT_COUNT} |
| {ADR_002_ID} | {ADR_002_TITLE} | {STATUS} | {DATE} | {ALT_COUNT} |
| ... | ... | ... | ... | ... |

---

*Replace placeholders `{}` with your project-specific information.*
