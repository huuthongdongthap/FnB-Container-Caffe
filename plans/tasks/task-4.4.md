File: `worker/src/routes/loyalty.js` (thêm vào file từ Task 4.3)

THÊM write routes:
- POST /api/loyalty/register → Body: { phone, full_name, email? } → Insert users + auto-create cashback_wallets (balance: 0) → 409 if phone exists
- POST /api/loyalty/process-cashback → Body: { order_id, user_id } → JS logic: lấy order total, lấy tier rate, tính cashback, UPDATE wallet, INSERT transaction → Return { cashback_earned, points_earned, new_balance, tier }
- POST /api/loyalty/spend-cashback → Body: { user_id, order_id, amount } → Check balance >= amount, max 50% order total → UPDATE wallet, INSERT transaction
- POST /api/loyalty/redeem → Body: { user_id, reward_id } → Check points, deduct, generate code, create user_reward

UUID: crypto.randomUUID(). Validate all inputs. Follow existing patterns.
