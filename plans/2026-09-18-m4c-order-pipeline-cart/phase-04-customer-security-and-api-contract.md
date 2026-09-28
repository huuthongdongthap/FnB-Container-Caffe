# Phase 04: Customer Security Boundary & OpenAPI Contract

## Overview
- **Goal:** Expose canonical `POST /api/orders` endpoint, customer-safe order projection, and OpenAPI 3.1 documentation.
- **Status:** COMPLETE
- **Dependency:** Phases 01-03.

## Requirements
1. **Endpoint Unification:**
   - Canonical `POST /api/orders`: Create customer order with payload validation.
   - Canonical `GET /api/orders/:id`: Returns customer-safe order details (stripping internal cost, margins, staff notes).
   - Canonical `GET /api/orders`: Returns list of customer's own orders (filtered by authenticated customer / phone session).
2. **OpenAPI 3.1 Schema Registration:**
   - Define `CreateOrderPayloadSchema`, `OrderCustomerResponseSchema`, and `OrderRoutes` in `packages/domain/order/schemas/order.ts`.
   - Mount in `worker/src/lib/openapi.ts`.
3. **Data Security & Privacy:**
   - Order projection never leaks internal kitchen notes or supplier information.
   - IDOR prevention: Customer cannot inspect another customer's order without matching verification (token/phone).

## Implementation Tasks
- [x] Implement `OrderCustomerResponseSchema` and OpenAPI routes.
- [x] Wire `POST /api/orders` and `GET /api/orders/:id` in `worker/src/index.ts`.
- [x] Mount schemas into `worker/src/lib/openapi.ts`.
