/**
 * Customer Loyalty Rewards Point System
 * AURA CAFE Café — Chương trình tích điểm thành viên
 */

// ═══════════════════════════════════════════════
//  STORAGE KEYS (localStorage) — nhất quán prefix fnb_
// ═══════════════════════════════════════════════
const _esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

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
//  CUSTOMER TIERS (Hạng thành viên) — synced with loyalty-config.json & DB
// ═══════════════════════════════════════════════
const CUSTOMER_TIERS = {
  DONG: {
    id: 'bronze',
    name: 'Thành viên Đồng',
    icon: 'Bronze',
    minPoints: 0,
    maxPoints: 49,
    benefits: ['Tích 1 điểm / 10.000đ', 'Hoàn tiền 3%', 'Giảm 5% sinh nhật', 'Ưu tiên order'],
    color: '#CD7F32',
    multiplier: 1.0,
    cashbackRate: 0.03,
    birthdayDiscount: 5
  },
  BAC: {
    id: 'silver',
    name: 'Thành viên Bạc',
    icon: 'Silver',
    minPoints: 50,
    maxPoints: 199,
    benefits: ['Tích 1.1 điểm / 10.000đ', 'Hoàn tiền 5%', 'Giảm 10% sinh nhật', 'Free upgrade size', 'Ưu tiên order'],
    color: '#C0C0C0',
    multiplier: 1.1,
    cashbackRate: 0.05,
    birthdayDiscount: 10
  },
  VANG: {
    id: 'gold',
    name: 'Thành viên Vàng',
    icon: 'Gold',
    minPoints: 200,
    maxPoints: 499,
    benefits: ['Tích 1.3 điểm / 10.000đ', 'Hoàn tiền 7%', 'Giảm 15% sinh nhật', 'Free upgrade size không giới hạn', 'Ưu tiên đặt bàn Rooftop'],
    color: '#FFD700',
    multiplier: 1.3,
    cashbackRate: 0.07,
    birthdayDiscount: 15
  },
  BACH_KIM: {
    id: 'platinum',
    name: 'Thành viên Bạch Kim',
    icon: 'Platinum',
    minPoints: 500,
    maxPoints: Infinity,
    benefits: ['Tích 1.5 điểm / 10.000đ', 'Hoàn tiền 10%', 'Giảm 20% sinh nhật', 'Quà tặng hàng tháng', 'Ưu tiên đặt bàn VIP'],
    color: '#E8EEF3',
    multiplier: 1.5,
    cashbackRate: 0.10,
    birthdayDiscount: 20
  }
};

// ═══════════════════════════════════════════════
//  POINTS RULES (Quy tắc tích điểm) — synced with loyalty-config.json & DB
// ═══════════════════════════════════════════════
const POINTS_RULES = {
  BASE_EARN_RATE: 10000, // 10.000đ = 1 point (base rate for Đồng tier)
  REDEMPTION_RATE: 100, // 100 points ≈ 10.000đ (reference value, actual varies by reward)
  BIRTHDAY_BONUS: {
    // Birthday uses % discount from tier config, NOT bonus points
    // Display discount %, not points
    bronze: 5,
    silver: 10,
    gold: 15,
    platinum: 20
  },
  BONUS_ACTIVITIES: {
    first_purchase: 50, // Mua hàng lần đầu
    review: 30, // Viết Google review 5★
    social_share: 20, // Chia sẻ MXH
    referral_referrer: 100, // Giới thiệu bạn bè — người giới thiệu
    referral_referee: 0 // Người được giới thiệu — chỉ nhận WELCOME code
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

  // Earn points from order — synced with backend processOrderLoyalty()
  // Formula: Math.floor(orderTotal / 10000 * multiplier)
  // Đồng ×1.0, Bạc ×1.1, Vàng ×1.3, Bạch Kim ×1.5
  async earnPoints(orderTotal, orderId = null) {
    const currentTier = this.getTier();
    const multiplier = currentTier.multiplier || 1.0;

    // Check for special events
    const today = new Date();
    const dateKey = `${today.getDate()}/${today.getMonth() + 1}`;
    let eventMultiplier = 1;
    if (POINTS_RULES.SPECIAL_EVENTS[dateKey]) {
      eventMultiplier = POINTS_RULES.SPECIAL_EVENTS[dateKey];
    }

    // Calculate points earned (matches backend: Math.floor(total / 10000 * multiplier))
    const pointsEarned = Math.floor(orderTotal / POINTS_RULES.BASE_EARN_RATE * multiplier * eventMultiplier);

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

  // Give birthday discount — returns {discount_percent, description} (no points, per config)
  giveBirthdayBonus() {
    const currentTier = this.getTier();
    const discountPercent = POINTS_RULES.BIRTHDAY_BONUS[currentTier.id] || 10;

    // Birthday is now % discount only (handled server-side at checkout)
    // Return discount info for UI display; no points awarded
    return {
      discountPercent: discountPercent,
      description: 'Giảm ' + discountPercent + '% sinh nhật',
      tier: currentTier.id
    };
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
        message: `Chúc mừng! Bạn đã nâng hạng lên ${newTier.icon} ${newTier.name}!`
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
    return '<div class="tier-max">Max Tier Achieved!</div>';
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
  const typeIcons = { earn: '+', redeem: '-', bonus: 'BONUS' };
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
  const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const API_BASE = IS_LOCAL
    ? ''
    : 'https://aura-space-worker.sadec-marketing-hub.workers.dev';

  // ── Storage keys (add token + server-side customer) ──
  const LS_TOKEN = 'fnb_loyalty_token';
  const LS_CUSTOMER = 'fnb_loyalty_customer';

  const HIST_ICONS = {
    earn: 'EARN', spend: 'SPEND', bonus: 'BONUS', cb_earn: 'CASH',
    purchase: 'BUY', redeem: 'REDEEM', tier_upgrade: 'TIER'
  };
  const HIST_TYPES = { earn: 'earn', spend: 'spend', bonus: 'bonus', cb_earn: 'cb-earn', purchase: 'earn', redeem: 'spend', tier_upgrade: 'bonus' };

  function fmtPts(pts) {
    return (pts > 0 ? '+' : '') + pts + ' pt';
  }

  // ── Tier name mapping (server DB uses bronze/silver/gold/platinum → frontend DONG/BAC/VANG/BACH_KIM) ──
  function tierToObj(tierName) {
    const map = {
      'bronze': CUSTOMER_TIERS.DONG,
      'silver': CUSTOMER_TIERS.BAC,
      'gold': CUSTOMER_TIERS.VANG,
      'platinum': CUSTOMER_TIERS.BACH_KIM
    };
    return map[tierName] || CUSTOMER_TIERS.DONG;
  }

  // ── Render helpers ──

  function renderHistItem(txn) {
    const icon = HIST_ICONS[txn.type] || HIST_ICONS[txn.reason] || 'ITEM';
    const cls = HIST_TYPES[txn.type] || HIST_TYPES[txn.reason] || 'earn';
    const pts = txn.points != null ? txn.points : (txn.points_change || 0);
    const desc = txn.description || txn.reason || txn.type;
    const date = new Date(txn.date || txn.created_at);
    const dateStr = date.toLocaleDateString('vi-VN') + ' \u00B7 ' + date.toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'});
    return '<div class="hist-item">'
      + '<span class="hist-icon">' + icon + '</span>'
      + '<div class="hist-info"><div class="hist-name">' + _esc(desc) + '</div><div class="hist-date">' + _esc(dateStr) + '</div></div>'
      + '<div class="hist-amount ' + cls + '">' + fmtPts(pts) + '</div>'
      + '</div>';
  }

  function renderHist(containerId, txns) {
    const el = document.getElementById(containerId);
    if (!el) {return;}
    if (!txns || txns.length === 0) {
      el.innerHTML = '<p style="text-align:center;color:var(--txt);padding:24px 0;font-size:13px;">Chưa có giao dịch nào</p>';
      return;
    }
    el.innerHTML = txns.map(renderHistItem).join('');
  }

  function renderCbAmount(balance) {
    const el = document.getElementById('cbAmount');
    if (el) {el.textContent = (balance || 0).toLocaleString('vi-VN') + '\u20AB';}
  }

  // ── Build loyalty card HTML (shared template) ──
  function buildCardHTML(tier, name, phone, joined, points, progressPct, nextTierLabel) {
    return '<div style="position:relative;overflow:hidden;border-radius:16px;background:linear-gradient(135deg,' + tier.color + '22,' + tier.color + '08);padding:32px 24px;">'
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
      + '<span>' + nextTierLabel + '</span>'
      + '</div>'
      + '<div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">'
      + '<div style="height:100%;width:' + progressPct + '%;background:linear-gradient(90deg,' + tier.color + ',' + tier.color + '88);border-radius:3px;transition:width 0.5s;"></div>'
      + '</div></div></div></div>';
  }

  // ── Render loyalty card (server data or local fallback) ──
  function renderLoyaltyCard(data) {
    const el = document.getElementById('loyaltyCard');
    if (!el) {return;}

    let tier, name, phone, joined, points, progressPct, nextTierLabel, hideLookup;

    if (data) {
      // Server data path
      tier = tierToObj(data.tier);
      name = data.name || 'Thành viên';
      phone = data.phone || '';
      joined = data.member_since ? new Date(data.member_since).toLocaleDateString('vi-VN') : '';
      points = data.total_points || 0;
      const nextTier = data.next_tier;
      const maxPts = tier.maxPoints === Infinity ? 99999 : tier.maxPoints;
      progressPct = nextTier ? ((points - (tier.minPoints || 0)) / (maxPts - (tier.minPoints || 0))) * 100 : 100;
      progressPct = Math.min(100, Math.max(0, progressPct));
      nextTierLabel = nextTier ? nextTier.tier_name : 'MAX';
      if (nextTier) {
        nextTierLabel = nextTier.tier_name;
        const nextText = '<div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;">Còn ' + (nextTier.min_points - points).toLocaleString('vi-VN') + ' pts để lên ' + nextTier.tier_name + '</div>';
        el.innerHTML = buildCardHTML(tier, name, phone, joined, points, progressPct, nextTierLabel) + nextText;
      } else {
        el.innerHTML = buildCardHTML(tier, name, phone, joined, points, progressPct, 'MAX')
          + '<div style="font-size:0.8rem;color:var(--gold-electric);margin-top:8px;">Hạng cao nhất!</div>';
      }
      hideLookup = true;
    } else {
      // Local fallback path
      const lm = new LoyaltyManager();
      tier = lm.getTier();
      const prog = lm.getNextTierProgress();
      name = lm.customer.name || 'Thành viên';
      phone = lm.customer.phone || '';
      joined = new Date(lm.customer.joinedDate).toLocaleDateString('vi-VN');
      points = lm.customer.points;
      progressPct = Math.min(100, prog.progress);
      nextTierLabel = prog.nextTier ? prog.nextTier.icon + ' ' + prog.nextTier.name : 'MAX';
      if (prog.nextTier) {
        const nextText = '<div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;">Còn ' + prog.pointsNeeded.toLocaleString('vi-VN') + ' pts để lên ' + prog.nextTier.name + '</div>';
        el.innerHTML = buildCardHTML(tier, name, phone, joined, points, progressPct, nextTierLabel) + nextText;
      } else {
        el.innerHTML = buildCardHTML(tier, name, phone, joined, points, progressPct, 'MAX')
          + '<div style="font-size:0.8rem;color:var(--gold-electric);margin-top:8px;">Hạng cao nhất!</div>';
      }
      hideLookup = false;
    }

    // Hide phone lookup when authenticated with server data
    if (hideLookup) {
      const lookupEl = document.getElementById('phoneLookup');
      if (lookupEl) { lookupEl.style.display = 'none'; }
    }
  }

  // ── API helper ──
  function apiFetch(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    return fetch(API_BASE + path, { ...opts, headers }).then(r => r.json());
  }

  // ── Show/hide phone lookup form ──
  function showPhoneLookup() {
    const lookupEl = document.getElementById('phoneLookup');
    if (lookupEl) { lookupEl.style.display = 'block'; }
  }

  // ── Toggle error message ──
  function toggleError(msg) {
    const errEl = document.getElementById('phoneLookupError');
    if (!errEl) {return;}
    if (msg) { errEl.textContent = msg; errEl.style.display = 'block'; }
    else { errEl.style.display = 'none'; }
  }

  // ── Load server data and render ──
  function loadServerData(token) {
    const authHeaders = { headers: { Authorization: 'Bearer ' + token } };
    Promise.all([
      apiFetch('/api/loyalty/summary', authHeaders),
      apiFetch('/api/loyalty/points?limit=20', authHeaders),
      apiFetch('/api/loyalty/cashback?limit=20', authHeaders)
    ])
      .then(function(results) {
        const summary = results[0];
        const pointsData = results[1];
        const cashbackData = results[2];

        if (summary.success) {
          renderLoyaltyCard(summary.data);
          renderCbAmount(summary.data.wallet ? summary.data.wallet.balance : 0);
          loadReferralData(token); // Load referral code after auth
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
      .catch(function() {
        showMockFallback();
      });
  }

  // ── Mock fallback data ──
  const MOCK_TXNS = [
    { type:'earn', points:45, description:'C\u00E0 Ph\u00EA Phin Truy\u1EC1n Th\u1ED1ng \u00D7 2', date: new Date(Date.now()-3600000).toISOString() },
    { type:'earn', points:89, description:'Combo S\u00E1ng', date: new Date(Date.now()-86400000).toISOString() },
    { type:'earn', points:55, description:'B\u1EA1c X\u1EC9u Kem Ph\u00F4 Mai \u00D7 1', date: new Date(Date.now()-2*86400000).toISOString() },
    { type:'spend', points:-100, description:'\u0110\u00E3 d\u00F9ng m\u00E3 GOLD10', date: new Date(Date.now()-3*86400000).toISOString() },
    { type:'earn', points:60, description:'Cold Brew Nitro \u00D7 1', date: new Date(Date.now()-4*86400000).toISOString() },
  ];
  const MOCK_CB = 125000;

  // ── Show mock fallback (no server connection) ──
  function showMockFallback() {
    renderLoyaltyCard();
    renderHist('pointsHistory', MOCK_TXNS);
    renderHist('cbHistory', MOCK_TXNS);
    renderCbAmount(MOCK_CB);
    showPhoneLookup();
  }

  // ── Cashback redeem via API ──
  function redeemCashback() {
    const token = localStorage.getItem(LS_TOKEN);
    if (!token) {
      showPhoneLookup();
      return;
    }
    const cbEl = document.getElementById('cbAmount');
    if (!cbEl) {return;}
    const raw = cbEl.textContent.replace(/[^\d]/g, '');
    const balance = parseInt(raw, 10) || 0;
    if (balance < 10000) {
      alert('Số dư cashback tối thiểu 10.000₫ để đổi.');
      return;
    }

    // Prompt user for amount to redeem (multiples of 10,000₫)
    const input = window.prompt('Nhập số tiền cashback muốn đổi (₫, tối thiểu 10.000, tối đa ' + balance.toLocaleString('vi-VN') + '₫):', '10000');
    if (!input) {return;}
    const amount = parseInt(input.replace(/[^\d]/g, ''), 10);
    if (isNaN(amount) || amount < 10000) {
      alert('Số tiền tối thiểu 10.000₫.');
      return;
    }
    if (amount > balance) {
      alert('Số tiền vượt quá số dư cashback.');
      return;
    }

    // Need an order_id for spend-cashback; generate a placeholder
    const orderId = 'CASHBACK_' + Date.now();
    if (!confirm('Xác nhận đổi ' + amount.toLocaleString('vi-VN') + '₫ cashback?')) {return;}

    apiFetch('/api/loyalty/spend-cashback', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: JSON.stringify({ order_id: orderId, amount: amount })
    }).then(function(data) {
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

  function phoneAuth(phone, referralCode) {
    const body = { phone: phone };
    if (referralCode) { body.referral_code = referralCode; }
    return apiFetch('/api/loyalty/phone-auth', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  // ── Init: check token → load from server or show phone lookup ──
  function initLoyalty() {
    const token = localStorage.getItem(LS_TOKEN);
    const savedPhone = localStorage.getItem(LS_KEYS.LOYALTY_PHONE);

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
          showMockFallback();
          toggleError('Không thể kết nối. Thử lại.');
        }
      }).catch(function() {
        showMockFallback();
      });
    } else {
      // No phone, no token → show mock data + phone lookup
      showMockFallback();
    }
  }

  // ── Phone lookup form handler ──
  function handlePhoneLookup() {
    const input = document.getElementById('loyaltyPhoneInput');
    const btn = document.getElementById('phoneLookupBtn');
    if (!input) {return;}
    const phone = input.value.replace(/\s+/g, '');
    if (!phone || !/^[0-9]{9,15}$/.test(phone)) {
      toggleError('Nhập số điện thoại hợp lệ (9-15 số)');
      return;
    }
    toggleError();
    if (btn) { btn.disabled = true; btn.textContent = 'Đang tra cứu...'; }

    // Read referral code from URL params (?ref=FNB-XXXXXX)
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref') || null;

    phoneAuth(phone, refCode).then(function(r) {
      if (r.success) {
        localStorage.setItem(LS_TOKEN, r.token);
        localStorage.setItem(LS_KEYS.LOYALTY_PHONE, phone);
        localStorage.setItem(LS_KEYS.LOYALTY_CUSTOMER, JSON.stringify(r.customer));
        loadServerData(r.token);
      } else {
        toggleError(r.error || 'Lỗi kết nối, thử lại');
      }
    }).catch(function() {
      toggleError('Không thể kết nối server');
    }).finally(function() {
      if (btn) { btn.disabled = false; btn.textContent = 'Tra Cứu'; }
    });
  }

  // ── Referral: load code + wire share buttons ──
  function loadReferralData(token) {
    apiFetch('/api/loyalty/referral/code', { headers: { Authorization: 'Bearer ' + token } })
      .then(function(r) {
        if (r.success && r.data && r.data.code) {
          setupReferralUI(r.data.code, token);
        }
      })
      .catch(function() { /* referral offline, keep placeholder */ });
  }

  function setupReferralUI(code, token) {
    // Update displayed code
    const codeEl = document.getElementById('referralCodeHero');
    if (codeEl) { codeEl.textContent = code; }

    // Zalo share — copy bài đăng ngắn + mở Zalo
    const zaloBtn = document.getElementById('shareZalo');
    if (zaloBtn) {
      zaloBtn.addEventListener('click', function() {
        const refLink = window.location.origin + '/loyalty.html?ref=' + code;
        const msg = code + ' — Nhập mã này khi đăng ký AURA LOYALTY để nhận ưu đãi đơn đầu!\n\nLink: ' + refLink;
        navigator.clipboard.writeText(msg).then(function() {
          zaloBtn.textContent = 'Đã copy, đang mở Zalo...';
          setTimeout(function() { zaloBtn.textContent = 'Chia sẻ Zalo'; }, 3000);
          window.open('https://chat.zalo.me/', '_blank');
        }).catch(function() {
          window.open('https://chat.zalo.me/', '_blank');
        });
      });
    }

    // Facebook share
    const fbBtn = document.getElementById('shareFacebook');
    if (fbBtn) {
      fbBtn.addEventListener('click', function() {
        const refLink = window.location.origin + '/loyalty.html?ref=' + code;
        const quote = 'Nhập mã ' + code + ' để nhận ưu đãi đơn đầu tiên khi đăng ký AURA LOYALTY!';
        window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(refLink) + '&quote=' + encodeURIComponent(quote), '_blank', 'width=600,height=400');
      });
    }

    // Copy link
    const copyBtn = document.getElementById('shareCopy');
    if (copyBtn) {
      copyBtn.addEventListener('click', function() {
        const refLink = window.location.origin + '/loyalty.html?ref=' + code;
        navigator.clipboard.writeText(refLink).then(function() {
          copyBtn.textContent = 'Đã Copy!';
          setTimeout(function() { copyBtn.textContent = 'Copy Link'; }, 2000);
        }).catch(function() {
          const ta = document.createElement('textarea');
          ta.value = refLink;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          copyBtn.textContent = 'Đã Copy!';
          setTimeout(function() { copyBtn.textContent = 'Copy Link'; }, 2000);
        });
      });
    }

    // ── Pre-composed post templates ──
    setupPostTemplates(code);
  }

  function setupPostTemplates(code) {
    const container = document.getElementById('postTemplates');
    if (!container) { return; }

    const refLink = window.location.origin + '/loyalty.html?ref=' + code;

    // Replace placeholders in template previews
    const previews = container.querySelectorAll('.template-preview');
    previews.forEach(function(el) {
      el.innerHTML = el.innerHTML.replace(/\{code\}/g, '<span class="template-code-placeholder">' + _esc(code) + '</span>');
      el.innerHTML = el.innerHTML.replace(/\{link\}/g, '<span class="template-code-placeholder">' + _esc(refLink) + '</span>');
    });

    // Template text for copy (with actual code + link, no HTML)
    const templateTexts = {
      short: code + ' — Nhập mã này khi đăng ký AURA LOYALTY để nhận ưu đãi đơn đầu tiên!\n\nLink: ' + refLink,
      friendly: 'Bạn ơi!\nTôi vừa tham gia AURA LOYALTY — chương trình tích điểm đổi quà của Aura Space.\n\nDùng mã ' + code + ' khi đăng ký, bạn sẽ được ưu đãi đơn đầu tiên luôn nè!\n\nĐăng ký tại: ' + refLink,
      pro: 'KHÁM PHÁ AURA LOYALTY — ĐẶC QUYỀN THÀNH VIÊN\n\n- Tích điểm mỗi lần ghé Aura Space\n- Đổi quà + cashback không giới hạn\n- Nâng hạng — ưu đãi càng cao\n\nNhập mã ' + code + ' để nhận ưu đãi chào mừng!\n\nĐăng ký tại: ' + refLink,
    };

    // Wire copy buttons
    const buttons = container.querySelectorAll('.btn-copy-template');
    buttons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        const tmpl = this.getAttribute('data-tmpl');
        const text = templateTexts[tmpl] || '';
        if (!text) { return; }

        navigator.clipboard.writeText(text).then(function() {
          btn.textContent = 'Đã Copy!';
          btn.classList.add('copied');
          setTimeout(function() {
            btn.textContent = 'Copy bài đăng';
            btn.classList.remove('copied');
          }, 2000);
        }).catch(function() {
          // Fallback
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          btn.textContent = 'Đã Copy!';
          btn.classList.add('copied');
          setTimeout(function() {
            btn.textContent = 'Copy bài đăng';
            btn.classList.remove('copied');
          }, 2000);
        });
      });
    });

    // Show the section
    container.style.display = 'block';
  }

  // ── Wire events ──
  function setupEvents() {
    const btn = document.getElementById('phoneLookupBtn');
    const input = document.getElementById('loyaltyPhoneInput');
    if (btn) { btn.addEventListener('click', handlePhoneLookup); }
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { handlePhoneLookup(); }
      });
    }
    const redeemBtn = document.getElementById('redeemCashbackBtn');
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
