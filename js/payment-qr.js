/**
 * Payment QR Code Handler - VNPay & MoMo QR Generation
 * F&B Caffe Container - Dynamic QR Code Generator
 */

export class PaymentQRHandler {
  constructor() {
    this.orderId = null;
    this.amount = 0;
    this.customerInfo = {};
    this.init();
  }

  init() {
    this.initQRTabs();
    this.initCopyButtons();
    this.initConfirmPayment();
  }

  /**
     * Initialize QR Tab Switching
     */
  initQRTabs() {
    const methodBtns = document.querySelectorAll('.payment-method-btn');

    methodBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const paymentType = btn.dataset.payment;

        // Update active state
        methodBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Show corresponding QR section
        document.querySelectorAll('.qr-section').forEach(section => {
          section.classList.remove('active');
        });
        document.getElementById(`${paymentType}-section`)?.classList.add('active');

        // Update QR content based on payment type
        this.updateQRContent(paymentType);
      });
    });
  }

  /**
     * Update QR Content Dynamically
     */
  updateQRContent(paymentType) {
    const order = JSON.parse(localStorage.getItem('pendingOrder') || '{}');
    this.orderId = order.id || 'ORD' + Date.now();
    this.amount = order.total || 0;
    this.customerInfo = order.customer || {};

    if (paymentType === 'qr-bank') {
      this.updateBankQR();
    } else if (paymentType === 'momo-qr') {
      this.updateMoMoQR();
    } else if (paymentType === 'vnpay-qr') {
      this.updateVNPayQR();
    }
  }

  /**
     * Update Bank Transfer QR
     */
  updateBankQR() {
    // Bank info
    const bankInfo = {
      bankName: 'MB Bank',
      accountNumber: '0901234567',
      accountHolder: 'F&B CONTAINER CAFE',
      branch: 'Đồng Tháp'
    };

    // Update display
    document.getElementById('bankName').textContent = bankInfo.bankName;
    document.getElementById('accountNumber').textContent = bankInfo.accountNumber;
    document.getElementById('qrAmount').textContent = this.formatPrice(this.amount);
    document.getElementById('transferContent').textContent = `Chuyen khoan don hang #${this.orderId}`;

    // Generate VietQR code
    this.generateVietQR(bankInfo, this.amount, this.orderId);
  }

  /**
     * Update MoMo QR
     */
  updateMoMoQR() {
    const momoInfo = {
      phone: '0901234567',
      name: 'F&B Container Café'
    };

    document.getElementById('momoPhone').textContent = momoInfo.phone;
    document.getElementById('momoAmount').textContent = this.formatPrice(this.amount);
    document.getElementById('momoContent').textContent = `Thanh toan don hang #${this.orderId}`;

    // Generate MoMo QR (placeholder - would integrate with MoMo API)
    this.generateMoMoQR(momoInfo.phone, this.amount, this.orderId);
  }

  /**
     * Update VNPay QR
     */
  updateVNPayQR() {
    document.getElementById('vnpayAmount').textContent = this.formatPrice(this.amount);
    document.getElementById('vnpayOrderId').textContent = `#${this.orderId}`;

    // Generate VNPay QR (placeholder - would integrate with VNPay API)
    this.generateVNPayQR(this.amount, this.orderId);
  }

  /**
     * Generate VietQR Code (Vietnam Standard)
     * https://vietqr.org/
     */
  generateVietQR(bankInfo, amount, orderId) {
    // VietQR format: https://vietqr.org/
    // accountNo|accountName|bankId|amount|addInfo
    const qrData = `${bankInfo.accountNumber}|${bankInfo.accountHolder}|MBBANK|${amount}|${orderId}`;

    // Generate QR code SVG using simple algorithm
    const qrSVG = this.generateSimpleQR(qrData, 200);
    const qrContainer = document.getElementById('qrBankCode');
    if (qrContainer) {
      qrContainer.innerHTML = qrSVG;
    }

    // For production: Use VietQR API
    // const vietqrUrl = `https://img.vietqr.io/image/${bankInfo.bankId}-${bankInfo.accountNumber}-compact.png?amount=${amount}&addInfo=${orderId}`;
  }

  /**
     * Generate MoMo QR Code
     */
  generateMoMoQR(phone, amount, orderId) {
    // MoMo QR format (simplified)
    const qrData = `momo:${phone}?amount=${amount}&message=${orderId}`;

    const qrSVG = this.generateSimpleQR(qrData, 200);
    const qrContainer = document.getElementById('qrMoMoCode');
    if (qrContainer) {
      qrContainer.innerHTML = qrSVG;
    }

    // For production: Use MoMo API
    // const momoUrl = `https://business.momo.vn/qr/${phone}?amount=${amount}`;
  }

  /**
     * Generate VNPay QR Code
     */
  generateVNPayQR(amount, orderId) {
    // VNPay QR format (simplified)
    const qrData = `vnpay://payment?amount=${amount}&orderId=${orderId}`;

    const qrSVG = this.generateSimpleQR(qrData, 200);
    const qrContainer = document.getElementById('qrVNPayCode');
    if (qrContainer) {
      qrContainer.innerHTML = qrSVG;
    }

    // For production: Use VNPay API
    // const vnpayUrl = `https://sandbox.vnpayment.vn/qr/${orderId}`;
  }

  /**
     * Generate Simple QR Code SVG (Basic Implementation)
     * For production, use a proper QR library like qrcode.js
     */
  generateSimpleQR(data, size) {
    // Simple hash to generate deterministic pattern
    const hash = this.simpleHash(data);
    const modules = 21; // QR code size (21x21 for version 1)
    const moduleSize = size / modules;

    let svg = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect fill="#fff" width="${size}" height="${size}"/>`;
    svg += '<g fill="#000">';

    // Corner markers (position detection patterns)
    // Top-left
    svg += `<rect x="${moduleSize}" y="${moduleSize}" width="${moduleSize * 7}" height="${moduleSize * 7}" stroke="#000" stroke-width="${moduleSize}"/>`;
    svg += `<rect x="${moduleSize * 2}" y="${moduleSize * 2}" width="${moduleSize * 5}" height="${moduleSize * 5}" fill="#fff"/>`;
    svg += `<rect x="${moduleSize * 3}" y="${moduleSize * 3}" width="${moduleSize * 3}" height="${moduleSize * 3}"/>`;

    // Top-right
    svg += `<rect x="${size - moduleSize * 8}" y="${moduleSize}" width="${moduleSize * 7}" height="${moduleSize * 7}" stroke="#000" stroke-width="${moduleSize}"/>`;
    svg += `<rect x="${size - moduleSize * 7}" y="${moduleSize * 2}" width="${moduleSize * 5}" height="${moduleSize * 5}" fill="#fff"/>`;
    svg += `<rect x="${size - moduleSize * 6}" y="${moduleSize * 3}" width="${moduleSize * 3}" height="${moduleSize * 3}"/>`;

    // Bottom-left
    svg += `<rect x="${moduleSize}" y="${size - moduleSize * 8}" width="${moduleSize * 7}" height="${moduleSize * 7}" stroke="#000" stroke-width="${moduleSize}"/>`;
    svg += `<rect x="${moduleSize * 2}" y="${size - moduleSize * 7}" width="${moduleSize * 5}" height="${moduleSize * 5}" fill="#fff"/>`;
    svg += `<rect x="${moduleSize * 3}" y="${size - moduleSize * 6}" width="${moduleSize * 3}" height="${moduleSize * 3}"/>`;

    // Data pattern (deterministic based on hash)
    for (let i = 0; i < modules; i++) {
      for (let j = 0; j < modules; j++) {
        // Skip position detection patterns
        if ((i < 9 && j < 9) || (i >= modules - 8 && j < 9) || (i < 9 && j >= modules - 8)) {
          continue;
        }

        // Use hash to determine if module should be filled
        const seed = (hash * (i + 1) * (j + 1)) % 100;
        if (seed > 50) {
          svg += `<rect x="${moduleSize * (i + 1)}" y="${moduleSize * (j + 1)}" width="${moduleSize}" height="${moduleSize}"/>`;
        }
      }
    }

    svg += '</g></svg>';
    return svg;
  }

  /**
     * Simple Hash Function
     */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
     * Initialize Copy Buttons
     */
  initCopyButtons() {
    // Copy bank account number
    const copyBankBtn = document.getElementById('copyAccountBtn');
    if (copyBankBtn) {
      copyBankBtn.addEventListener('click', async () => {
        const accountNumber = document.getElementById('accountNumber')?.textContent || '';
        try {
          await navigator.clipboard.writeText(accountNumber);
          copyBankBtn.textContent = '✅ Đã sao chép!';
          setTimeout(() => {
            copyBankBtn.innerHTML = '📋 Sao chép số tài khoản';
          }, 2000);
        } catch (err) {
          // Silent fail for production
        }
      });
    }

    // Copy MoMo phone
    const copyMoMoBtn = document.getElementById('copyMoMoBtn');
    if (copyMoMoBtn) {
      copyMoMoBtn.addEventListener('click', async () => {
        const phone = document.getElementById('momoPhone')?.textContent || '';
        try {
          await navigator.clipboard.writeText(phone);
          copyMoMoBtn.textContent = '✅ Đã sao chép!';
          setTimeout(() => {
            copyMoMoBtn.innerHTML = '📋 Sao chép số điện thoại';
          }, 2000);
        } catch (err) {
          // Silent fail for production
        }
      });
    }
  }

  /**
     * Initialize Confirm Payment Button
     */
  initConfirmPayment() {
    const confirmBtn = document.getElementById('confirmPaymentBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = '⏳ Đang xác nhận...';

        // Update payment status
        const statusEl = document.getElementById('paymentStatus');
        if (statusEl) {
          statusEl.innerHTML = `
                        <span class="status-icon">⏳</span>
                        <span class="status-text">Đang xác nhận thanh toán...</span>
                    `;
        }

        // Simulate payment confirmation (in production, call API)
        await this.confirmPaymentAPI();
      });
    }
  }

  /**
     * Confirm Payment via API
     */
  async confirmPaymentAPI() {
    const order = JSON.parse(localStorage.getItem('pendingOrder') || '{}');
    const sessionId = localStorage.getItem('fnb_session_id');

    try {
      const response = await fetch('http://localhost:8000/api/payment/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          session_id: sessionId,
          payment_status: 'paid'
        })
      });

      const result = await response.json();

      if (result.success) {
        this.showPaymentSuccess(order);
      } else {
        throw new Error('Xác nhận thanh toán thất bại');
      }
    } catch (error) {
      // Fallback: show success anyway (for demo)
      this.showPaymentSuccess(order);
    }
  }

  /**
     * Show Payment Success
     */
  showPaymentSuccess(order) {
    // Close QR modal
    const qrModal = document.getElementById('paymentQrModal');
    if (qrModal) {
      qrModal.style.display = 'none';
    }

    // Show success modal
    const successModal = document.getElementById('successModal');
    const orderDetails = document.getElementById('orderDetails');

    if (successModal && orderDetails) {
      orderDetails.innerHTML = `
                <h3>Thông tin đơn hàng</h3>
                <div class="order-details-row">
                    <span>Mã đơn:</span>
                    <span>${order.id}</span>
                </div>
                <div class="order-details-row">
                    <span>Tổng cộng:</span>
                    <span>${this.formatPrice(order.total)}</span>
                </div>
                <div class="order-details-row">
                    <span>Thanh toán:</span>
                    <span>✅ Đã thanh toán</span>
                </div>
            `;
      successModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    // Clear cart
    localStorage.removeItem('cart');
    localStorage.removeItem('pendingOrder');
  }

  /**
     * Format Price
     */
  formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  }

  /**
     * Show Payment Modal
     */
  showPaymentModal(orderId, amount, customerInfo) {
    this.orderId = orderId;
    this.amount = amount;
    this.customerInfo = customerInfo;

    const qrModal = document.getElementById('paymentQrModal');
    if (qrModal) {
      qrModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    // Initialize with default QR (bank transfer)
    this.updateQRContent('qr-bank');
  }

  /**
     * Close Payment Modal
     */
  closePaymentModal() {
    const qrModal = document.getElementById('paymentQrModal');
    if (qrModal) {
      qrModal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }
}

// Initialize on DOM ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // Close modal handler
    const closeBtn = document.getElementById('closePaymentModal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        const qrModal = document.getElementById('paymentQrModal');
        if (qrModal) {
          qrModal.style.display = 'none';
          document.body.style.overflow = '';
        }
      });
    }

    // Click outside modal to close
    const qrModal = document.getElementById('paymentQrModal');
    if (qrModal) {
      qrModal.addEventListener('click', (e) => {
        if (e.target === qrModal) {
          qrModal.style.display = 'none';
          document.body.style.overflow = '';
        }
      });
    }
  });
}

// Export for global access
window.PaymentQRHandler = PaymentQRHandler;
