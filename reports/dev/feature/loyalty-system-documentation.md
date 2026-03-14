# Customer Loyalty Rewards System - Feature Documentation

**F&B Caffe Container** | Version: 1.0.0 | Date: 2026-03-14

---

## Tổng quan

Hệ thống Customer Loyalty Rewards là chương trình tích điểm đổi thưởng cho quán F&B Container Café tại Sa Đéc, Đồng Tháp. Khách hàng tích lũy điểm từ hóa đơn và đổi lấy rewards hấp dẫn.

---

## Tính năng chính

### 1. Hệ thống 4 hạng thành viên

| Hạng | Điểm yêu cầu | Multiplier | Birthday Bonus |
|------|--------------|------------|----------------|
| **Đồng** | 0 - 4,999 | 1.0x | 50 points |
| **Bạc** | 5,000 - 14,999 | 1.5x | 100 points |
| **Vàng** | 15,000 - 49,999 | 2.0x | 200 points |
| **Kim Cương** | 50,000+ | 3.0x | 500 points |

### 2. Tích điểm (Earn Points)

**Base Rate:** 1 point / 10,000đ hóa đơn

**Công thức:**
```
Points = (Amount / 10,000) × Tier Multiplier + Bonus
```

**Bonus Activities:**
- Đăng ký mới: 100 points
- Giới thiệu bạn bè: 100 points
- Birthday bonus: Theo tier

**Ví dụ:**
- Hóa đơn 200,000đ, thành viên Bạc: (200,000 / 10,000) × 1.5 = 30 points
- Hóa đơn 500,000đ, thành viên Kim Cương: (500,000 / 10,000) × 3.0 = 150 points

### 3. Đổi điểm (Redeem Points)

**Redemption Rate:** 100 points = 1,000đ

**Rewards Available:**

| Reward | Points | Value |
|--------|--------|-------|
| Free Espresso | 150 | 29,000đ |
| Voucher 20K | 200 | 20,000đ |
| Free Bánh Mì | 250 | 35,000đ |
| Free Cà Phê Sữa Đá | 300 | 29,000đ |
| Voucher 50K | 500 | 50,000đ |
| Free Signature Drink | 300 | 45,000đ |
| Limited Edition Mug | 800 | 99,000đ |
| 10% Discount | 1000 | 10% off |
| 15% Discount (VIP) | 1500 | 15% off |
| Secret Menu Access | 2000 | Exclusive |

**Rules:**
- Minimum redemption: 100 points
- Points expire sau 12 tháng không hoạt động
- Rewards có expiry date (30-90 ngày)

### 4. Transaction History

Mỗi transaction được lưu với:
- ID duy nhất
- Type: earn/redeem/bonus/referral
- Points amount
- Description
- Timestamp
- Reference (order ID, referred member ID)

---

## Architecture

### Frontend Components

```
public/
├── loyalty.js           # LoyaltyManager class
├── loyalty-styles.css   # Material Design 3 styles
└── loyalty.html         # Customer loyalty page
```

### Backend API

```
src/api/
└── loyalty.py          # FastAPI router
```

### Data Files

```
data/
├── loyalty-config.json   # Tiers, rewards, rules
└── loyalty-users.json    # User data (test)
```

---

## API Endpoints

### Configuration

```http
GET /api/loyalty/config
```

Returns: Loyalty program configuration (tiers, rewards, rules)

### User Profile

```http
GET /api/loyalty/user/:member_id
```

Returns: User profile with tier, points, transactions

### Register New Member

```http
POST /api/loyalty/user/register
Content-Type: application/json

{
  "phone": "0901234567",
  "name": "Nguyễn Văn A",
  "email": "example@email.com"
}
```

Returns: New member profile with welcome bonus

### Earn Points

```http
POST /api/loyalty/user/:member_id/earn
Content-Type: application/json

{
  "amount": 200000,
  "order_id": "ORD-2026-001"
}
```

Returns: Updated user profile with earned points

### Redeem Points

```http
POST /api/loyalty/user/:member_id/redeem
Content-Type: application/json

{
  "points": 200,
  "reward_id": "reward_002"
}
```

Returns: Updated user profile with redeemed reward

### Birthday Bonus

```http
POST /api/loyalty/user/:member_id/birthday-bonus
```

Returns: Updated user profile with birthday bonus points

---

## Usage Examples

### JavaScript (Frontend)

```javascript
// Initialize LoyaltyManager
const loyalty = new LoyaltyManager();

// Register new member
const member = await loyalty.register({
    name: 'Nguyễn Văn A',
    phone: '0901234567',
    email: 'nguyenvana@example.com'
});

// Earn points from order
const result = await loyalty.earnPoints(200000, 'ORD-2026-001');
console.log(`Earned ${result.pointsEarned} points`);

// Redeem reward
const reward = await loyalty.redeemPoints(200, 'reward_002');
console.log(`Redeemed: ${reward.rewardName}`);

// Check tier
const tier = loyalty.getTier();
console.log(`Current tier: ${tier.name}`);

// Get transaction history
const history = loyalty.getHistory();
console.log(`Total transactions: ${history.length}`);
```

### Python (Backend)

```python
from src.api.loyalty import LoyaltyUser, LoyaltyConfig

# Load config
config = load_loyalty_config()

# Calculate tier
tier = calculate_tier(config, lifetime_points=15000)
# Returns: ('vang', 0.0, 50000)

# Calculate points earned
base, bonus = calculate_points_earned(config, amount=200000, tier_id='bac')
# Returns: (30, 0)  # 30 points with 1.5x multiplier
```

---

## Data Models

### LoyaltyUser

```typescript
interface LoyaltyUser {
    member_id: string;
    phone: string;
    email: string;
    joined_date: string;
    total_points: number;
    available_points: number;
    lifetime_points: number;
    tier_id: string;
    tier_progress: number;
    next_tier_points: number;
    transactions: Transaction[];
    rewards: Reward[];
    referrals: string[];
    last_birthday_bonus: string | null;
}
```

### Transaction

```typescript
interface Transaction {
    id: string;
    type: 'earn' | 'redeem' | 'bonus' | 'referral';
    points: number;
    description: string;
    timestamp: string;
    reference?: string;
    bonus?: number;
}
```

### Reward

```typescript
interface Reward {
    reward_id: string;
    reward_name: string;
    points_spent: number;
    redeemed_at: string;
    expires_at: string;
    used: boolean;
    code: string;
}
```

---

## Test Results

**27 tests - All PASS**

Xem chi tiết tại: [reports/dev/feature/loyalty-system-test-results.md](./loyalty-system-test-results.md)

---

## Files

| File | Description |
|------|-------------|
| `public/loyalty.js` | Frontend controller (LoyaltyManager class) |
| `public/loyalty-styles.css` | Material Design 3 styles |
| `public/loyalty.html` | Customer loyalty page |
| `src/api/loyalty.py` | Backend API (FastAPI router) |
| `data/loyalty-config.json` | Program configuration |
| `data/loyalty-users.json` | Test user data |
| `tests/loyalty.test.js` | Jest test suite |

---

## Roadmap

### Phase 1 (Completed) ✅
- [x] Tier system (4 levels)
- [x] Point earning with multipliers
- [x] Point redemption
- [x] Transaction history
- [x] Birthday bonus
- [x] Referral system
- [x] Frontend UI
- [x] Backend API
- [x] Tests (27 tests passing)

### Phase 2 (Planned)
- [ ] Push notifications for tier upgrades
- [ ] Email reminders for expiring points
- [ ] Analytics dashboard for admin
- [ ] Mobile app integration
- [ ] QR code member card

---

**Contact:** F&B Container Café, Sa Đéc, Đồng Tháp
**Version:** 1.0.0
**Last Updated:** 2026-03-14
