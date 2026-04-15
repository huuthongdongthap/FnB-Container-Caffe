File: `js/api-client.js`. THÊM methods:
- createReservation(data) → POST /api/reservations
- checkAvailability(date) → GET /api/reservations?date=X
- createPayment(data) → POST /api/payments
- updatePaymentStatus(id, status) → PUT /api/payments/:id/status
- submitContact(data) → POST /api/contact
- getReviews(limit?, rating?) → GET /api/reviews?limit=X&rating=Y
- submitReview(data) → POST /api/reviews

Follow existing code pattern.
