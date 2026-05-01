/**
 * Customer Loyalty Rewards Point System
 * AURA CAFE Café — Chương trình tích điểm thành viên
 */

// ═══════════════════════════════════════════════
//  STORAGE KEYS (localStorage) — nhất quán prefix fnb_
// ═══════════════════════════════════════════════
const LS_KEYS = {
  CUSTOMER_ID: 'fnb_customer_id',
  LOYALTY_CUSTOMER: 'fnb_loyalty_customer',
  LOYALTY_HISTORY: 'fnb_loyalty_history',
  LOYALTY_PHONE: 'fnb_loyalty_phone',
};

// One-time migration: legacy 'loyalty_phone' → 'fnb_loyalty_phone'
(function migrateLegacyKeys() {
  try {
    const legacy = localStorage.getItem('loyalty_phone');
    if (legacy && !localStorage.getItem(LS_KEYS.LOYALTY_PHONE)) {
      localStorage.setItem(LS_KEYS.LOYALTY_PHONE, legacy);
    }
    if (legacy) {localStorage.removeItem('loyalty_phone');}
  } catch (_e) { /* ignore quota/disabled storage */ }
})();

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
    let id = localStorage.getItem(LS_KEYS.CUSTOMER_ID);
    if (!id) {
      id = 'CUST' + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase();
      localStorage.setItem(LS_KEYS.CUSTOMER_ID, id);
    }
    return id;
  }

  _loadCustomer() {
    const saved = localStorage.getItem(LS_KEYS.LOYALTY_CUSTOMER);
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
    localStorage.setItem(LS_KEYS.LOYALTY_CUSTOMER, JSON.stringify(this.customer));
  }

  _loadHistory() {
    const saved = localStorage.getItem(LS_KEYS.LOYALTY_HISTORY);
    return saved ? JSON.parse(saved) : [];
  }

  _saveHistory() {
    localStorage.setItem(LS_KEYS.LOYALTY_HISTORY, JSON.stringify(this.transactionHistory));
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
    if (!this.customer.birthday) {return false;}
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

// ═══════════════════════════════════════════════
//  DYNAMIC LOYALITY RENDER (Phase 8)
// ═══════════════════════════════════════════════

(function() {
  const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const API_BASE = IS_LOCAL
    ? 'http://127.0.0.1:8787'
    : 'https://aura-space-worker.sadec-marketing-hub.workers.dev';

  // ── Storage keys (add token + server-side customer) ──
  const LS_TOKEN = 'fnb_loyalty_token';
  const LS_CUSTOMER = 'fnb_loyalty_customer';

  const HIST_ICONS = {
    earn: '\u2615', spend: '\uD83C\uDFAB', bonus: '\uD83C\uDF81', cb_earn: '\uD83D\uDCB0',
    purchase: '\u2615', redeem: '\uD83C\uDF81', tier_upgrade: '\uD83C\uDFC6'
  };
  const HIST_TYPES = { earn: 'earn', spend: 'spend', bonus: 'bonus', cb_earn: 'cb-earn', purchase: 'earn', redeem: 'spend', tier_upgrade: 'bonus' };

  function fmtPts(pts) {
    return (pts > 0 ? '+' : '') + pts + ' \u2605';
  }

  // ── Tier name mapping (server uses silver/gold/platinum) ──
  function tierToObj(tierName) {
    var map = {
      'silver': CUSTOMER_TIERS.DONG,
      'gold': CUSTOMER_TIERS.VANG,
      'platinum': CUSTOMER_TIERS.KIM_CUONG
    };
    return map[tierName] || CUSTOMER_TIERS.DONG;
  }

  // ── Render helpers ──

  function renderHistItem(txn) {
    var icon = HIST_ICONS[txn.type] || HIST_ICONS[txn.reason] || '\u2615';
    var cls = HIST_TYPES[txn.type] || HIST_TYPES[txn.reason] || 'earn';
    var pts = txn.points != null ? txn.points : (txn.points_change || 0);
    var desc = txn.description || txn.reason || txn.type;
    var date = new Date(txn.date || txn.created_at);
    var dateStr = date.toLocaleDateString('vi-VN') + ' \u00B7 ' + date.toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'});
    return '<div class="hist-item">'
      + '<span class="hist-icon">' + icon + '</span>'
      + '<div class="hist-info"><div class="hist-name">' + desc + '</div><div class="hist-date">' + dateStr + '</div></div>'
      + '<div class="hist-amount ' + cls + '">' + fmtPts(pts) + '</div>'
      + '</div>';
  }

  function renderHist(containerId, txns) {
    var el = document.getElementById(containerId);
    if (!el) {return;}
    if (!txns || txns.length === 0) {
      el.innerHTML = '<p style="text-align:center;color:var(--txt);padding:24px 0;font-size:13px;">Chưa có giao dịch nào</p>';
      return;
    }
    el.innerHTML = txns.map(renderHistItem).join('');
  }

  function renderCbAmount(balance) {
    var el = document.getElementById('cbAmount');
    if (el) {el.textContent = (balance || 0).toLocaleString('vi-VN') + '\u20AB';}
  }

  // ── Render loyalty card from server data ──
  function renderLoyaltyCardFromData(data) {
    var el = document.getElementById('loyaltyCard');
    if (!el) {return;}
    var tier = tierToObj(data.tier);
    var name = data.name || 'Thành viên';
    var phone = data.phone || '';
    var joined = data.member_since ? new Date(data.member_since).toLocaleDateString('vi-VN') : '';
    var points = data.total_points || 0;
    var nextTier = data.next_tier;
    var progress = nextTier ? ((points - (tier.minPoints || 0)) / ((tier.maxPoints === Infinity ? 99999 : tier.maxPoints) - (tier.minPoints || 0))) * 100 : 100;
    progress = Math.min(100, Math.max(0, progress));

    var nextTierText = '';
    if (nextTier) {
      nextTierText = '<div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;">Còn ' + (nextTier.min_points - points).toLocaleString('vi-VN') + ' pts để lên ' + nextTier.tier_name + '</div>';
    } else {
      nextTierText = '<div style="font-size:0.8rem;color:var(--gold-electric);margin-top:8px;">🏆 Hạng cao nhất!</div>';
    }

    el.innerHTML = '<div style="position:relative;overflow:hidden;border-radius:16px;background:linear-gradient(135deg,' + tier.color + '22,' + tier.color + '08);padding:32px 24px;">'
      + '<div style="position:absolute;top:-20px;right:-20px;width:120px;height:120px;border-radius:50%;background:' + tier.color + '15;filter:blur(30px);"></div>'
      + '<div style="position:relative;z-index:1;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">'
      + '<div style="display:flex;align-items:center;gap:8px;">'
      + '<span style="font-size:1.5rem;">' + tier.icon + '</span>'
      + '<span style="font-size:0.85rem;font-weight:600;color:' + tier.color + ';letter-spacing:1px;">' + tier.name + '</span>'
      + '</div>'
      + '<span style="font-size:0.75rem;color:var(--text-muted);">Tham gia: ' + joined + '</span>'
      + '</div>'
      + '<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px;">' + name + (phone ? ' · ' + phone : '') + '</div>'
      + '<div style="text-align:center;margin-bottom:20px;">'
      + '<div style="font-size:2.5rem;font-weight:700;color:var(--gold-electric);">' + points.toLocaleString('vi-VN') + '</div>'
      + '<div style="font-size:0.85rem;color:var(--text-muted);">points</div>'
      + '</div>'
      + '<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px;margin-bottom:8px;">'
      + '<div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-muted);margin-bottom:6px;">'
      + '<span>' + tier.icon + ' ' + tier.name + '</span>'
      + '<span>' + (nextTier ? nextTier.tier_name : 'MAX') + '</span>'
      + '</div>'
      + '<div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">'
      + '<div style="height:100%;width:' + progress + '%;background:linear-gradient(90deg,' + tier.color + ',' + tier.color + '88);border-radius:3px;transition:width 0.5s;"></div>'
      + '</div></div>' + nextTierText + '</div></div>';

    // Show phone lookup section if not yet authenticated
    var lookupEl = document.getElementById('phoneLookup');
    if (lookupEl) { lookupEl.style.display = 'none'; }
  }

  // ── Render loyalty card from local data (fallback) ──
  function renderLoyaltyCard() {
    var lm = new LoyaltyManager();
    var tier = lm.getTier();
    var progress = lm.getNextTierProgress();
    var name = lm.customer.name || 'Thành viên';
    var phone = lm.customer.phone || '';
    var joined = new Date(lm.customer.joinedDate).toLocaleDateString('vi-VN');

    var nextTierText = '';
    if (progress.nextTier) {
      nextTierText = '<div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;">Còn ' + progress.pointsNeeded.toLocaleString('vi-VN') + ' pts để lên ' + progress.nextTier.icon + ' ' + progress.nextTier.name + '</div>';
    } else {
      nextTierText = '<div style="font-size:0.8rem;color:var(--gold-electric);margin-top:8px;">🏆 Hạng cao nhất!</div>';
    }

    var el = document.getElementById('loyaltyCard');
    if (!el) {return;}
    el.innerHTML = '<div style="position:relative;overflow:hidden;border-radius:16px;background:linear-gradient(135deg,' + tier.color + '22,' + tier.color + '08);padding:32px 24px;">'
      + '<div style="position:absolute;top:-20px;right:-20px;width:120px;height:120px;border-radius:50%;background:' + tier.color + '15;filter:blur(30px);"></div>'
      + '<div style="position:relative;z-index:1;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">'
      + '<div style="display:flex;align-items:center;gap:8px;">'
      + '<span style="font-size:1.5rem;">' + tier.icon + '</span>'
      + '<span style="font-size:0.85rem;font-weight:600;color:' + tier.color + ';letter-spacing:1px;">' + tier.name + '</span>'
      + '</div>'
      + '<span style="font-size:0.75rem;color:var(--text-muted);">Tham gia: ' + joined + '</span>'
      + '</div>'
      + '<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px;">' + name + (phone ? ' · ' + phone : '') + '</div>'
      + '<div style="text-align:center;margin-bottom:20px;">'
      + '<div style="font-size:2.5rem;font-weight:700;color:var(--gold-electric);">' + lm.customer.points.toLocaleString('vi-VN') + '</div>'
      + '<div style="font-size:0.85rem;color:var(--text-muted);">points</div>'
      + '</div>'
      + '<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px;margin-bottom:8px;">'
      + '<div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-muted);margin-bottom:6px;">'
      + '<span>' + tier.icon + ' ' + tier.name + '</span>'
      + '<span>' + (progress.nextTier ? progress.nextTier.icon + ' ' + progress.nextTier.name : 'MAX') + '</span>'
      + '</div>'
      + '<div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">'
      + '<div style="height:100%;width:' + Math.min(100, progress.progress) + '%;background:linear-gradient(90deg,' + tier.color + ',' + tier.color + '88);border-radius:3px;transition:width 0.5s;"></div>'
      + '</div></div>' + nextTierText + '</div></div>';
  }

  // ── Phone Auth: call /api/loyalty/phone-auth ──
  function phoneAuth(phone) {
    return fetch(API_BASE + '/api/loyalty/phone-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone })
    }).then(function(r) { return r.json(); });
  }

  // ── Fetch loyalty summary from server ──
  function fetchSummary(token) {
    return fetch(API_BASE + '/api/loyalty/summary', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(function(r) { return r.json(); });
  }

  // ── Fetch point logs from server ──
  function fetchPoints(token) {
    return fetch(API_BASE + '/api/loyalty/points?limit=20', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(function(r) { return r.json(); });
  }

  // ── Fetch cashback history from server ──
  function fetchCashback(token) {
    return fetch(API_BASE + '/api/loyalty/cashback?limit=20', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(function(r) { return r.json(); });
  }

  // ── Show error on phone lookup form ──
  function showLookupError(msg) {
    var errEl = document.getElementById('phoneLookupError');
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  }
  function hideLookupError() {
    var errEl = document.getElementById('phoneLookupError');
    if (errEl) { errEl.style.display = 'none'; }
  }

  // ── Show/hide phone lookup form ──
  function showPhoneLookup() {
    var lookupEl = document.getElementById('phoneLookup');
    if (lookupEl) { lookupEl.style.display = 'block'; }
  }

  // ── Load server data and render ──
  function loadServerData(token) {
    Promise.all([fetchSummary(token), fetchPoints(token), fetchCashback(token)])
      .then(function(results) {
        var summary = results[0];
        var pointsData = results[1];
        var cashbackData = results[2];

        if (summary.success) {
          renderLoyaltyCardFromData(summary.data);
          renderCbAmount(summary.data.wallet ? summary.data.wallet.balance : 0);
        }

        if (pointsData.success) {
          renderHist('pointsHistory', pointsData.data);
        }

        if (cashbackData.success && cashbackData.data && cashbackData.data.length > 0) {
          renderHist('cbHistory', cashbackData.data);
        } else {
          // If no cashback history, use points history as fallback
          if (pointsData.success) {
            renderHist('cbHistory', pointsData.data);
          }
        }
      })
      .catch(function(err) {
        console.warn('[Loyalty] API error, falling back to local:', err);
        renderLoyaltyCard();
        renderHist('pointsHistory', MOCK_TXNS);
        renderHist('cbHistory', MOCK_TXNS);
        renderCbAmount(MOCK_CB);
        showPhoneLookup();
      });
  }

  // ── Mock fallback data ──
  var MOCK_TXNS = [
    { type:'earn', points:45, description:'C\u00E0 Ph\u00EA Phin Truy\u1EC1n Th\u1ED1ng \u00D7 2', date: new Date(Date.now()-3600000).toISOString() },
    { type:'earn', points:89, description:'Combo S\u00E1ng', date: new Date(Date.now()-86400000).toISOString() },
    { type:'earn', points:55, description:'B\u1EA1c X\u1EC9u Kem Ph\u00F4 Mai \u00D7 1', date: new Date(Date.now()-2*86400000).toISOString() },
    { type:'spend', points:-100, description:'\u0110\u00E3 d\u00F9ng m\u00E3 GOLD10', date: new Date(Date.now()-3*86400000).toISOString() },
    { type:'earn', points:60, description:'Cold Brew Nitro \u00D7 1', date: new Date(Date.now()-4*86400000).toISOString() },
  ];
  var MOCK_CB = 125000;

  // ── Cashback redeem via API ──
  function redeemCashback() {
    var token = localStorage.getItem(LS_TOKEN);
    if (!token) {
      showPhoneLookup();
      return;
    }
    var cbEl = document.getElementById('cbAmount');
    if (!cbEl) {return;}
    var raw = cbEl.textContent.replace(/[^\d]/g, '');
    var balance = parseInt(raw, 10) || 0;
    if (balance < 10000) {
      alert('Số dư cashback tối thiểu 10.000₫ để đổi.');
      return;
    }

    // Prompt user for amount to redeem (multiples of 10,000₫)
    var input = prompt('Nhập số tiền cashback muốn đổi (₫, tối thiểu 10.000, tối đa ' + balance.toLocaleString('vi-VN') + '₫):', '10000');
    if (!input) {return;}
    var amount = parseInt(input.replace(/[^\d]/g, ''), 10);
    if (isNaN(amount) || amount < 10000) {
      alert('Số tiền tối thiểu 10.000₫.');
      return;
    }
    if (amount > balance) {
      alert('Số tiền vượt quá số dư cashback.');
      return;
    }

    // Need an order_id for spend-cashback; generate a placeholder
    var orderId = 'CASHBACK_' + Date.now();
    if (!confirm('Xác nhận đổi ' + amount.toLocaleString('vi-VN') + '₫ cashback?')) {return;}

    fetch(API_BASE + '/api/loyalty/spend-cashback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ order_id: orderId, amount: amount })
    }).then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success) {
        alert('Đổi thành công! Đã trừ ' + amount.toLocaleString('vi-VN') + '₫ từ cashback.');
        // Reload all loyalty data
        loadServerData(token);
      } else {
        alert(data.error || 'Đổi cashback thất bại.');
      }
    })
    .catch(function() {
      alert('Không thể kết nối server. Thử lại sau.');
    });
  }

  // ── Init: check token → load from server or show phone lookup ──
  function initLoyalty() {
    var token = localStorage.getItem(LS_TOKEN);
    var savedPhone = localStorage.getItem(LS_KEYS.LOYALTY_PHONE);

    if (token) {
      // Try server data with existing token
      loadServerData(token);
    } else if (savedPhone) {
      // Have phone, no token → authenticate
      phoneAuth(savedPhone).then(function(r) {
        if (r.success) {
          localStorage.setItem(LS_TOKEN, r.token);
          localStorage.setItem(LS_KEYS.LOYALTY_CUSTOMER, JSON.stringify(r.customer));
          loadServerData(r.token);
        } else {
          // Phone auth failed, show mock + lookup form
          renderLoyaltyCard();
          renderHist('pointsHistory', MOCK_TXNS);
          renderHist('cbHistory', MOCK_TXNS);
          renderCbAmount(MOCK_CB);
          showPhoneLookup();
          showLookupError('Không thể kết nối. Thử lại.');
        }
      }).catch(function() {
        renderLoyaltyCard();
        renderHist('pointsHistory', MOCK_TXNS);
        renderHist('cbHistory', MOCK_TXNS);
        renderCbAmount(MOCK_CB);
        showPhoneLookup();
      });
    } else {
      // No phone, no token → show mock data + phone lookup
      renderLoyaltyCard();
      renderHist('pointsHistory', MOCK_TXNS);
      renderHist('cbHistory', MOCK_TXNS);
      renderCbAmount(MOCK_CB);
      showPhoneLookup();
    }
  }

  // ── Phone lookup form handler ──
  function handlePhoneLookup() {
    var input = document.getElementById('loyaltyPhoneInput');
    var btn = document.getElementById('phoneLookupBtn');
    if (!input) {return;}
    var phone = input.value.replace(/\s+/g, '');
    if (!phone || !/^[0-9]{9,15}$/.test(phone)) {
      showLookupError('Nhập số điện thoại hợp lệ (9-15 số)');
      return;
    }
    hideLookupError();
    if (btn) { btn.disabled = true; btn.textContent = 'Đang tra cứu...'; }

    phoneAuth(phone).then(function(r) {
      if (r.success) {
        localStorage.setItem(LS_TOKEN, r.token);
        localStorage.setItem(LS_KEYS.LOYALTY_PHONE, phone);
        localStorage.setItem(LS_KEYS.LOYALTY_CUSTOMER, JSON.stringify(r.customer));
        loadServerData(r.token);
      } else {
        showLookupError(r.error || 'Lỗi kết nối, thử lại');
      }
    }).catch(function() {
      showLookupError('Không thể kết nối server');
    }).finally(function() {
      if (btn) { btn.disabled = false; btn.textContent = 'Tra Cứu'; }
    });
  }

  // ── Wire events ──
  function setupEvents() {
    var btn = document.getElementById('phoneLookupBtn');
    var input = document.getElementById('loyaltyPhoneInput');
    if (btn) { btn.addEventListener('click', handlePhoneLookup); }
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { handlePhoneLookup(); }
      });
    }
    var redeemBtn = document.getElementById('redeemCashbackBtn');
    if (redeemBtn) { redeemBtn.addEventListener('click', redeemCashback); }
  }

  // ── Boot ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { initLoyalty(); setupEvents(); });
  } else {
    initLoyalty();
    setupEvents();
  }
})();
