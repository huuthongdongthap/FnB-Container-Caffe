/**
 * Customer Loyalty Rewards Point System
 * F&B Container Café — Chương trình tích điểm thành viên
 */

// ═══════════════════════════════════════════════
//  CUSTOMER TIERS (Hạng thành viên)
// ═══════════════════════════════════════════════
const CUSTOMER_TIERS = {
    DONG: {
        id: 'dong',
        name: 'Thành viên Đồng',
        icon: '🥉',
        minPoints: 0,
        maxPoints: 4999,
        benefits: ['Tích 10đ = 1 point', 'Quà sinh nhật 50 points'],
        color: '#CD7F32'
    },
    BAC: {
        id: 'bac',
        name: 'Thành viên Bạc',
        icon: '🥈',
        minPoints: 5000,
        maxPoints: 14999,
        benefits: ['Tích 8đ = 1 point', 'Quà sinh nhật 100 points', 'Ưu tiên đặt bàn'],
        color: '#C0C0C0'
    },
    VANG: {
        id: 'vang',
        name: 'Thành viên Vàng',
        icon: '🥇',
        minPoints: 15000,
        maxPoints: 49999,
        benefits: ['Tích 6đ = 1 point', 'Quà sinh nhật 200 points', 'Free ship 5km', 'Menu riêng'],
        color: '#FFD700'
    },
    KIM_CUONG: {
        id: 'kim-cuong',
        name: 'Thành viên Kim Cương',
        icon: '💎',
        minPoints: 50000,
        maxPoints: Infinity,
        benefits: ['Tích 5đ = 1 point', 'Quà sinh nhật 500 points', 'Free ship toàn quốc', 'Event đặc biệt'],
        color: '#B9F2FF'
    }
};

// ═══════════════════════════════════════════════
//  POINTS RULES (Quy tắc tích điểm)
// ═══════════════════════════════════════════════
const POINTS_RULES = {
    BASE_EARN_RATE: 10, // 10.000đ = 1 point (Đồng)
    REDEMPTION_RATE: 100, // 100 points = 10.000đ
    BIRTHDAY_BONUS: {
        dong: 50,
        bac: 100,
        vang: 200,
        'kim-cuong': 500
    },
    SPECIAL_EVENTS: {
        '2/9': 2, // 2x points
        '30/4': 2,
        'tet': 3, // 3x points
        'black-friday': 5 // 5x points
    }
};

// ═══════════════════════════════════════════════
//  LOYALTY MANAGER CLASS
// ═══════════════════════════════════════════════
class LoyaltyManager {
    constructor() {
        this.customerId = this._getCustomerId();
        this.customer = this._loadCustomer();
        this.transactionHistory = this._loadHistory();
    }

    _getCustomerId() {
        let id = localStorage.getItem('fnb_customer_id');
        if (!id) {
            id = 'CUST' + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase();
            localStorage.setItem('fnb_customer_id', id);
        }
        return id;
    }

    _loadCustomer() {
        const saved = localStorage.getItem('fnb_loyalty_customer');
        if (saved) {
            return JSON.parse(saved);
        }
        return {
            id: this.customerId,
            name: '',
            phone: '',
            email: '',
            points: 0,
            lifetimePoints: 0,
            tier: 'dong',
            joinedDate: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            birthday: null
        };
    }

    _saveCustomer() {
        localStorage.setItem('fnb_loyalty_customer', JSON.stringify(this.customer));
    }

    _loadHistory() {
        const saved = localStorage.getItem('fnb_loyalty_history');
        return saved ? JSON.parse(saved) : [];
    }

    _saveHistory() {
        localStorage.setItem('fnb_loyalty_history', JSON.stringify(this.transactionHistory));
    }

    // Get current tier info
    getTier() {
        const tiers = Object.values(CUSTOMER_TIERS);
        for (const tier of tiers) {
            if (this.customer.points >= tier.minPoints && this.customer.points <= tier.maxPoints) {
                return tier;
            }
        }
        return CUSTOMER_TIERS.DONG;
    }

    // Calculate points to next tier
    getNextTierProgress() {
        const currentTier = this.getTier();
        const tiers = Object.values(CUSTOMER_TIERS);
        const nextTierIndex = tiers.findIndex(t => t.id === currentTier.id) + 1;

        if (nextTierIndex >= tiers.length) {
            return { progress: 100, nextTier: null, pointsNeeded: 0 };
        }

        const nextTier = tiers[nextTierIndex];
        const pointsNeeded = nextTier.minPoints - this.customer.points;
        const progress = ((this.customer.points - currentTier.minPoints) / (currentTier.maxPoints - currentTier.minPoints)) * 100;

        return {
            progress: Math.min(100, progress),
            nextTier: nextTier,
            pointsNeeded: pointsNeeded
        };
    }

    // Earn points from order
    async earnPoints(orderTotal, orderId = null) {
        const currentTier = this.getTier();
        let earnRate = POINTS_RULES.BASE_EARN_RATE;

        // Apply tier-based earn rate
        switch (currentTier.id) {
            case 'bac': earnRate = 8; break;
            case 'vang': earnRate = 6; break;
            case 'kim-cuong': earnRate = 5; break;
        }

        // Check for special events
        const today = new Date();
        const dateKey = `${today.getDate()}/${today.getMonth() + 1}`;
        if (POINTS_RULES.SPECIAL_EVENTS[dateKey]) {
            earnRate = earnRate / POINTS_RULES.SPECIAL_EVENTS[dateKey];
        }

        // Calculate points earned
        const pointsEarned = Math.floor(orderTotal / 1000 / earnRate * 10);

        // Update customer
        this.customer.points += pointsEarned;
        this.customer.lifetimePoints += pointsEarned;
        this.customer.lastActivity = new Date().toISOString();

        // Check for tier upgrade
        const newTier = this.getTier();
        const tierUpgraded = newTier.id !== currentTier.id;

        // Add transaction
        const transaction = {
            id: 'TXN' + Date.now(),
            type: 'earn',
            points: pointsEarned,
            orderTotal: orderTotal,
            orderId: orderId,
            date: new Date().toISOString(),
            description: `Tích điểm từ đơn hàng ${orderId || '#' + Math.random().toString(36).substr(2, 6)}`,
            tierAfter: newTier.id
        };

        this.transactionHistory.unshift(transaction);
        this._saveCustomer();
        this._saveHistory();

        // Trigger tier upgrade notification
        if (tierUpgraded) {
            this._triggerTierUpgrade(newTier);
        }

        return {
            pointsEarned,
            newBalance: this.customer.points,
            tier: newTier,
            tierUpgraded
        };
    }

    // Redeem points
    redeemPoints(pointsAmount, orderId = null) {
        if (pointsAmount > this.customer.points) {
            throw new Error('Không đủ điểm để đổi');
        }

        if (pointsAmount < 100) {
            throw new Error('Tối thiểu 100 points để đổi');
        }

        const discountValue = (pointsAmount / POINTS_RULES.REDEMPTION_RATE) * 10000;

        // Update customer
        this.customer.points -= pointsAmount;
        this.customer.lastActivity = new Date().toISOString();

        // Add transaction
        const transaction = {
            id: 'TXN' + Date.now(),
            type: 'redeem',
            points: -pointsAmount,
            discountValue: discountValue,
            orderId: orderId,
            date: new Date().toISOString(),
            description: `Đổi ${pointsAmount} points thành ${discountValue.toLocaleString('vi-VN')}đ`,
            tierAfter: this.getTier().id
        };

        this.transactionHistory.unshift(transaction);
        this._saveCustomer();
        this._saveHistory();

        return {
            pointsRedeemed: pointsAmount,
            discountValue: discountValue,
            newBalance: this.customer.points
        };
    }

    // Give birthday bonus
    giveBirthdayBonus() {
        const currentTier = this.getTier();
        const bonus = POINTS_RULES.BIRTHDAY_BONUS[currentTier.id] || 50;

        this.customer.points += bonus;
        this.customer.lifetimePoints += bonus;

        const transaction = {
            id: 'TXN' + Date.now(),
            type: 'bonus',
            points: bonus,
            date: new Date().toISOString(),
            description: '🎂 Quà sinh nhật',
            tierAfter: this.getTier().id
        };

        this.transactionHistory.unshift(transaction);
        this._saveCustomer();
        this._saveHistory();

        return bonus;
    }

    // Get transaction history
    getHistory(limit = 20) {
        return this.transactionHistory.slice(0, limit);
    }

    // Update customer info
    updateCustomerInfo(info) {
        this.customer = { ...this.customer, ...info };
        this._saveCustomer();
    }

    // Check birthday today
    isBirthdayToday() {
        if (!this.customer.birthday) return false;
        const today = new Date();
        const birthday = new Date(this.customer.birthday);
        return today.getDate() === birthday.getDate() && today.getMonth() === birthday.getMonth();
    }

    // Trigger tier upgrade notification
    _triggerTierUpgrade(newTier) {
        const event = new CustomEvent('loyalty-tier-upgrade', {
            detail: {
                customerId: this.customerId,
                newTier: newTier,
                message: `🎉 Chúc mừng! Bạn đã nâng hạng lên ${newTier.icon} ${newTier.name}!`
            }
        });
        window.dispatchEvent(event);
    }

    // Reset for new year (optional maintenance)
    resetYearly() {
        // Keep points and tier, just reset special bonuses
        console.log('Yearly reset for customer:', this.customerId);
    }
}

// ═══════════════════════════════════════════════
//  UI HELPERS
// ═══════════════════════════════════════════════

// Render tier badge
function renderTierBadge(tier) {
    return `
        <div class="tier-badge" style="background: linear-gradient(135deg, ${tier.color}, ${tier.color}88);">
            <span class="tier-icon">${tier.icon}</span>
            <span class="tier-name">${tier.name}</span>
        </div>
    `;
}

// Render points balance
function renderPointsBalance(points) {
    return `
        <div class="points-balance">
            <span class="points-value">${points.toLocaleString('vi-VN')}</span>
            <span class="points-label">points</span>
        </div>
    `;
}

// Render progress bar to next tier
function renderTierProgress(progress, nextTier) {
    if (!nextTier) {
        return '<div class="tier-max">🏆 Max Tier Achieved!</div>';
    }

    return `
        <div class="tier-progress">
            <div class="tier-progress-header">
                <span>${Math.round(progress)}% đến ${nextTier.icon} ${nextTier.name}</span>
            </div>
            <div class="tier-progress-bar">
                <div class="tier-progress-fill" style="width: ${Math.min(100, progress)}%"></div>
            </div>
        </div>
    `;
}

// Render transaction history item
function renderTransactionItem(txn) {
    const typeIcons = { earn: '➕', redeem: '🔻', bonus: '🎁' };
    const typeColors = { earn: '#10b981', redeem: '#ef4444', bonus: '#f59e0b' };

    return `
        <div class="transaction-item">
            <div class="transaction-icon" style="color: ${typeColors[txn.type]}">
                ${typeIcons[txn.type]}
            </div>
            <div class="transaction-info">
                <span class="transaction-description">${txn.description}</span>
                <span class="transaction-date">${new Date(txn.date).toLocaleDateString('vi-VN')}</span>
            </div>
            <span class="transaction-points ${txn.points > 0 ? 'positive' : 'negative'}">
                ${txn.points > 0 ? '+' : ''}${txn.points}
            </span>
        </div>
    `;
}

// Export
window.LoyaltyManager = LoyaltyManager;
window.CUSTOMER_TIERS = CUSTOMER_TIERS;
window.POINTS_RULES = POINTS_RULES;
window.renderTierBadge = renderTierBadge;
window.renderPointsBalance = renderPointsBalance;
window.renderTierProgress = renderTierProgress;
window.renderTransactionItem = renderTransactionItem;
