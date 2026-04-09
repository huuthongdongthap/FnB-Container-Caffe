/**
 * ═══════════════════════════════════════════════
 *  AURA SPACE — Authentication Module
 *  Cloudflare KV Auth with JWT Tokens
 * ═══════════════════════════════════════════════
 *
 * Usage:
 *   import { auth } from '/js/auth.js';
 *
 *   // Register
 *   const result = await auth.register('user@example.com', 'password123', 'Nguyen Van A', '0901234567');
 *
 *   // Login
 *   const result = await auth.login('user@example.com', 'password123');
 *
 *   // Logout
 *   await auth.logout();
 *
 *   // Get current user
 *   const user = await auth.getCurrentUser();
 *
 *   // Check if logged in
 *   if (auth.isLoggedIn()) { ... }
 */

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8787' // Worker local dev
  : 'https://aura-space-sadec-worker.your-worker.subdomain.workers.dev'; // Production

// Debug logging configuration
const DEBUG = typeof AURA_DEBUG !== 'undefined' && AURA_DEBUG;

/**
 * Authentication API Client
 */
export const auth = {
  /**
   * Register new user
   * @param {string} email
   * @param {string} password
   * @param {string} name
   * @param {string} phone
   * @returns {Promise<{success: boolean, user?: object, token?: string, message?: string, error?: string}>}
   */
  async register(email, password, name = '', phone = '') {
    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name, phone }),
      });

      const data = await response.json();

      if (data.success) {
        // Store token and user info
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
        }
        if (data.user) {
          localStorage.setItem('auth_user', JSON.stringify(data.user));
        }
      }

      return data;
    } catch (error) {
      if (DEBUG) {console.error('Register error:', error);}
      return {
        success: false,
        error: 'Lỗi kết nối server: ' + error.message,
      };
    }
  },

  /**
   * Login user
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{success: boolean, user?: object, token?: string, message?: string, error?: string}>}
   */
  async login(email, password) {
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        // Store token and user info
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
        }
        if (data.user) {
          localStorage.setItem('auth_user', JSON.stringify(data.user));
        }
      }

      return data;
    } catch (error) {
      if (DEBUG) {console.error('Login error:', error);}
      return {
        success: false,
        error: 'Lỗi kết nối server: ' + error.message,
      };
    }
  },

  /**
   * Logout user (invalidate token)
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
  async logout() {
    try {
      const token = localStorage.getItem('auth_token');

      if (!token) {
        // No token, just clear local data
        this.clearLocalData();
        return { success: true, message: 'Đăng xuất thành công' };
      }

      const response = await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      // Always clear local data
      this.clearLocalData();

      return data;
    } catch (error) {
      if (DEBUG) {console.error('Logout error:', error);}
      // Still clear local data even if server call fails
      this.clearLocalData();
      return {
        success: false,
        error: 'Lỗi kết nối server: ' + error.message,
      };
    }
  },

  /**
   * Get current user info
   * @returns {Promise<{success: boolean, user?: object, error?: string}>}
   */
  async getCurrentUser() {
    try {
      const token = localStorage.getItem('auth_token');

      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${API_BASE}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      if (DEBUG) {console.error('GetUser error:', error);}
      return {
        success: false,
        error: 'Lỗi kết nối server: ' + error.message,
      };
    }
  },

  /**
   * Check if user is logged in
   * @returns {boolean}
   */
  isLoggedIn() {
    return !!localStorage.getItem('auth_token');
  },

  /**
   * Get stored user info (from localStorage, no API call)
   * @returns {object|null}
   */
  getStoredUser() {
    const userStr = localStorage.getItem('auth_user');
    if (!userStr) {return null;}
    try {
      return JSON.parse(userStr);
    } catch (e) {
      return null;
    }
  },

  /**
   * Get stored token (from localStorage)
   * @returns {string|null}
   */
  getStoredToken() {
    return localStorage.getItem('auth_token');
  },

  /**
   * Clear all local auth data
   * @private
   */
  clearLocalData() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  },

  /**
   * Initialize auth state on page load
   * Call this on DOMContentLoaded to restore auth state
   */
  init() {
    // Verify token is still valid on page load
    if (this.isLoggedIn()) {
      this.getCurrentUser().then(data => {
        if (!data.success) {
          // Token invalid, clear local data
          this.clearLocalData();
        } else {
          // Update stored user info
          if (data.user) {
            localStorage.setItem('auth_user', JSON.stringify(data.user));
          }
        }
      }).catch(() => {
        this.clearLocalData();
      });
    }
  },
};

/**
 * Auto-fill form fields if user is logged in
 * @param {HTMLInputElement} nameInput
 * @param {HTMLInputElement} phoneInput
 */
export async function autoFillLoggedInUser(nameInput, phoneInput) {
  if (!auth.isLoggedIn()) {return;}

  const user = auth.getStoredUser();
  if (user) {
    if (nameInput && user.name) {
      nameInput.value = user.name;
    }
    if (phoneInput && user.phone) {
      phoneInput.value = user.phone;
    }
  } else {
    // Fetch from server
    const data = await auth.getCurrentUser();
    if (data.success && data.user) {
      if (nameInput && data.user.name) {
        nameInput.value = data.user.name;
      }
      if (phoneInput && data.user.phone) {
        phoneInput.value = data.user.phone;
      }
      // Update stored user
      localStorage.setItem('auth_user', JSON.stringify(data.user));
    }
  }
}

/**
 * Show login modal
 * @param {string} [mode='login'] - 'login' or 'register'
 */
export function showLoginModal(mode = 'login') {
  const existingModal = document.querySelector('.auth-modal-overlay');
  if (existingModal) {
    existingModal.remove();
  }

  const overlay = document.createElement('div');
  overlay.className = 'auth-modal-overlay';
  overlay.innerHTML = `
    <div class="auth-modal">
      <div class="auth-modal-header">
        <h2 id="authModalTitle">${mode === 'login' ? 'Đăng Nhập' : 'Đăng Ký'}</h2>
        <button class="auth-modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="auth-modal-body">
        <form id="authForm" novalidate>
          ${mode === 'register' ? `
            <div class="auth-form-group">
              <label for="authName">Họ và tên</label>
              <input type="text" id="authName" name="name" placeholder="Nguyễn Văn A" />
            </div>
          ` : ''}
          <div class="auth-form-group">
            <label for="authEmail">Email</label>
            <input type="email" id="authEmail" name="email" placeholder="ban@example.com" required />
          </div>
          ${mode === 'register' ? `
            <div class="auth-form-group">
              <label for="authPhone">Số điện thoại</label>
              <input type="tel" id="authPhone" name="phone" placeholder="0901234567" />
            </div>
          ` : ''}
          <div class="auth-form-group">
            <label for="authPassword">Mật khẩu</label>
            <input type="password" id="authPassword" name="password" placeholder="••••••••" minlength="6" required />
          </div>
          <div id="authError" class="auth-error" style="display: none;"></div>
          <button type="submit" class="auth-submit-btn">
            ${mode === 'login' ? 'Đăng Nhập' : 'Đăng Ký'}
          </button>
        </form>
        <div class="auth-modal-footer">
          ${mode === 'login'
    ? 'Chưa có tài khoản? <a href="#" id="showRegister">Đăng ký ngay</a>'
    : 'Đã có tài khoản? <a href="#" id="showLogin">Đăng nhập</a>'
}
        </div>
      </div>
    </div>
  `;

  // Styles
  const style = document.createElement('style');
  style.textContent = `
    .auth-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      animation: fadeIn 0.2s ease-out;
    }
    .auth-modal {
      background: white;
      border-radius: 16px;
      width: 90%;
      max-width: 420px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      animation: slideUp 0.3s ease-out;
    }
    .auth-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #e0e0e0;
    }
    .auth-modal-header h2 {
      margin: 0;
      font-size: 20px;
      color: #1B5E3B;
    }
    .auth-modal-close {
      background: none;
      border: none;
      font-size: 28px;
      cursor: pointer;
      color: #666;
      padding: 0;
      line-height: 1;
    }
    .auth-modal-close:hover {
      color: #333;
    }
    .auth-modal-body {
      padding: 24px;
    }
    .auth-form-group {
      margin-bottom: 16px;
    }
    .auth-form-group label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      color: #333;
    }
    .auth-form-group input {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 15px;
      box-sizing: border-box;
    }
    .auth-form-group input:focus {
      outline: none;
      border-color: #1B5E3B;
      box-shadow: 0 0 0 3px rgba(27, 94, 59, 0.1);
    }
    .auth-error {
      background: #ffebee;
      color: #c62828;
      padding: 10px 12px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 14px;
    }
    .auth-submit-btn {
      width: 100%;
      padding: 14px;
      background: #1B5E3B;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .auth-submit-btn:hover {
      background: #144a2e;
    }
    .auth-modal-footer {
      margin-top: 20px;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
    .auth-modal-footer a {
      color: #1B5E3B;
      text-decoration: none;
      font-weight: 500;
    }
    .auth-modal-footer a:hover {
      text-decoration: underline;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(overlay);

  // Close on X button or overlay click
  const closeBtn = overlay.querySelector('.auth-modal-close');
  closeBtn.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });

  // Form submission
  const form = overlay.querySelector('#authForm');
  const errorDiv = overlay.querySelector('#authError');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.style.display = 'none';

    const email = overlay.querySelector('#authEmail').value.trim();
    const password = overlay.querySelector('#authPassword').value;
    const name = overlay.querySelector('#authName')?.value.trim() || '';
    const phone = overlay.querySelector('#authPhone')?.value.trim() || '';

    // Validation
    if (!email || !password) {
      errorDiv.textContent = 'Vui lòng nhập email và mật khẩu';
      errorDiv.style.display = 'block';
      return;
    }

    if (password.length < 6) {
      errorDiv.textContent = 'Mật khẩu phải có ít nhất 6 ký tự';
      errorDiv.style.display = 'block';
      return;
    }

    const submitBtn = overlay.querySelector('.auth-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang xử lý...';

    try {
      let result;
      if (mode === 'login') {
        result = await auth.login(email, password);
      } else {
        result = await auth.register(email, password, name, phone);
      }

      if (result.success) {
        overlay.remove();
        // Show success message
        if (window.showToast) {
          showToast(result.message || (mode === 'login' ? 'Đăng nhập thành công' : 'Đăng ký thành công'), 'success');
        }
        // Trigger auth change event
        window.dispatchEvent(new CustomEvent('auth-change', { detail: { user: result.user, isLoggedIn: true } }));
        // Auto-fill checkout form if on checkout page
        autoFillCheckoutForm();
      } else {
        errorDiv.textContent = result.error || 'Có lỗi xảy ra';
        errorDiv.style.display = 'block';
      }
    } catch (error) {
      errorDiv.textContent = 'Lỗi kết nối: ' + error.message;
      errorDiv.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = mode === 'login' ? 'Đăng Nhập' : 'Đăng Ký';
    }
  });

  // Toggle login/register
  const showRegister = overlay.querySelector('#showRegister');
  const showLogin = overlay.querySelector('#showLogin');

  if (showRegister) {
    showRegister.addEventListener('click', (e) => {
      e.preventDefault();
      overlay.remove();
      showLoginModal('register');
    });
  }

  if (showLogin) {
    showLogin.addEventListener('click', (e) => {
      e.preventDefault();
      overlay.remove();
      showLoginModal('login');
    });
  }
}

/**
 * Auto-fill checkout form with logged-in user info
 */
export function autoFillCheckoutForm() {
  const nameInput = document.querySelector('#customerName');
  const phoneInput = document.querySelector('#customerPhone');
  if (nameInput && phoneInput) {
    autoFillLoggedInUser(nameInput, phoneInput);
  }
}

/**
 * Show user menu if logged in (for header/nav)
 */
export function updateUserMenu() {
  const userMenuContainer = document.querySelector('#userMenuContainer');
  if (!userMenuContainer) {return;}

  if (auth.isLoggedIn()) {
    const user = auth.getStoredUser();
    userMenuContainer.innerHTML = `
      <div class="user-menu">
        <span class="user-name">👋 ${user?.name || 'User'}</span>
        <button class="user-logout-btn" style="margin-left: 10px; padding: 6px 12px; font-size: 13px;">
          Đăng xuất
        </button>
      </div>
    `;

    const logoutBtn = userMenuContainer.querySelector('.user-logout-btn');
    logoutBtn.addEventListener('click', async () => {
      await auth.logout();
      userMenuContainer.innerHTML = '';
      window.dispatchEvent(new CustomEvent('auth-change', { detail: { user: null, isLoggedIn: false } }));
      if (window.showToast) {
        showToast('Đăng xuất thành công', 'success');
      }
    });
  }
}

// Auto-init on DOMContentLoaded
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    auth.init();
    autoFillCheckoutForm();
    updateUserMenu();
  });
}
