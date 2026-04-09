/**
 * ═══════════════════════════════════════════════
 *  AURA SPACE — Churn Prevention
 *  Customer Retention & Re-engagement System
 * ═══════════════════════════════════════════════
 *
 * Logic:
 * - Check last visit date from localStorage
 * - > 7 days: Show reminder toast
 * - > 14 days: Show double points banner
 * - Track and update last visit on page load
 */

(function() {
  'use strict';

  // ─── Config ───
  const STORAGE_KEY = 'fnb_last_visit';
  const TOAST_STORAGE_KEY = 'fnb_churn_toast_shown';
  const BANNER_STORAGE_KEY = 'fnb_churn_banner_shown';

  const THRESHOLDS = {
    SEVEN_DAYS: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    FOURTEEN_DAYS: 14 * 24 * 60 * 60 * 1000 // 14 days in ms
  };

  // ─── Helper: Get Days Since Last Visit ───
  function getDaysSinceLastVisit() {
    const lastVisit = localStorage.getItem(STORAGE_KEY);
    if (!lastVisit) {return null;}

    const lastVisitTime = new Date(lastVisit).getTime();
    const now = Date.now();
    const diff = now - lastVisitTime;

    return {
      ms: diff,
      days: Math.floor(diff / (1000 * 60 * 60 * 24))
    };
  }

  // ─── Helper: Update Last Visit ───
  function updateLastVisit() {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  }

  // ─── Helper: Check If Toast Already Shown ───
  function hasShownToast() {
    const shown = localStorage.getItem(TOAST_STORAGE_KEY);
    if (!shown) {return false;}

    // Reset after 24 hours
    const lastShown = parseInt(shown, 10);
    const now = Date.now();
    return (now - lastShown) < 24 * 60 * 60 * 1000;
  }

  // ─── Helper: Check If Banner Already Shown ───
  function hasShownBanner() {
    const shown = localStorage.getItem(BANNER_STORAGE_KEY);
    if (!shown) {return false;}

    // Reset after 24 hours
    const lastShown = parseInt(shown, 10);
    const now = Date.now();
    return (now - lastShown) < 24 * 60 * 60 * 1000;
  }

  // ─── Mark Toast As Shown ───
  function markToastShown() {
    localStorage.setItem(TOAST_STORAGE_KEY, Date.now().toString());
  }

  // ─── Mark Banner As Shown ───
  function markBannerShown() {
    localStorage.setItem(BANNER_STORAGE_KEY, Date.now().toString());
  }

  // ─── Show Toast Notification ───
  function showReminderToast() {
    // Check if toast container exists, create if not
    let toastContainer = document.getElementById('churn-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'churn-toast-container';
      toastContainer.style.cssText = `
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 12px;
                max-width: 90vw;
                width: 400px;
            `;
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = 'churn-toast';
    toast.style.cssText = `
            background: linear-gradient(135deg, #1a1612 0%, #2d2420 100%);
            border: 1px solid #f5b95e;
            border-radius: 12px;
            padding: 16px 20px;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 8px 32px rgba(245, 185, 94, 0.3);
            animation: slideUp 0.3s ease-out;
            cursor: pointer;
            transition: transform 0.2s;
        `;
    toast.onmouseenter = function() { toast.style.transform = 'translateY(-2px)'; };
    toast.onmouseleave = function() { toast.style.transform = 'translateY(0)'; };

    toast.innerHTML = `
            <span style="font-size: 24px;">☕</span>
            <div style="flex: 1;">
                <p style="margin: 0; color: #fff; font-weight: 600; font-size: 14px;">
                    Đã lâu không gặp!
                </p>
                <p style="margin: 4px 0 0; color: #aaa; font-size: 13px;">
                    Ghé AURA SPACE nhận 50 points chào mừng nhé!
                </p>
            </div>
            <button onclick="this.closest('.churn-toast').remove()"
                style="background: none; border: none; color: #666; cursor: pointer; font-size: 18px; padding: 0; line-height: 1;">
                ✕
            </button>
        `;

    // Add animation keyframes
    if (!document.getElementById('churn-toast-styles')) {
      const style = document.createElement('style');
      style.id = 'churn-toast-styles';
      style.textContent = `
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
      document.head.appendChild(style);
    }

    toastContainer.appendChild(toast);

    // Auto dismiss after 8 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, 8000);

    markToastShown();
  }

  // ─── Show Double Points Banner ───
  function showDoublePointsBanner() {
    // Check if banner already exists
    if (document.getElementById('churn-banner')) {return;}

    const banner = document.createElement('div');
    banner.id = 'churn-banner';
    banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #2a0a1a 0%, #4a0e2d 50%, #1a2a0a 100%);
            border-bottom: 2px solid #ff00ff;
            padding: 12px 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
            z-index: 9999;
            box-shadow: 0 4px 24px rgba(255, 0, 255, 0.3);
            animation: bannerPulse 2s infinite;
        `;

    banner.innerHTML = `
            <span style="font-size: 28px; animation: bounce 1s infinite;">🎁</span>
            <div style="text-align: center;">
                <p style="margin: 0; color: #fff; font-weight: 700; font-size: 16px; text-shadow: 0 0 10px rgba(255,255,255,0.5);">
                    ⚡ DOUBLE POINTS WEEKEND ⚡
                </p>
                <p style="margin: 4px 0 0; color: #ffccff; font-size: 13px;">
                    Tích điểm gấp đôi cho mọi hóa đơn — Chỉ đến hết Chủ Nhật!
                </p>
            </div>
            <span style="font-size: 28px; animation: bounce 1s infinite reverse;">🎁</span>
            <button onclick="document.getElementById('churn-banner').remove()"
                style="background: rgba(255,255,255,0.1); border: none; color: #fff; cursor: pointer; font-size: 16px; padding: 4px 12px; border-radius: 6px; margin-left: 16px;">
                ✕
            </button>
        `;

    // Add animation keyframes
    if (!document.getElementById('churn-banner-styles')) {
      const style = document.createElement('style');
      style.id = 'churn-banner-styles';
      style.textContent = `
                @keyframes bannerPulse {
                    0%, 100% { box-shadow: 0 4px 24px rgba(255, 0, 255, 0.3); }
                    50% { box-shadow: 0 4px 32px rgba(255, 0, 255, 0.5); }
                }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-4px); }
                }
            `;
      document.head.appendChild(style);
    }

    document.body.insertBefore(banner, document.body.firstChild);

    // Adjust navbar padding if exists
    const navbar = document.querySelector('.navbar');
    if (navbar) {
      navbar.style.marginTop = '44px';
    }

    markBannerShown();
  }

  // ─── Main: Check And Trigger Churn Prevention ───
  function checkChurn() {
    const timeSinceVisit = getDaysSinceLastVisit();

    // Update last visit time
    updateLastVisit();

    // If no previous visit (first time or cleared), don't show anything
    if (!timeSinceVisit) {
      return;
    }

    // Check thresholds
    if (timeSinceVisit.ms >= THRESHOLDS.FOURTEEN_DAYS) {
      // 14+ days: Show double points banner (more aggressive re-engagement)
      if (!hasShownBanner()) {
        showDoublePointsBanner();
      }
    } else if (timeSinceVisit.ms >= THRESHOLDS.SEVEN_DAYS) {
      // 7+ days: Show reminder toast
      if (!hasShownToast()) {
        showReminderToast();
      }
    }
  }

  // ─── Initialize On Page Load ───
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkChurn);
  } else {
    checkChurn();
  }

  // ─── Public API (for debugging) ───
  window.ChurnPrevention = {
    check: checkChurn,
    getDaysSinceLastVisit,
    forceShowToast: () => {
      markToastShown(); // Reset cooldown
      showReminderToast();
    },
    forceShowBanner: () => {
      markBannerShown(); // Reset cooldown
      showDoublePointsBanner();
    },
    reset: () => {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOAST_STORAGE_KEY);
      localStorage.removeItem(BANNER_STORAGE_KEY);
    }
  };

})();
