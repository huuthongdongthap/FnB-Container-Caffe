File: `js/api-client.js`. THÊM methods cho Loyalty:
- getMember(phone) → GET /api/loyalty/member/:phone
- registerMember(data) → POST /api/loyalty/register
- getWallet(userId) → GET /api/loyalty/wallet/:userId
- getTransactions(userId, opts) → GET /api/loyalty/transactions/:userId?type=X&limit=Y
- getPointsHistory(userId) → GET /api/loyalty/points/:userId
- processCashback(orderId, userId) → POST /api/loyalty/process-cashback
- spendCashback(data) → POST /api/loyalty/spend-cashback
- getRewards(userId) → GET /api/loyalty/rewards/:userId
- redeemReward(userId, rewardId) → POST /api/loyalty/redeem
- getTiers() → GET /api/loyalty/tiers

Follow existing code pattern.
