/**
 * ═══════════════════════════════════════════════
 *  F&B CAFFE CONTAINER — Loyalty UI Renderer
 *  UI Components for Loyalty System
 * ═══════════════════════════════════════════════
 */

import {
    initLoyaltySystem,
    getCurrentTier,
    getNextTier,
    getTierProgress,
    getAvailableRewards,
    getTransactionHistory,
    getRedemptionHistory,
    getUserLoyaltySummary,
    redeemReward,
    generateReferralCode,
    addReferral
} from './loyalty.js';

// ─── DOM Elements ───
const ui = {
    loyaltyCard: null,
    tierBadgesRow: null,
    tierProgressFill: null,
    tierProgressPoints: null,
    tierProgressHint: null,
    pointsNeeded: null,
    tierBenefits: null,
    rewardsGrid: null,
    rewardsFilter: null,
    transactionsList: null,
    redemptionsList: null,
    referralCode: null,
    copyReferralBtn: null,
    redemptionModal: null,
    redemptionModalBody: null,
    modalClose: null,
    toastContainer: null,
    historyTabs: null
};

// ─── Initialize ───
document.addEventListener('DOMContentLoaded', async () => {
    cacheElements();
    await initLoyaltyUI();
    setupEventListeners();
});

// ─── Cache DOM Elements ───
function cacheElements() {
    ui.loyaltyCard = document.getElementById('loyaltyCard');
    ui.tierBadgesRow = document.getElementById('tierBadgesRow');
    ui.tierProgressFill = document.getElementById('tierProgressFill');
    ui.tierProgressPoints = document.getElementById('tierProgressPoints');
    ui.tierProgressHint = document.getElementById('tierProgressHint');
    ui.pointsNeeded = document.getElementById('pointsNeeded');
    ui.tierBenefits = document.getElementById('tierBenefits');
    ui.rewardsGrid = document.getElementById('rewardsGrid');
    ui.rewardsFilter = document.getElementById('rewardsFilter');
    ui.transactionsList = document.getElementById('transactionsList');
    ui.redemptionsList = document.getElementById('redemptionsList');
    ui.referralCode = document.getElementById('referralCode');
    ui.copyReferralBtn = document.getElementById('copyReferralBtn');
    ui.redemptionModal = document.getElementById('redemptionModal');
    ui.redemptionModalBody = document.getElementById('redemptionModalBody');
    ui.modalClose = document.getElementById('modalClose');
    ui.toastContainer = document.getElementById('toastContainer');
    ui.historyTabs = document.querySelectorAll('.history-tab');
}

// ─── Initialize Loyalty UI ───
async function initLoyaltyUI() {
    try {
        const { config, user } = await initLoyaltySystem();

        // Render all components
        renderLoyaltyCard();
        renderTierBadges();
        renderTierProgress();
        renderTierBenefits();
        renderRewards('all');
        renderTransactions();
        renderRedemptions();
        renderReferralCode();

        showToast('🎉 Chào mừng đến F&B Loyalty Club!', 'success');
    } catch (error) {
        console.error('Error initializing loyalty UI:', error);
        showToast('⚠️ Không thể tải chương trình loyalty', 'error');
    }
}

// ─── Render Loyalty Card ───
function renderLoyaltyCard() {
    const summary = getUserLoyaltySummary();
    const tier = summary.tier;

    ui.loyaltyCard.innerHTML = `
        <div class="loyalty-card-header">
            <div class="member-info">
                <span class="member-label">Thành Viên</span>
                <code class="member-id">${summary.memberId}</code>
            </div>
            <div class="tier-badge-large" style="background: ${tier.gradient}">
                <span class="tier-icon">${tier.icon}</span>
                <span class="tier-name">${tier.name}</span>
            </div>
        </div>

        <div class="loyalty-card-body">
            <div class="points-display">
                <span class="points-value">${formatNumber(summary.availablePoints)}</span>
                <span class="points-label">points available</span>
            </div>

            <div class="points-breakdown">
                <div class="breakdown-item">
                    <span class="breakdown-label">Lifetime</span>
                    <span class="breakdown-value">${formatNumber(summary.lifetimePoints)}</span>
                </div>
                <div class="breakdown-item">
                    <span class="breakdown-label">Rewards</span>
                    <span class="breakdown-value">${summary.activeRewards}/${summary.totalRewards}</span>
                </div>
            </div>
        </div>

        <div class="loyalty-card-footer">
            <span class="card-decoration">F&B LOYALTY CLUB</span>
        </div>
    `;

    // Add animation
    ui.loyaltyCard.classList.add('card-enter');
}

// ─── Render Tier Badges Row ───
function renderTierBadges() {
    const currentTier = getCurrentTier();
    const tiers = window.LoyaltySystem?.config?.tiers || [];

    ui.tierBadgesRow.innerHTML = tiers.map((tier, index) => {
        const isCurrentTier = tier.id === currentTier.id;
        const isUnlocked = tier.minPoints <= currentTier.minPoints;

        return `
            <div class="tier-badge-item ${isCurrentTier ? 'active' : ''} ${isUnlocked ? 'unlocked' : 'locked'}">
                <div class="tier-badge-icon" style="${isUnlocked ? '' : 'filter: grayscale(1); opacity: 0.4;}">
                    ${tier.icon}
                </div>
                <span class="tier-badge-name">${tier.name}</span>
                <span class="tier-badge-points">${tier.minPoints.toLocaleString('vi-VN')} pts</span>
                ${index < tiers.length - 1 ? '<div class="tier-connector"></div>' : ''}
            </div>
        `;
    }).join('');
}

// ─── Render Tier Progress ───
function renderTierProgress() {
    const progress = getTierProgress();
    const currentTier = getCurrentTier();

    ui.tierProgressFill.style.width = `${progress.percent}%`;
    ui.tierProgressPoints.textContent = `${formatNumber(progress.current)} / ${progress.isMaxTier ? '∞' : formatNumber(progress.current + progress.needed)}`;

    if (progress.isMaxTier) {
        ui.tierProgressHint.innerHTML = '🏆 Bạn đã đạt hạng cao nhất!';
        ui.tierProgressHint.className = 'progress-hint max-tier';
    } else {
        ui.tierProgressHint.innerHTML = `
            Còn <strong id="pointsNeeded">${formatNumber(progress.needed)}</strong> điểm để lên
            <strong>${progress.nextTierName}</strong>
        `;
    }
}

// ─── Render Tier Benefits ───
function renderTierBenefits() {
    const currentTier = getCurrentTier();

    ui.tierBenefits.innerHTML = `
        <div class="benefits-header">
            <h3>🎁 Đặc Quyền Hạng ${currentTier.name}</h3>
        </div>
        <div class="benefits-grid">
            ${currentTier.benefits.map(benefit => `
                <div class="benefit-item">
                    <span class="benefit-check">✓</span>
                    <span class="benefit-text">${benefit}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// ─── Render Rewards Grid ───
function renderRewards(category = 'all') {
    const rewards = getAvailableRewards(category);

    if (rewards.length === 0) {
        ui.rewardsGrid.innerHTML = `
            <div class="rewards-empty">
                <span class="empty-icon">🎁</span>
                <p>Chưa có rewards nào</p>
            </div>
        `;
        return;
    }

    ui.rewardsGrid.innerHTML = rewards.map(reward => {
        const canAfford = reward.canAfford;

        return `
            <div class="reward-card ${canAfford ? 'available' : 'locked'}" data-reward-id="${reward.id}">
                <div class="reward-image">
                    <img src="${reward.image || 'images/reward-placeholder.png'}" alt="${reward.name}" loading="lazy">
                    ${reward.badge ? `<span class="reward-badge">${reward.badge}</span>` : ''}
                </div>

                <div class="reward-content">
                    <div class="reward-header">
                        <h3 class="reward-name">${reward.name}</h3>
                        <div class="reward-points">
                            <span class="points-icon">🪙</span>
                            <span class="points-value">${formatNumber(reward.points)}</span>
                        </div>
                    </div>

                    <p class="reward-description">${reward.description}</p>

                    ${reward.terms ? `<p class="reward-terms">${reward.terms}</p>` : ''}

                    <div class="reward-progress">
                        <div class="progress-bar-mini">
                            <div class="progress-fill-mini" style="width: ${canAfford ? 100 : reward.progress}%"></div>
                        </div>
                        <span class="progress-text ${canAfford ? 'ready' : ''}">
                            ${canAfford ? '✓ Có thể đổi' : `${reward.progress}%`}
                        </span>
                    </div>

                    <button class="btn-redeem ${canAfford ? 'active' : ''}"
                            data-reward-id="${reward.id}"
                            ${!canAfford ? 'disabled' : ''}>
                        ${canAfford ? '🎁 Đổi Ngay' : '🔒 Tích Thêm'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ─── Render Transactions ───
function renderTransactions() {
    const transactions = getTransactionHistory(15);

    if (transactions.length === 0) {
        ui.transactionsList.innerHTML = `
            <div class="history-empty">
                <span class="empty-icon">📜</span>
                <p>Chưa có giao dịch nào</p>
            </div>
        `;
        return;
    }

    ui.transactionsList.innerHTML = transactions.map(txn => {
        const isPositive = txn.points > 0;

        return `
            <div class="history-item ${isPositive ? 'earned' : 'spent'}">
                <div class="history-icon">${getTransactionIcon(txn.source || txn.type)}</div>
                <div class="history-content">
                    <span class="history-title">${txn.description || txn.source}</span>
                    <span class="history-date">${formatDate(txn.timestamp)}</span>
                </div>
                <div class="history-points ${isPositive ? 'positive' : 'negative'}">
                    ${isPositive ? '+' : ''}${formatNumber(txn.points)} pts
                </div>
            </div>
        `;
    }).join('');
}

// ─── Render Redemptions ───
function renderRedemptions() {
    const redemptions = getRedemptionHistory();

    if (redemptions.length === 0) {
        ui.redemptionsList.innerHTML = `
            <div class="history-empty">
                <span class="empty-icon">🎁</span>
                <p>Chưa đổi reward nào</p>
            </div>
        `;
        return;
    }

    ui.redemptionsList.innerHTML = redemptions.map(redemption => {
        const isExpired = new Date() > new Date(redemption.expiresAt);
        const statusClass = isExpired ? 'expired' : redemption.status;

        return `
            <div class="history-item redemption ${statusClass}">
                <div class="history-icon">🎁</div>
                <div class="history-content">
                    <span class="history-title">${redemption.rewardName}</span>
                    <span class="history-date">Đổi ${formatDate(redemption.redeemedAt)}</span>
                    ${isExpired ? '<span class="status-badge expired">Hết hạn</span>' : ''}
                </div>
                <div class="history-points negative">
                    -${formatNumber(redemption.pointsSpent)} pts
                </div>
            </div>
        `;
    }).join('');
}

// ─── Render Referral Code ───
function renderReferralCode() {
    const code = generateReferralCode();
    ui.referralCode.textContent = code;
}

// ─── Get Transaction Icon ───
function getTransactionIcon(source) {
    const icons = {
        purchase: '🛒',
        referral: '👥',
        tier_upgrade: '⬆️',
        tier_upgrade_bonus: '🎉',
        birthday: '🎂',
        review: '⭐',
        social_share: '📱',
        redeemed: '🎁'
    };
    return icons[source] || '📝';
}

// ─── Setup Event Listeners ───
function setupEventListeners() {
    // Rewards filter
    if (ui.rewardsFilter) {
        ui.rewardsFilter.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                document.querySelectorAll('.rewards-filter .filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                e.target.classList.add('active');
                renderRewards(e.target.dataset.category);
            }
        });
    }

    // Redeem button clicks (delegated)
    if (ui.rewardsGrid) {
        ui.rewardsGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-redeem');
            if (btn && btn.classList.contains('active')) {
                handleRedeemClick(btn.dataset.rewardId);
            }
        });
    }

    // History tabs
    ui.historyTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            ui.historyTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            document.querySelectorAll('.history-panel').forEach(panel => {
                panel.classList.remove('active');
            });

            const panelId = tab.dataset.tab + 'Panel';
            document.getElementById(panelId).classList.add('active');
        });
    });

    // Copy referral code
    if (ui.copyReferralBtn) {
        ui.copyReferralBtn.addEventListener('click', () => {
            const code = ui.referralCode.textContent;
            navigator.clipboard.writeText(code);
            showToast('📋 Đã sao chép mã giới thiệu!', 'success');
        });
    }

    // Modal close
    if (ui.modalClose) {
        ui.modalClose.addEventListener('click', closeModal);
        ui.redemptionModal.addEventListener('click', (e) => {
            if (e.target === ui.redemptionModal) closeModal();
        });
    }

    // Keyboard escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

// ─── Handle Redeem Click ───
function handleRedeemClick(rewardId) {
    const rewards = window.LoyaltySystem?.config?.rewards || [];
    const reward = rewards.find(r => r.id === rewardId);

    if (!reward) return;

    // Show confirmation modal
    ui.redemptionModalBody.innerHTML = `
        <div class="reward-confirm-header">
            <span class="confirm-icon">🎁</span>
            <h2>Xác Nhận Đổi Thưởng</h2>
        </div>

        <div class="reward-confirm-body">
            <div class="confirm-reward-info">
                <h3>${reward.name}</h3>
                <p>${reward.description}</p>
            </div>

            <div class="confirm-points-row">
                <span>Điểm cần thiết:</span>
                <strong class="points-highlight">${formatNumber(reward.points)} points</strong>
            </div>

            <div class="confirm-terms">
                <p><strong>Điều khoản:</strong> ${reward.terms}</p>
                ${reward.expiryDays ? `<p><strong>Hạn sử dụng:</strong> ${reward.expiryDays} ngày</p>` : ''}
            </div>
        </div>

        <div class="confirm-actions">
            <button class="btn-cancel" id="cancelRedeemBtn">Hủy</button>
            <button class="btn-confirm" id="confirmRedeemBtn">✓ Xác Nhận Đổi</button>
        </div>
    `;

    ui.redemptionModal.style.display = 'flex';

    // Setup confirm/cancel handlers
    document.getElementById('cancelRedeemBtn').addEventListener('click', closeModal);
    document.getElementById('confirmRedeemBtn').addEventListener('click', () => {
        confirmRedemption(rewardId);
    });
}

// ─── Confirm Redemption ───
function confirmRedemption(rewardId) {
    const result = redeemReward(rewardId);

    if (result.success) {
        showToast(`🎉 Đã đổi ${result.redemption.rewardName} thành công!`, 'success');
        closeModal();

        // Refresh UI
        renderRewards();
        renderTransactions();
        renderRedemptions();
        renderLoyaltyCard();
    } else {
        showToast(`⚠️ ${result.error}`, 'error');
        closeModal();
    }
}

// ─── Close Modal ───
function closeModal() {
    if (ui.redemptionModal) {
        ui.redemptionModal.style.display = 'none';
    }
}

// ─── Show Toast Notification ───
function showToast(message, type = 'info') {
    if (!ui.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
        <span class="toast-message">${message}</span>
    `;

    ui.toastContainer.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ─── Format Number ───
function formatNumber(num) {
    return new Intl.NumberFormat('vi-VN').format(num);
}

// ─── Format Date ───
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ─── Export for debugging ───
window.LoyaltyUI = {
    refresh: initLoyaltyUI,
    renderRewards,
    renderTransactions,
    renderRedemptions,
    showToast
};
