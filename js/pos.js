/**
 * POS Loyalty Wallet Module
 * Renders member wallet panel after phone lookup for staff
 */

const _IS_LOCAL = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const LOYALTY_API = _IS_LOCAL
  ? 'http://127.0.0.1:8787/api/loyalty'
  : 'https://aura-space-worker.sadec-marketing-hub.workers.dev/api/loyalty';

const TIER_VI = { bronze: 'Đồng', silver: 'Bạc', gold: 'Vàng', platinum: 'Bạch Kim' };
const TIER_COLOR = { bronze: '#A5703F', silver: '#9CA8B5', gold: '#D4AF37', platinum: '#E8EEF3' };

function formatVND(n) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n || 0)) + '₫';
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function memberId(id) {
  return 'AC' + String(id || '').slice(-6).toUpperCase();
}

export function renderMemberWallet(member) {
  const mid = memberId(member.id);
  const tierVi = TIER_VI[member.loyalty_tier] || 'Đồng';
  const tierColor = TIER_COLOR[member.loyalty_tier] || TIER_COLOR.bronze;
  const expiringSoon = (member.expiring_within_7d || 0) > 0;

  const progressHtml = member.tier_progress ? `
    <div class="wallet-tier-progress">
      <div class="progress-label">Còn ${formatVND(member.tier_progress.to_next)} để lên <b>${esc(member.tier_progress.next_tier_vi)}</b></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${member.tier_progress.percent}%"></div></div>
    </div>` : '';

  const expiryHtml = expiringSoon ? `
    <div class="wallet-expiry-warning">
      &#9888; ${formatVND(member.expiring_amount)} sắp hết hạn trong 7 ngày — nên dùng hôm nay
    </div>` : '';

  return `
    <div class="member-wallet-panel${expiringSoon ? ' has-warning' : ''}">
      <div class="wallet-header">
        <div class="wallet-member-id">${esc(mid)}</div>
        <div class="wallet-tier-badge" style="color:${tierColor}">${esc(tierVi)}</div>
      </div>
      <div class="wallet-name-row">
        <span class="wallet-greeting">Xin chào,</span>
        <span class="wallet-name">${esc(member.name || 'Khách')}</span>
      </div>
      <div class="wallet-balance-block">
        <div class="wallet-balance-label">Ví Cashback</div>
        <div class="wallet-balance-amount">${formatVND(member.cashback_balance_vnd)}</div>
        <div class="wallet-balance-hint">Dùng tối đa 50% bill · Min 30.000đ</div>
      </div>
      ${expiryHtml}
      <div class="wallet-stats">
        <div class="wallet-stat">
          <span class="stat-label">Cashback đã nhận</span>
          <span class="stat-value">${formatVND(member.lifetime_cashback)}</span>
        </div>
        <div class="wallet-stat">
          <span class="stat-label">Điểm tích lũy</span>
          <span class="stat-value">${(member.loyalty_points || 0).toLocaleString('vi-VN')} pts</span>
        </div>
      </div>
      ${progressHtml}
    </div>`;
}

export async function lookupMember(phone) {
  const r = await fetch(`${LOYALTY_API}/lookup?phone=${encodeURIComponent(phone)}`);
  const d = await r.json();
  if (!d.ok) {throw new Error(d.error || 'Không tìm thấy thành viên');}
  return d.member;
}
