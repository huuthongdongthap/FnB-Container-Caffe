/**
 * ═══════════════════════════════════════════════
 *  AURA SPACE — Toast Notification System
 *  Reusable toast notifications
 * ═══════════════════════════════════════════════
 */

/**
 * XSS prevention utility - escape HTML special characters
 */
// eslint-disable-next-line no-unused-vars
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Toast notification positions
 */
export const TOAST_POSITIONS = {
  TOP_RIGHT: 'top-right',
  TOP_CENTER: 'top-center',
  BOTTOM_RIGHT: 'bottom-right',
  BOTTOM_CENTER: 'bottom-center'
};

/**
 * Toast types
 */
export const TOAST_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error'
};

/**
 * Toast icons by type
 */
const TOAST_ICONS = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌'
};

/**
 * Default toast config
 */
const DEFAULT_CONFIG = {
  duration: 4000,
  position: TOAST_POSITIONS.BOTTOM_CENTER,
  maxToasts: 5
};

/**
 * Toast container element
 */
let toastContainer = null;
const activeToasts = [];

/**
 * Initialize toast container
 */
function initContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 12px;
            pointer-events: none;
        `;
    document.body.appendChild(toastContainer);
  }
}

/**
 * Create and show toast notification
 * @param {string} message - Toast message
 * @param {object} options - Toast options
 * @returns {HTMLElement} Toast element
 */
export function toast(message, options = {}) {
  const {
    type = TOAST_TYPES.INFO,
    duration = DEFAULT_CONFIG.duration,
    position = DEFAULT_CONFIG.position,
    onClose
  } = options;

  initContainer();

  // Limit max toasts
  if (activeToasts.length >= DEFAULT_CONFIG.maxToasts) {
    const oldest = activeToasts.shift();
    oldest.remove();
  }

  // Create toast element
  const toastEl = document.createElement('div');
  toastEl.className = `toast toast-${type}`;
  toastEl.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 18px;
        background: ${getToastBackground(type)};
        color: #fff;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        min-width: 280px;
        max-width: 400px;
        pointer-events: auto;
        animation: toastSlideIn 0.3s ease-out;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
    `;

  const icon = TOAST_ICONS[type] || TOAST_ICONS.info;

  // Create icon span
  const iconSpan = document.createElement('span');
  iconSpan.style.cssText = 'font-size: 1.2rem;';
  iconSpan.textContent = icon;
  toastEl.appendChild(iconSpan);

  // Create message span (XSS prevention: dùng textContent)
  const messageSpan = document.createElement('span');
  messageSpan.style.cssText = 'flex: 1; font-weight: 500;';
  messageSpan.textContent = message;
  toastEl.appendChild(messageSpan);

  // Create close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.style.cssText = `
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.7);
        cursor: pointer;
        padding: 4px;
        font-size: 1.2rem;
        line-height: 1;
    `;
  closeBtn.innerHTML = '&times;'; // Only safe static HTML
  toastEl.appendChild(closeBtn);

  // Close button handler
  closeBtn.addEventListener('click', () => removeToast(toastEl, onClose));

  // Auto dismiss
  let timeoutId;
  if (duration > 0) {
    timeoutId = setTimeout(() => removeToast(toastEl, onClose), duration);
  }

  // Store toast info
  const toastInfo = { element: toastEl, timeoutId };
  activeToasts.push(toastInfo);

  // Add to container
  toastContainer.appendChild(toastEl);

  // Click to dismiss
  toastEl.addEventListener('click', (e) => {
    if (e.target !== closeBtn) {
      removeToast(toastEl, onClose);
    }
  });

  return toastEl;
}

/**
 * Get toast background by type
 */
function getToastBackground(type) {
  const colors = {
    info: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    success: 'linear-gradient(135deg, #10b981, #059669)',
    warning: 'linear-gradient(135deg, #f59e0b, #d97706)',
    error: 'linear-gradient(135deg, #ef4444, #dc2626)'
  };
  return colors[type] || colors.info;
}

/**
 * Remove toast element
 */
function removeToast(toastEl, onClose) {
  const index = activeToasts.findIndex(t => t.element === toastEl);
  if (index !== -1) {
    clearTimeout(activeToasts[index].timeoutId);
    activeToasts.splice(index, 1);
  }

  toastEl.style.animation = 'toastSlideOut 0.3s ease-in';
  setTimeout(() => {
    toastEl.remove();
    if (onClose) {onClose();}
  }, 300);
}

/**
 * Convenience methods
 */
export const Toast = {
  info: (message, options) => toast(message, { ...options, type: TOAST_TYPES.INFO }),
  success: (message, options) => toast(message, { ...options, type: TOAST_TYPES.SUCCESS }),
  warning: (message, options) => toast(message, { ...options, type: TOAST_TYPES.WARNING }),
  error: (message, options) => toast(message, { ...options, type: TOAST_TYPES.ERROR })
};

/**
 * Inject toast animations CSS
 */
function injectStyles() {
  if (document.getElementById('toast-animations')) {return;}

  const style = document.createElement('style');
  style.id = 'toast-animations';
  style.textContent = `
        @keyframes toastSlideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes toastSlideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }

        @media (max-width: 768px) {
            .toast-container {
                right: 16px;
                left: 16px;
                bottom: 16px;
            }
        }
    `;
  document.head.appendChild(style);
}

// Initialize on load
if (typeof document !== 'undefined') {
  injectStyles();
}
