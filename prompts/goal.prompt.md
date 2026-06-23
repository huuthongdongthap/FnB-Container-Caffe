# Goal Definition Prompt

**Purpose:** Define clear, measurable goals for a feature or project.

## Instructions

When given a feature request or project idea, produce:

1. **Problem Statement** — What user pain point are we solving?
2. **Goal** — High-level outcome (SMART: Specific, Measurable, Achievable, Relevant, Time-bound)
3. **Success Metrics** — How do we know we succeeded? (KPIs, thresholds)
4. **Scope** — In-scope vs out-of-scope (boundaries)
5. **Stakeholders** — Who cares about this? (users, business, tech)
6. **Constraints** — Budget, timeline, tech stack, compliance

## Template

```markdown
# GOAL: [Feature Name]

## Problem Statement
[Describe the current situation and pain point]

## Goal
[What we want to achieve, SMART format]

## Success Metrics
- [Metric 1] — Target: X, Current: Y, Deadline: date
- [Metric 2] — ...

## Scope
### In-scope
- Feature A
- Feature B

### Out-of-scope
- Feature C (future phase)
- Feature D (not needed)

## Stakeholders
| Role | Interest | Contact |
|------|----------|---------|
| Product Owner | Prioritization | @owner |
| Engineering | Implementation | @eng-lead |
| Customer | Benefit | N/A |

## Constraints
- Technical: [e.g., must use Cloudflare Workers]
- Business: [e.g., launch by Q3]
- Compliance: [e.g., GDPR, e-invoicing]
```

## Example

See `docs/01_GOAL.md` for a complete example.

---

*This prompt is used by the `/ck:goal` skill.*
