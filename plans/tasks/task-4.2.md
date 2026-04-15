Tạo file `worker/src/routes/reviews.js`:
- GET /api/reviews?limit=10&offset=0&rating=5 → D1 query reviews table, filter rating if provided → Return { success: true, reviews: [...], average_rating, total_count }
- POST /api/reviews → Validate: customer_name required, rating 1-5, content min 10 chars → Insert with crypto.randomUUID() → Return { success: true, review_id }

Tạo file `worker/src/routes/contact.js`:
- POST /api/contact → Validate: name, content required → Insert into contact_messages → Return { success: true, message_id }

Follow EXACT pattern từ menu.js / orders.js. CORS middleware phải được áp dụng. Register routes trong `worker/src/index.js`.
