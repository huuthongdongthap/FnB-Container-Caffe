# Phase 03 — Integration Tests + E2E

**Status:** ✅ complete
**Priority:** Medium
**TDD:** N/A

## Overview

End-to-end tests verifying Cal.com webhook → table allocation → reservation lifecycle.

## Test Cases

1. Webhook creates booking → reservation appears in GET /api/reservations
2. Table marked Reserved after booking
3. Cancelled webhook → reservation status = 'cancelled', table freed
4. Full booking → cancel cycle
5. Conflict: two bookings same time, last table → second returns 409

## Success Criteria

- [x] All integration tests pass
- [x] Full test suite: 653/653 pass, 0 fail
- [x] Build passes
