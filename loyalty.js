/**
 * ═══════════════════════════════════════════════
 *  F&B CAFFE CONTAINER — Loyalty Rewards System
 *  Customer Loyalty Points Management
 * ═══════════════════════════════════════════════
 */

// ─── Loyalty Config & State ───
let LOYALTY_CONFIG = null;
let USER_LOYALTY = null;

// ─── Initialize Loyalty System ───
export async function initLoyaltySystem() {
    await loadLoyaltyConfig();
    loadUserLoyalty();
    return { config: LOYALTY_CONFIG, user: USER_LOYALTY };
}

// ─── Load Loyalty Config from JSON ───
async function loadLoyaltyConfig() {
    try {
        const response = await fetch('data/loyalty-config.json');
        LOYALTY_CONFIG = await response.json();
    } catch (error) {
        console.error('Không thể load loyalty config:', error);
        LOYALTY_CONFIG = getDefaultLoyaltyConfig();
    }
}

// ─── getDefaultLoyaltyConfig ───
function getDefaultLoyaltyConfig() {
    return {
        programName: "F&B Loyalty Club",
        tiers: [
            { id: 'dong', name: 'Thành Viên Đồng', icon: '🥉', minPoints: 0, multiplier: 1 },
            { id: 'bac', name: 'Thành Viên Bạc', icon: '🥈', minPoints: 5000, multiplier: 1.5 },
            { id: 'vang', name: 'Thành Viên Vàng', icon: '🥇', minPoints: 15000, multiplier: 2 },
            { id: 'kimcuong', name: 'Thành Viên Kim Cương', icon: '💎', minPoints: 50000, multiplier: 3 }
        ],
        rewards: [],
        earningRules: { baseRate: { amount: 10000, points: 1 } }
    };
}

// ─── Load User Loyalty Data ───
function loadUserLoyalty() {
    const saved = localStorage.getItem('fnb_loyalty_user');
    if (saved) {
        USER_LOYALTY = JSON.parse(saved);
    } else {
        // Create new user with default tier
        USER_LOYALTY = {
            memberId: generateMemberId(),
            joinedDate: new Date().toISOString(),
            totalPoints: 0,
            availablePoints: 0,
            lifetimePoints: 0,
            tierId: 'dong',
            tierProgress: 0,
            nextTierPoints: 5000,
            transactions: [],
            rewards: [],
            referrals: []
        };
        saveUserLoyalty();
    }
}

// ─── Save User Loyalty Data ───
function saveUserLoyalty() {
    localStorage.setItem('fnb_loyalty_user', JSON.stringify(USER_LOYALTY));
}

// ─── Generate Member ID ───
function generateMemberId() {
    const prefix = 'FNB';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `${prefix}${timestamp}${random}`;
}

// ─── Get Current Tier ───
export function getCurrentTier() {
    const points = USER_LOYALTY.lifetimePoints;
    let currentTier = LOYALTY_CONFIG.tiers[0];

    for (const tier of LOYALTY_CONFIG.tiers) {
        if (points >= tier.minPoints) {
            currentTier = tier;
        } else {
            break;
        }
    }

    return currentTier;
}

// ─── Get Next Tier ───
export function getNextTier() {
    const currentTier = getCurrentTier();
    const currentIndex = LOYALTY_CONFIG.tiers.findIndex(t => t.id === currentTier.id);

    if (currentIndex < LOYALTY_CONFIG.tiers.length - 1) {
        return LOYALTY_CONFIG.tiers[currentIndex + 1];
    }
    return null; // Max tier
}

// ─── Calculate Tier Progress ───
export function getTierProgress() {
    const currentTier = getCurrentTier();
    const nextTier = getNextTier();
    const points = USER_LOYALTY.lifetimePoints;

    if (!nextTier) {
        return { percent: 100, current: points, needed: 0, isMaxTier: true };
    }

    const prevMin = currentTier.minPoints;
    const range = nextTier.minPoints - prevMin;
    const progress = points - prevMin;
    const percent = Math.min(100, Math.round((progress / range) * 100));

    return {
        percent,
        current: points,
        needed: nextTier.minPoints - points,
        nextTierName: nextTier.name,
        isMaxTier: false
    };
}

// ─── Calculate Points Earned from Purchase ───
export function calculatePointsEarned(orderTotal) {
    const currentTier = getCurrentTier();
    const baseRate = LOYALTY_CONFIG.earningRules.baseRate;

    // Base points: 1 point per 10,000 VND
    const basePoints = Math.floor(orderTotal / baseRate.amount) * baseRate.points;

    // Tier multiplier bonus
    const tierBonus = Math.floor(basePoints * (currentTier.multiplier - 1));

    return {
        basePoints,
        tierBonus,
        totalPoints: basePoints + tierBonus,
        tier: currentTier.name,
        multiplier: currentTier.multiplier
    };
}

// ─── Add Points from Purchase ───
export function addPointsFromPurchase(orderTotal, orderData = {}) {
    const pointsData = calculatePointsEarned(orderTotal);
    const timestamp = new Date().toISOString();

    // Add transaction
    USER_LOYALTY.transactions.push({
        id: `txn_${Date.now()}`,
        type: 'earned',
        source: 'purchase',
        points: pointsData.totalPoints,
        basePoints: pointsData.basePoints,
        bonusPoints: pointsData.tierBonus,
        orderTotal,
        tier: USER_LOYALTY.tierId,
        timestamp,
        description: `Mua hàng ${formatCurrency(orderTotal)}`
    });

    // Update points
    USER_LOYALTY.totalPoints += pointsData.totalPoints;
    USER_LOYALTY.availablePoints += pointsData.totalPoints;
    USER_LOYALTY.lifetimePoints += pointsData.totalPoints;

    // Check tier upgrade
    const tierUpgraded = checkTierUpgrade();

    saveUserLoyalty();

    return {
        ...pointsData,
        newBalance: USER_LOYALTY.availablePoints,
        tierUpgraded
    };
}

// ─── Check Tier Upgrade ───
function checkTierUpgrade() {
    const currentTier = getCurrentTier();
    const newTierId = currentTier.id;

    if (newTierId !== USER_LOYALTY.tierId) {
        const oldTier = LOYALTY_CONFIG.tiers.find(t => t.id === USER_LOYALTY.tierId);

        USER_LOYALTY.tierId = newTierId;

        // Add upgrade transaction
        USER_LOYALTY.transactions.push({
            id: `tier_upgrade_${Date.now()}`,
            type: 'tier_upgrade',
            fromTier: oldTier?.name,
            toTier: currentTier.name,
            timestamp: new Date().toISOString(),
            description: `Nâng hạng lên ${currentTier.name}`
        });

        // Birthday bonus if applicable
        if (currentTier.birthdayBonus) {
            USER_LOYALTY.transactions.push({
                id: `tier_bonus_${Date.now()}`,
                type: 'earned',
                source: 'tier_upgrade_bonus',
                points: currentTier.birthdayBonus,
                timestamp: new Date().toISOString(),
                description: `Bonus nâng hạng: ${currentTier.birthdayBonus} points`
            });
            USER_LOYALTY.availablePoints += currentTier.birthdayBonus;
        }

        saveUserLoyalty();
        return {
            upgraded: true,
            newTier: currentTier,
            oldTier
        };
    }

    return { upgraded: false };
}

// ─── Redeem Reward ───
export function redeemReward(rewardId) {
    const reward = LOYALTY_CONFIG.rewards.find(r => r.id === rewardId);

    if (!reward) {
        return { success: false, error: 'Không tìm thấy reward' };
    }

    if (USER_LOYALTY.availablePoints < reward.points) {
        return {
            success: false,
            error: 'Không đủ points',
            needed: reward.points - USER_LOYALTY.availablePoints
        };
    }

    // Deduct points
    USER_LOYALTY.availablePoints -= reward.points;

    // Add to user's rewards
    const redemption = {
        id: `redemption_${Date.now()}`,
        rewardId: reward.id,
        rewardName: reward.name,
        pointsSpent: reward.points,
        status: 'active',
        redeemedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + reward.expiryDays * 24 * 60 * 60 * 1000).toISOString(),
        terms: reward.terms
    };

    USER_LOYALTY.rewards.push(redemption);

    // Add transaction
    USER_LOYALTY.transactions.push({
        id: `txn_redeem_${Date.now()}`,
        type: 'redeemed',
        rewardId: reward.id,
        rewardName: reward.name,
        points: -reward.points,
        timestamp: new Date().toISOString(),
        description: `Đổi thưởng: ${reward.name}`
    });

    saveUserLoyalty();

    return {
        success: true,
        redemption,
        newBalance: USER_LOYALTY.availablePoints
    };
}

// ─── Get Available Rewards ───
export function getAvailableRewards(category = null) {
    let rewards = LOYALTY_CONFIG.rewards;

    if (category) {
        rewards = rewards.filter(r => r.category === category);
    }

    // Add affordability info
    return rewards.map(reward => ({
        ...reward,
        canAfford: USER_LOYALTY.availablePoints >= reward.points,
        progress: Math.min(100, Math.round((USER_LOYALTY.availablePoints / reward.points) * 100))
    }));
}

// ─── Get Transaction History ───
export function getTransactionHistory(limit = 20) {
    const sorted = [...USER_LOYALTY.transactions].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
    return sorted.slice(0, limit);
}

// ─── Get Redemption History ───
export function getRedemptionHistory() {
    return [...USER_LOYALTY.rewards].sort(
        (a, b) => new Date(b.redeemedAt) - new Date(a.redeemedAt)
    );
}

// ─── Add Referral ───
export function addReferral(referralCode) {
    const bonus = LOYALTY_CONFIG.settings?.referralBonusBoth || 200;

    // Check if already referred
    if (USER_LOYALTY.referrals.some(r => r.code === referralCode)) {
        return { success: false, error: 'Đã sử dụng mã giới thiệu này' };
    }

    USER_LOYALTY.referrals.push({
        code: referralCode,
        joinedAt: new Date().toISOString(),
        status: 'pending'
    });

    // Add bonus points
    USER_LOYALTY.transactions.push({
        id: `referral_${Date.now()}`,
        type: 'earned',
        source: 'referral',
        points: bonus,
        timestamp: new Date().toISOString(),
        description: 'Bonus giới thiệu bạn bè'
    });

    USER_LOYALTY.availablePoints += bonus;
    USER_LOYALTY.lifetimePoints += bonus;

    saveUserLoyalty();

    return {
        success: true,
        points: bonus,
        newBalance: USER_LOYALTY.availablePoints
    };
}

// ─── Generate Referral Code ───
export function generateReferralCode() {
    const memberId = USER_LOYALTY.memberId;
    const random = Math.random().toString(36).substr(2, 3).toUpperCase();
    return `FNB-${memberId.slice(-4)}-${random}`;
}

// ─── Get User Loyalty Summary ───
export function getUserLoyaltySummary() {
    const currentTier = getCurrentTier();
    const progress = getTierProgress();

    return {
        memberId: USER_LOYALTY.memberId,
        tier: currentTier,
        availablePoints: USER_LOYALTY.availablePoints,
        lifetimePoints: USER_LOYALTY.lifetimePoints,
        tierProgress: progress,
        totalRewards: USER_LOYALTY.rewards.length,
        activeRewards: USER_LOYALTY.rewards.filter(r => r.status === 'active').length
    };
}

// ─── Format Currency ───
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

// ─── Reset User Loyalty (for testing) ───
export function resetUserLoyalty() {
    localStorage.removeItem('fnb_loyalty_user');
    loadUserLoyalty();
    return USER_LOYALTY;
}

// ─── Export for global access ───
window.LoyaltySystem = {
    init: initLoyaltySystem,
    getCurrentTier,
    getNextTier,
    getTierProgress,
    calculatePointsEarned,
    addPointsFromPurchase,
    redeemReward,
    getAvailableRewards,
    getTransactionHistory,
    getRedemptionHistory,
    getUserLoyaltySummary,
    addReferral,
    generateReferralCode,
    resetUserLoyalty
};
