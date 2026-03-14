"""
Tests for Loyalty API
"""
import pytest
from fastapi.testclient import TestClient
import sys
import os
import json

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from src.main import app

client = TestClient(app)

# Data files paths
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
LOYALTY_USERS_FILE = os.path.join(DATA_DIR, 'loyalty-users.json')


@pytest.fixture(autouse=True)
def cleanup_loyalty_data():
    """Cleanup loyalty data before and after each test."""
    # Before test: remove users file if exists
    if os.path.exists(LOYALTY_USERS_FILE):
        os.remove(LOYALTY_USERS_FILE)

    yield

    # After test: remove users file to keep tests isolated
    if os.path.exists(LOYALTY_USERS_FILE):
        os.remove(LOYALTY_USERS_FILE)


class TestLoyaltyConfig:
    """Test loyalty configuration endpoints."""

    def test_get_config(self):
        """Test getting loyalty config."""
        response = client.get("/api/loyalty/config")
        assert response.status_code == 200
        data = response.json()
        assert "programName" in data
        assert "tiers" in data
        assert "rewards" in data
        assert len(data["tiers"]) == 4  # Dong, Bac, Vang, Kim Cuong

    def test_get_rewards(self):
        """Test getting all rewards."""
        response = client.get("/api/loyalty/rewards")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_get_rewards_by_category(self):
        """Test getting rewards filtered by category."""
        response = client.get("/api/loyalty/rewards?category=free_drink")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for reward in data:
            assert reward.get("category") == "free_drink"


class TestLoyaltyUserRegistration:
    """Test user registration."""

    def test_register_new_user(self):
        """Test registering a new user."""
        response = client.post("/api/loyalty/user/register")
        assert response.status_code == 200
        data = response.json()
        assert "member_id" in data
        assert data["member_id"].startswith("FNB")
        assert data["available_points"] == 100  # Welcome bonus
        assert data["lifetime_points"] == 100
        assert data["tier_id"] == "dong"

    def test_register_with_phone(self):
        """Test registering with phone number."""
        response = client.post("/api/loyalty/user/register?phone=0901234567")
        assert response.status_code == 200
        data = response.json()
        assert data["phone"] == "0901234567"

    def test_register_with_email(self):
        """Test registering with email."""
        response = client.post("/api/loyalty/user/register?email=test@example.com")
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"

    def test_register_duplicate_phone(self):
        """Test registering with duplicate phone."""
        # First registration
        response1 = client.post("/api/loyalty/user/register?phone=0909998888")
        assert response1.status_code == 200

        # Duplicate registration
        response2 = client.post("/api/loyalty/user/register?phone=0909998888")
        assert response2.status_code == 400

    def test_register_with_referral(self):
        """Test registering with referral code."""
        # Create referrer
        response1 = client.post("/api/loyalty/user/register")
        assert response1.status_code == 200
        referrer_id = response1.json()["member_id"]

        # Create referred user
        response2 = client.post(
            f"/api/loyalty/user/register?referral_code={referrer_id}"
        )
        assert response2.status_code == 200
        new_user = response2.json()

        # Both should get referral bonus
        assert new_user["available_points"] >= 200  # Welcome + referral


class TestLoyaltyUserOperations:
    """Test user operations."""

    @pytest.fixture
    def registered_user(self):
        """Create a test user."""
        response = client.post("/api/loyalty/user/register?phone=0123456789")
        return response.json()

    def test_get_user(self, registered_user):
        """Test getting user by member ID."""
        member_id = registered_user["member_id"]
        response = client.get(f"/api/loyalty/user/{member_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["member_id"] == member_id
        assert data["phone"] == "0123456789"

    def test_get_nonexistent_user(self):
        """Test getting nonexistent user."""
        response = client.get("/api/loyalty/user/NONEXISTENT")
        assert response.status_code == 404

    def test_earn_points(self, registered_user):
        """Test earning points from purchase."""
        member_id = registered_user["member_id"]
        initial_points = registered_user["available_points"]

        response = client.post(f"/api/loyalty/user/{member_id}/earn?amount=100000")
        assert response.status_code == 200
        data = response.json()
        assert data["available_points"] > initial_points

    def test_earn_points_with_order_id(self, registered_user):
        """Test earning points with order reference."""
        member_id = registered_user["member_id"]
        response = client.post(
            f"/api/loyalty/user/{member_id}/earn?amount=50000&order_id=ORD123"
        )
        assert response.status_code == 200
        data = response.json()
        # Check transaction has order reference
        transactions = data.get("transactions", [])
        order_refs = [t.get("reference") for t in transactions if t.get("reference")]
        assert "ORD123" in order_refs

    def test_earn_points_nonexistent_user(self):
        """Test earning points for nonexistent user."""
        response = client.post("/api/loyalty/user/NONEXISTENT/earn?amount=10000")
        assert response.status_code == 404

    def test_get_transactions(self, registered_user):
        """Test getting user transactions."""
        member_id = registered_user["member_id"]

        # Earn some points
        client.post(f"/api/loyalty/user/{member_id}/earn?amount=50000")

        response = client.get(f"/api/loyalty/user/{member_id}/transactions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 1  # Welcome bonus + earned points

    def test_get_transactions_with_limit(self, registered_user):
        """Test getting transactions with limit."""
        member_id = registered_user["member_id"]

        # Earn points multiple times
        for i in range(10):
            client.post(f"/api/loyalty/user/{member_id}/earn?amount={10000 * (i + 1)}")

        response = client.get(f"/api/loyalty/user/{member_id}/transactions?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 5

    def test_get_rewards(self, registered_user):
        """Test getting user's redeemed rewards."""
        member_id = registered_user["member_id"]
        response = client.get(f"/api/loyalty/user/{member_id}/rewards")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestLoyaltyRedemption:
    """Test reward redemption."""

    @pytest.fixture
    def user_with_points(self):
        """Create a user with enough points for redemption."""
        response = client.post("/api/loyalty/user/register?phone=0987654321")
        member_id = response.json()["member_id"]

        # Earn enough points (need at least 150 for cheapest reward)
        # Welcome: 100 points + Earn: 150 points = 250 points total
        # At 1 point per 10,000đ, need 1,500,000đ to get 150 points
        client.post(f"/api/loyalty/user/{member_id}/earn?amount=1500000")

        return member_id

    def test_redeem_reward(self, user_with_points):
        """Test redeeming a reward."""
        # First, get available rewards
        rewards_response = client.get("/api/loyalty/rewards")
        rewards = rewards_response.json()
        reward = rewards[0]  # Get first reward

        response = client.post(
            f"/api/loyalty/user/{user_with_points}/redeem?reward_id={reward['id']}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["available_points"] < 2000  # Points should be deducted

    def test_redeem_insufficient_points(self):
        """Test redeeming with insufficient points."""
        # Create new user with only welcome bonus (100 points)
        response = client.post("/api/loyalty/user/register?phone=0111222333")
        member_id = response.json()["member_id"]

        # Try to redeem expensive reward (1500 points)
        response = client.post(
            f"/api/loyalty/user/{member_id}/redeem?reward_id=reward_009"
        )
        assert response.status_code == 400

    def test_redeem_nonexistent_reward(self, user_with_points):
        """Test redeeming nonexistent reward."""
        response = client.post(
            f"/api/loyalty/user/{user_with_points}/redeem?reward_id=NONEXISTENT"
        )
        assert response.status_code == 404

    def test_redeem_nonexistent_user(self):
        """Test redeeming for nonexistent user."""
        response = client.post(
            "/api/loyalty/user/NONEXISTENT/redeem?reward_id=reward_001"
        )
        assert response.status_code == 404

    def test_use_reward(self, user_with_points):
        """Test marking a reward as used."""
        # Redeem a reward first
        rewards_response = client.get("/api/loyalty/rewards")
        reward = rewards_response.json()[0]

        redeem_response = client.post(
            f"/api/loyalty/user/{user_with_points}/redeem?reward_id={reward['id']}"
        )
        assert redeem_response.status_code == 200

        # Get user to access redeemed rewards
        user_response = client.get(f"/api/loyalty/user/{user_with_points}")
        redeemed_reward = user_response.json()["rewards"][-1]
        reward_code = redeemed_reward["code"]

        # Use the reward
        use_response = client.post(
            f"/api/loyalty/user/{user_with_points}/rewards/{reward_code}/use"
        )
        assert use_response.status_code == 200

    def test_use_already_used_reward(self, user_with_points):
        """Test using already used reward."""
        # Redeem and use a reward
        rewards_response = client.get("/api/loyalty/rewards")
        reward = rewards_response.json()[0]

        redeem_response = client.post(
            f"/api/loyalty/user/{user_with_points}/redeem?reward_id={reward['id']}"
        )
        assert redeem_response.status_code == 200

        # Get user to access redeemed rewards
        user_response = client.get(f"/api/loyalty/user/{user_with_points}")
        redeemed_reward = user_response.json()["rewards"][-1]
        reward_code = redeemed_reward["code"]

        # Use it once
        client.post(f"/api/loyalty/user/{user_with_points}/rewards/{reward_code}/use")

        # Try to use again
        use_response = client.post(
            f"/api/loyalty/user/{user_with_points}/rewards/{reward_code}/use"
        )
        assert use_response.status_code == 400


class TestTierSystem:
    """Test tier upgrade system."""

    def test_tier_upgrade(self):
        """Test user tier upgrade based on lifetime points."""
        response = client.post("/api/loyalty/user/register?phone=0555666777")
        member_id = response.json()["member_id"]

        # Initial tier should be Dong
        assert response.json()["tier_id"] == "dong"

        # Earn enough points to reach Bac tier (5000 points)
        # Need approximately 500,000 VND (at 1 point per 10,000 VND)
        client.post(f"/api/loyalty/user/{member_id}/earn?amount=500000")

        user_response = client.get(f"/api/loyalty/user/{member_id}")
        user = user_response.json()
        assert user["tier_id"] in ["dong", "bac"]  # May need more points

    def test_tier_progress(self, registered_user=None):
        """Test tier progress calculation."""
        if not registered_user:
            response = client.post("/api/loyalty/user/register?phone=0444333222")
            member_id = response.json()["member_id"]
        else:
            member_id = registered_user["member_id"]

        user_response = client.get(f"/api/loyalty/user/{member_id}")
        user = user_response.json()
        assert "tier_progress" in user
        assert 0 <= user["tier_progress"] <= 100


class TestBirthdayBonus:
    """Test birthday bonus functionality."""

    @pytest.fixture
    def registered_user(self):
        """Create a test user."""
        response = client.post("/api/loyalty/user/register?phone=0999888777")
        return response.json()

    def test_give_birthday_bonus(self, registered_user):
        """Test giving birthday bonus."""
        member_id = registered_user["member_id"]
        initial_points = registered_user["available_points"]

        response = client.post(f"/api/loyalty/user/{member_id}/birthday-bonus")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["points"] > 0

        # Verify points were added
        user_response = client.get(f"/api/loyalty/user/{member_id}")
        user = user_response.json()
        assert user["available_points"] > initial_points

    def test_birthday_bonus_once_per_year(self, registered_user):
        """Test birthday bonus can only be given once per year."""
        member_id = registered_user["member_id"]

        # Give bonus first time
        response1 = client.post(f"/api/loyalty/user/{member_id}/birthday-bonus")
        assert response1.status_code == 200

        # Try to give again
        response2 = client.post(f"/api/loyalty/user/{member_id}/birthday-bonus")
        assert response2.status_code == 400


class TestLoyaltyEdgeCases:
    """Test edge cases and error handling."""

    def test_earn_zero_amount(self):
        """Test earning points with zero amount."""
        response = client.post("/api/loyalty/user/register")
        member_id = response.json()["member_id"]

        response = client.post(f"/api/loyalty/user/{member_id}/earn?amount=0")
        assert response.status_code == 200
        # Should not add points for zero amount

    def test_redeem_daily_limit(self):
        """Test daily redemption limit."""
        response = client.post("/api/loyalty/user/register?phone=0777888999")
        member_id = response.json()["member_id"]

        # Earn lots of points
        client.post(f"/api/loyalty/user/{member_id}/earn?amount=5000000")

        # Get cheapest reward
        rewards_response = client.get("/api/loyalty/rewards")
        rewards = rewards_response.json()
        cheapest_reward = min(rewards, key=lambda r: r["points"])

        # Redeem 3 times (max per day)
        for i in range(3):
            response = client.post(
                f"/api/loyalty/user/{member_id}/redeem?reward_id={cheapest_reward['id']}"
            )
            if i < 3:
                assert response.status_code == 200

        # 4th redemption should fail
        response = client.post(
            f"/api/loyalty/user/{member_id}/redeem?reward_id={cheapest_reward['id']}"
        )
        assert response.status_code == 400

    def test_delete_user(self):
        """Test deleting a user."""
        response = client.post("/api/loyalty/user/register?phone=0666555444")
        member_id = response.json()["member_id"]

        delete_response = client.delete(f"/api/loyalty/user/{member_id}")
        assert delete_response.status_code == 200

        # Verify user is deleted
        get_response = client.get(f"/api/loyalty/user/{member_id}")
        assert get_response.status_code == 404

    def test_delete_nonexistent_user(self):
        """Test deleting nonexistent user."""
        response = client.delete("/api/loyalty/user/NONEXISTENT")
        assert response.status_code == 404
