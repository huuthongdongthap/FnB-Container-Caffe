"""
═══════════════════════════════════════════════
  F&B CAFFE CONTAINER — Loyalty API
  Customer Loyalty Points Management System
═══════════════════════════════════════════════
"""

from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Header
from enum import Enum
import json
import os
import uuid

router = APIRouter(prefix="/api/loyalty", tags=["loyalty"])

# ─── Data Directory ───
def get_data_dir() -> str:
    """Get data directory by trying multiple paths."""
    candidates = [
        # Relative from src/api (when running from app root)
        os.path.join(os.path.dirname(__file__), "..", "..", "data"),
        # Relative from tests (when running pytest from mekong-cli root)
        os.path.join(os.path.dirname(__file__), "..", "..", "apps", "fnb-caffe-container", "data"),
    ]
    for path in candidates:
        abs_path = os.path.abspath(path)
        if os.path.exists(os.path.join(abs_path, "loyalty-config.json")):
            return abs_path
    # Default fallback
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))

DATA_DIR = get_data_dir()
LOYALTY_CONFIG_FILE = os.path.join(DATA_DIR, "loyalty-config.json")
LOYALTY_USERS_FILE = os.path.join(DATA_DIR, "loyalty-users.json")


# ─── Models ───
class TierEnum(str, Enum):
    dong = "dong"
    bac = "bac"
    vang = "vang"
    kimcuong = "kimcuong"


class RewardCategory(str, Enum):
    free_drink = "free_drink"
    free_food = "free_food"
    free_combo = "free_combo"
    discount = "discount"
    percentage_discount = "percentage_discount"
    merchandise = "merchandise"
    exclusive = "exclusive"


class TransactionType(str, Enum):
    earn = "earn"
    redeem = "redeem"
    expire = "expire"
    adjustment = "adjustment"
    referral = "referral"
    bonus = "bonus"


class LoyaltyTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: TransactionType
    points: int
    description: str
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    reference: Optional[str] = None  # order_id, reward_id, etc.
    bonus: int = 0  # Bonus points from tier multiplier


class RedeemedReward(BaseModel):
    reward_id: str
    reward_name: str
    points_spent: int
    redeemed_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    expires_at: str
    used: bool = False
    code: str = Field(default_factory=lambda: str(uuid.uuid4())[:8].upper())


class LoyaltyUser(BaseModel):
    member_id: str
    phone: Optional[str] = None
    email: Optional[str] = None
    joined_date: str = Field(default_factory=lambda: datetime.now().isoformat())
    total_points: int = 0
    available_points: int = 0
    lifetime_points: int = 0
    tier_id: TierEnum = TierEnum.dong
    tier_progress: float = 0.0  # Percentage to next tier
    next_tier_points: int = 0
    transactions: list[LoyaltyTransaction] = []
    rewards: list[RedeemedReward] = []
    referrals: list[str] = []  # List of member_ids referred
    last_birthday_bonus: Optional[str] = None


class LoyaltyConfig(BaseModel):
    model_config = {'populate_by_name': True}

    program_name: str = Field(alias='programName')
    currency: str
    tagline: str
    tiers: list[dict]
    earning_rules: dict = Field(alias='earningRules')
    rewards: list[dict]
    settings: dict


# ─── Helper Functions ───
def load_loyalty_config() -> LoyaltyConfig:
    """Load loyalty configuration from JSON file."""
    try:
        with open(LOYALTY_CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return LoyaltyConfig(**data)
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="Loyalty config file not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading config: {str(e)}")


def load_loyalty_users() -> dict[str, LoyaltyUser]:
    """Load all loyalty users from JSON file."""
    try:
        with open(LOYALTY_USERS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return {k: LoyaltyUser(**v) for k, v in data.items()}
    except FileNotFoundError:
        return {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading users: {str(e)}")


def save_loyalty_users(users: dict[str, LoyaltyUser]) -> bool:
    """Save loyalty users to JSON file."""
    try:
        with open(LOYALTY_USERS_FILE, "w", encoding="utf-8") as f:
            json.dump({k: v.model_dump() for k, v in users.items()}, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving users: {str(e)}")


def get_tier_by_id(config: LoyaltyConfig, tier_id: str) -> Optional[dict]:
    """Get tier configuration by ID."""
    for tier in config.tiers:
        if tier["id"] == tier_id:
            return tier
    return None


def calculate_tier(config: LoyaltyConfig, lifetime_points: int) -> tuple[str, float, int]:
    """Calculate tier based on lifetime points. Returns (tier_id, progress, next_tier_points)."""
    current_tier = "dong"
    next_tier_points = 0
    progress = 0.0

    sorted_tiers = sorted(config.tiers, key=lambda t: t["minPoints"])

    for i, tier in enumerate(sorted_tiers):
        if lifetime_points >= tier["minPoints"]:
            current_tier = tier["id"]
            # Calculate progress to next tier
            if i < len(sorted_tiers) - 1:
                next_tier = sorted_tiers[i + 1]
                next_tier_points = next_tier["minPoints"]
                range_start = tier["minPoints"]
                range_end = next_tier["minPoints"]
                progress = ((lifetime_points - range_start) / (range_end - range_start)) * 100
            else:
                progress = 100.0  # Max tier
            break

    return current_tier, min(progress, 100.0), next_tier_points


def calculate_points_earned(config: LoyaltyConfig, amount: float, tier_id: str) -> tuple[int, int]:
    """Calculate points earned from purchase. Returns (base_points, bonus_points)."""
    tier = get_tier_by_id(config, tier_id)
    multiplier = tier.get("multiplier", 1.0) if tier else 1.0

    base_rate = config.earning_rules.get("baseRate", {"amount": 10000, "points": 1})
    base_points = int((amount / base_rate["amount"]) * base_rate["points"])
    base_points = int(base_points * multiplier)

    bonus_points = base_points - int((amount / base_rate["amount"]) * base_rate["points"])

    return int((amount / base_rate["amount"]) * base_rate["points"]), bonus_points


def generate_member_id() -> str:
    """Generate unique member ID."""
    prefix = "FNB"
    timestamp = datetime.now().strftime("%Y%m%d")
    random = uuid.uuid4().hex[:4].upper()
    return f"{prefix}{timestamp}{random}"


# ─── API Endpoints ───

@router.get("/config", response_model=LoyaltyConfig)
async def get_config():
    """Get loyalty program configuration."""
    return load_loyalty_config()


@router.get("/user/{member_id}", response_model=LoyaltyUser)
async def get_user(member_id: str):
    """Get loyalty user by member ID."""
    users = load_loyalty_users()
    if member_id not in users:
        raise HTTPException(status_code=404, detail="Member not found")
    return users[member_id]


@router.post("/user/register", response_model=LoyaltyUser)
async def register_user(
    phone: Optional[str] = None,
    email: Optional[str] = None,
    referral_code: Optional[str] = None
):
    """Register new loyalty member."""
    users = load_loyalty_users()
    config = load_loyalty_config()

    # Check if phone/email already exists
    for user in users.values():
        if phone and user.phone == phone:
            raise HTTPException(status_code=400, detail="Phone already registered")
        if email and user.email == email:
            raise HTTPException(status_code=400, detail="Email already registered")

    member_id = generate_member_id()
    new_user = LoyaltyUser(
        member_id=member_id,
        phone=phone,
        email=email,
        transactions=[LoyaltyTransaction(
            type=TransactionType.bonus,
            points=100,
            description="Đăng ký thành viên mới",
            bonus=100
        )],
        total_points=100,
        available_points=100,
        lifetime_points=100
    )

    # Handle referral bonus
    if referral_code and referral_code in users:
        referrer = users[referral_code]
        referrer.referrals.append(member_id)
        referrer.transactions.append(LoyaltyTransaction(
            type=TransactionType.referral,
            points=config.settings.get("referralBonusBoth", 200),
            description=f"Thưởng giới thiệu từ {member_id}",
            reference=member_id
        ))
        referrer.total_points += config.settings.get("referralBonusBoth", 200)
        referrer.available_points += config.settings.get("referralBonusBoth", 200)
        referrer.lifetime_points += config.settings.get("referralBonusBoth", 200)

        new_user.transactions.append(LoyaltyTransaction(
            type=TransactionType.referral,
            points=config.settings.get("referralBonusBoth", 200),
            description=f"Thưởng giới thiệu từ {referral_code}",
            reference=referral_code
        ))
        new_user.total_points += config.settings.get("referralBonusBoth", 200)
        new_user.available_points += config.settings.get("referralBonusBoth", 200)
        new_user.lifetime_points += config.settings.get("referralBonusBoth", 200)
        new_user.referrals.append(referral_code)

    users[member_id] = new_user
    save_loyalty_users(users)
    return new_user


@router.post("/user/{member_id}/earn", response_model=LoyaltyUser)
async def earn_points(
    member_id: str,
    amount: float,
    order_id: Optional[str] = None
):
    """Earn points from purchase."""
    users = load_loyalty_users()
    if member_id not in users:
        raise HTTPException(status_code=404, detail="Member not found")

    config = load_loyalty_config()
    user = users[member_id]

    base_points, bonus_points = calculate_points_earned(config, amount, user.tier_id)
    total_points = base_points + bonus_points

    description = f"Tích điểm từ hóa đơn {amount:,.0f}đ"
    if order_id:
        description += f" ({order_id})"

    transaction = LoyaltyTransaction(
        type=TransactionType.earn,
        points=base_points,
        bonus=bonus_points,
        description=description,
        reference=order_id
    )

    user.transactions.append(transaction)
    user.total_points += total_points
    user.available_points += total_points
    user.lifetime_points += total_points

    # Auto-upgrade tier if applicable
    new_tier, progress, next_points = calculate_tier(config, user.lifetime_points)
    if new_tier != user.tier_id:
        old_tier = user.tier_id
        user.tier_id = new_tier  # type: ignore
        user.transactions.append(LoyaltyTransaction(
            type=TransactionType.bonus,
            points=0,
            description=f"Nâng hạng từ {get_tier_by_id(config, old_tier)['name']} lên {get_tier_by_id(config, new_tier)['name']}"
        ))

    user.tier_progress = progress
    user.next_tier_points = next_points

    users[member_id] = user
    save_loyalty_users(users)
    return user


@router.post("/user/{member_id}/redeem", response_model=LoyaltyUser)
async def redeem_reward(
    member_id: str,
    reward_id: str
):
    """Redeem a reward using points."""
    users = load_loyalty_users()
    if member_id not in users:
        raise HTTPException(status_code=404, detail="Member not found")

    config = load_loyalty_config()
    user = users[member_id]

    # Find reward
    reward = None
    for r in config.rewards:
        if r["id"] == reward_id:
            reward = r
            break

    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")

    # Check points
    if user.available_points < reward["points"]:
        raise HTTPException(
            status_code=400,
            detail=f"Không đủ điểm. Cần {reward['points']} points, bạn có {user.available_points} points"
        )

    # Check daily redemption limit
    today = datetime.now().date().isoformat()
    today_redemptions = sum(
        1 for t in user.transactions
        if t.type == TransactionType.redeem and t.timestamp.startswith(today)
    )
    max_per_day = config.settings.get("maxRedemptionPerDay", 3)
    if today_redemptions >= max_per_day:
        raise HTTPException(
            status_code=400,
            detail=f"Đạt giới hạn đổi quà ngày hôm nay ({max_per_day} lần)"
        )

    # Deduct points
    user.available_points -= reward["points"]
    user.total_points -= reward["points"]

    # Add redeemed reward
    expiry_days = reward.get("expiryDays", 30)
    redeemed = RedeemedReward(
        reward_id=reward_id,
        reward_name=reward["name"],
        points_spent=reward["points"],
        expires_at=(datetime.now() + timedelta(days=expiry_days)).isoformat()
    )
    user.rewards.append(redeemed)

    # Add transaction
    user.transactions.append(LoyaltyTransaction(
        type=TransactionType.redeem,
        points=-reward["points"],
        description=f"Đổi quà: {reward['name']}",
        reference=reward_id
    ))

    users[member_id] = user
    save_loyalty_users(users)
    return user


@router.get("/user/{member_id}/rewards", response_model=list[RedeemedReward])
async def get_user_rewards(member_id: str, used: Optional[bool] = None):
    """Get user's redeemed rewards."""
    users = load_loyalty_users()
    if member_id not in users:
        raise HTTPException(status_code=404, detail="Member not found")

    rewards = users[member_id].rewards

    if used is not None:
        rewards = [r for r in rewards if r.used == used]

    return rewards


@router.post("/user/{member_id}/rewards/{reward_code}/use")
async def use_reward(member_id: str, reward_code: str):
    """Mark a redeemed reward as used."""
    users = load_loyalty_users()
    if member_id not in users:
        raise HTTPException(status_code=404, detail="Member not found")

    user = users[member_id]
    reward = None
    for r in user.rewards:
        if r.code == reward_code:
            reward = r
            break

    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")

    if reward.used:
        raise HTTPException(status_code=400, detail="Reward already used")

    # Check expiry
    if datetime.fromisoformat(reward.expires_at) < datetime.now():
        raise HTTPException(status_code=400, detail="Reward đã hết hạn")

    reward.used = True
    users[member_id] = user
    save_loyalty_users(users)
    return {"status": "success", "reward": reward.model_dump()}


@router.get("/user/{member_id}/transactions", response_model=list[LoyaltyTransaction])
async def get_user_transactions(
    member_id: str,
    limit: int = 50,
    type: Optional[TransactionType] = None
):
    """Get user's transaction history."""
    users = load_loyalty_users()
    if member_id not in users:
        raise HTTPException(status_code=404, detail="Member not found")

    transactions = users[member_id].transactions

    if type:
        transactions = [t for t in transactions if t.type == type]

    # Sort by timestamp descending and limit
    transactions.sort(key=lambda t: t.timestamp, reverse=True)
    return transactions[:limit]


@router.get("/rewards", response_model=list[dict])
async def get_rewards(category: Optional[RewardCategory] = None):
    """Get all available rewards."""
    config = load_loyalty_config()
    rewards = config.rewards

    if category:
        rewards = [r for r in rewards if r.get("category") == category.value]

    return rewards


@router.delete("/user/{member_id}")
async def delete_user(member_id: str):
    """Delete a loyalty user."""
    users = load_loyalty_users()
    if member_id not in users:
        raise HTTPException(status_code=404, detail="Member not found")

    del users[member_id]
    save_loyalty_users(users)
    return {"status": "success", "message": f"Deleted member {member_id}"}


# ─── Birthday Bonus Endpoint ───
@router.post("/user/{member_id}/birthday-bonus")
async def give_birthday_bonus(member_id: str):
    """Give birthday bonus to user."""
    users = load_loyalty_users()
    if member_id not in users:
        raise HTTPException(status_code=404, detail="Member not found")

    config = load_loyalty_config()
    user = users[member_id]
    tier = get_tier_by_id(config, user.tier_id)

    # Check if already given this year
    if user.last_birthday_bonus:
        last_year = datetime.fromisoformat(user.last_birthday_bonus).year
        if datetime.now().year == last_year:
            raise HTTPException(status_code=400, detail="Đã nhận quà sinh nhật năm nay")

    bonus_points = tier.get("birthdayBonus", 50) if tier else 50

    user.transactions.append(LoyaltyTransaction(
        type=TransactionType.bonus,
        points=bonus_points,
        description=f"Quà sinh nhật từ {tier['name'] if tier else 'F&B'}"
    ))
    user.total_points += bonus_points
    user.available_points += bonus_points
    user.lifetime_points += bonus_points
    user.last_birthday_bonus = datetime.now().isoformat()

    users[member_id] = user
    save_loyalty_users(users)
    return {"status": "success", "points": bonus_points}
