/**
 * QR Code Module
 * AURA SPACE - Payment QR code generation and modal
 */

/**
 * Format Price (local)
 */
function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

/** Module-level state for current order */
let currentOrderForQR = null;

/**
 * Get Bank Config
 */
export function getBankConfig() {
  return {
    accountNumber: '0901234567',
    bankName: 'MB Bank',
    bankCode: 'MB'
  };
}

/**
 * Simple Hash Function
 */
export function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Generate Finder Pattern
 */
export function generateFinderPattern(x, y, moduleSize, color) {
  const size = 7 * moduleSize;
  let pattern = '';

  // Outer square
  pattern += `<rect x="${x * moduleSize}" y="${y * moduleSize}" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="${moduleSize}"/>`;
  // Inner square
  pattern += `<rect x="${(x + 2) * moduleSize}" y="${(y + 2) * moduleSize}" width="${3 * moduleSize}" height="${3 * moduleSize}"/>`;

  return pattern;
}

/**
 * Generate Simple QR SVG
 */
export function generateSimpleQR(data, color) {
  const hash = simpleHash(data);
  const size = 200;
  const modules = 21;
  const moduleSize = size / modules;
  const margin = 4 * moduleSize;

  let svg = `<svg viewBox="0 0 ${size} ${size}" width="200" height="200" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect fill="#fff" width="${size}" height="${size}"/>`;
  svg += `<g fill="${color}">`;

  // Corner markers (finder patterns)
  svg += generateFinderPattern(0, 0, moduleSize, color);
  svg += generateFinderPattern(modules - 7, 0, moduleSize, color);
  svg += generateFinderPattern(0, modules - 7, moduleSize, color);

  // Generate data modules based on hash
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if ((row < 8 && col < 8) || (row < 8 && col > modules - 9) || (row > modules - 9 && col < 8)) {
        continue;
      }

      const cellHash = (hash + row * modules + col) % 10;
      if (cellHash > 4) {
        svg += `<rect x="${margin + col * moduleSize}" y="${margin + row * moduleSize}" width="${moduleSize - 1}" height="${moduleSize - 1}"/>`;
      }
    }
  }

  svg += '</g></svg>';
  return svg;
}

/**
 * Generate VietQR Format
 */
export function generateVietQR(accountNumber, bankCode, amount, addInfo) {
  return `https://vietqr.io/${bankCode}/${accountNumber}?amount=${amount}&addInfo=${encodeURIComponent(addInfo)}`;
}

/**
 * Render QR Code as SVG
 */
export function renderQRCode(containerId, data, color = '#000') {
  const container = document.getElementById(containerId);
  if (!container) { return; }

  const qrSvg = generateSimpleQR(data, color);
  container.innerHTML = qrSvg;
}

/**
 * Generate Bank Transfer QR Code
 */
export function generateBankQR() {
  if (!currentOrderForQR) { return; }

  const { accountNumber, bankName, bankCode } = getBankConfig();
  const amount = currentOrderForQR.total;
  const content = `Chuyen khoan don hang #${currentOrderForQR.id}`;

  const bankNameEl = document.getElementById('bankName');
  const accountNumberEl = document.getElementById('accountNumber');
  const qrAmountEl = document.getElementById('qrAmount');
  const transferContentEl = document.getElementById('transferContent');

  if (bankNameEl) { bankNameEl.textContent = bankName; }
  if (accountNumberEl) { accountNumberEl.textContent = accountNumber; }
  if (qrAmountEl) { qrAmountEl.textContent = formatPrice(amount); }
  if (transferContentEl) { transferContentEl.textContent = content; }

  const qrData = generateVietQR(accountNumber, bankCode, amount, content);
  renderQRCode('qrBankCode', qrData);
}

/**
 * Generate MoMo QR Code
 */
export function generateMoMoQR() {
  if (!currentOrderForQR) { return; }

  const amount = currentOrderForQR.total;
  const orderId = currentOrderForQR.id;

  const momoData = `https://momowallet.page.link/?order_id=${orderId}&amount=${amount}&info=AURA%20SPACE%20Cafe`;
  renderQRCode('qrMoMoCode', momoData, '#f4613f');
}

/**
 * Generate VNPay QR Code
 */
export function generateVNPayQR() {
  if (!currentOrderForQR) { return; }

  const amount = currentOrderForQR.total;
  const orderId = currentOrderForQR.id;
  const { accountNumber, bankCode } = getBankConfig();

  const vnpayData = `${bankCode}${accountNumber}${amount}${orderId}`;
  renderQRCode('qrVNPayCode', vnpayData, '#0066b3');
}

/**
 * Switch Payment Method QR
 */
export function switchPaymentMethodQR(method) {
  document.querySelectorAll('.payment-method-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.payment === method);
  });

  document.querySelectorAll('.qr-section').forEach(section => {
    section.classList.remove('active');
    section.style.display = 'none';
  });

  const activeSection = document.getElementById(`${method}-section`);
  if (activeSection) {
    activeSection.classList.add('active');
    activeSection.style.display = 'block';
  }

  if (method === 'qr-bank') {
    generateBankQR();
  } else if (method === 'momo-qr') {
    generateMoMoQR();
  } else if (method === 'vnpay-qr') {
    generateVNPayQR();
  }
}

/**
 * Close Payment QR Modal
 */
export function closePaymentQRModal() {
  const modal = document.getElementById('paymentQrModal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

/**
 * Copy Account Number
 * @param {Function} showToast
 */
export async function copyAccountNumber(showToast) {
  const { accountNumber } = getBankConfig();
  try {
    await navigator.clipboard.writeText(accountNumber);
    showToast('✅ Đã sao chép số tài khoản', 'success');
  } catch (error) {
    showToast('⚠️ Không thể sao chép', 'error');
  }
}

/**
 * Setup Payment QR Handlers
 * @param {Function} showToast
 */
export function setupPaymentQRHandlers(showToast) {
  document.querySelectorAll('.payment-method-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const method = btn.dataset.payment;
      switchPaymentMethodQR(method);
    });
  });

  const closeBtn = document.getElementById('closePaymentModal');
  if (closeBtn) {
    closeBtn.addEventListener('click', closePaymentQRModal);
  }

  const modal = document.getElementById('paymentQrModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closePaymentQRModal();
      }
    });
  }

  const copyBtn = document.getElementById('copyAccountBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => copyAccountNumber(showToast));
  }
}

/**
 * Open Payment QR Modal
 */
export function openPaymentQRModal(order, paymentMethod = 'qr-bank') {
  currentOrderForQR = order;
  const modal = document.getElementById('paymentQrModal');
  if (!modal) { return; }

  modal.style.display = 'flex';
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  switchPaymentMethodQR(paymentMethod);
  setupPaymentQRHandlers(window._checkoutShowToast || (() => {}));
}

/**
 * Handle Payment with QR
 * @param {object} order
 * @param {string} paymentMethod
 * @param {Function} sendOrderToWebSocket
 */
export function handlePaymentQR(order, paymentMethod, sendOrderToWebSocket) {
  localStorage.setItem('pendingOrder', JSON.stringify(order));
  sendOrderToWebSocket(order);

  const qrMethod = paymentMethod === 'momo' ? 'momo-qr' : paymentMethod === 'vnpay' ? 'vnpay-qr' : 'qr-bank';
  openPaymentQRModal(order, qrMethod);
}
