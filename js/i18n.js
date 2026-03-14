/**
 * ═══════════════════════════════════════════════
 *  F&B CAFFE CONTAINER — i18n Multi-Language
 *  Vietnamese / English Translation System
 * ═══════════════════════════════════════════════
 */

const I18N = {
    currentLang: 'vi',
    defaultLang: 'vi',
    supportedLangs: ['vi', 'en'],

    translations: {
        vi: {
            // Navigation
            'nav.home': 'Trang Chủ',
            'nav.menu': 'Thực Đơn',
            'nav.order': 'Đặt Hàng',
            'nav.contact': 'Liên Hệ',
            'nav.loyalty': 'Thành Viên',
            'nav.dashboard': 'Quản Lý',

            // Hero Section
            'hero.title': 'F&B Container Café',
            'hero.subtitle': 'Cà phê phong cách Container tại Sa Đéc',
            'hero.cta.primary': 'Đặt Hàng Ngay',
            'hero.cta.secondary': 'Xem Thực Đơn',
            'hero.scroll': 'Cuộn để khám phá',

            // Features
            'feature.container.title': 'Không Gian Container',
            'feature.container.desc': 'Thiết kế công nghiệp độc đáo, không gian check-in cực chất',
            'feature.coffee.title': 'Cà Phê Nguyên Chất',
            'feature.coffee.desc': 'Hạt cà phê Robusta & Arabica tuyển chọn từ vùng trồng danh tiếng',
            'feature.delivery.title': 'Giao Hàng Nhanh',
            'feature.delivery.desc': 'Giao hàng tận nơi trong 15-20 phút tại khu vực Sa Đéc',

            // Menu Categories
            'menu.coffee': 'Cà Phê',
            'menu.signature': 'Đặc Biệt',
            'menu.snacks': 'Ăn Vặt',
            'menu.all': 'Tất Cả',

            // Order
            'order.cart': 'Giỏ Hàng',
            'order.cart.empty': 'Giỏ hàng trống',
            'order.cart.total': 'Tổng Cộng',
            'order.cart.shipping': 'Phí giao hàng',
            'order.cart.checkout': 'Thanh Toán',
            'order.cart.add': 'Thêm',
            'order.qty': 'SL',

            // Product Names (Coffee)
            'product.espresso': 'Espresso Đơn/Đôi',
            'product.coffee.milk': 'Cà Phê Sữa Đá',
            'product.bac.xiu': 'Bạc Xỉu Đá',
            'product.cold.brew': 'Cold Brew Tower (12h)',
            'product.pour.over': 'Pour Over V60',
            'product.latte': 'Latte / Cappuccino',
            'product.caramel.macchiato': 'Caramel Macchiato',

            // Product Names (Signature)
            'product.container.special': 'Container Special',
            'product.dirty.matcha': 'Dirty Matcha Latte',
            'product.tra.sen.vang': 'Trà Sen Vàng',
            'product.kombucha': 'Kombucha Tươi',
            'product.soda.chanh': 'Soda Chanh Bạc Hà',
            'product.tra.cay': 'Trái Cây Nhiệt Đới',
            'product.matcha.latte': 'Matcha Latte',

            // Product Names (Snacks)
            'product.banh.mi': 'Bánh Mì Chả Lụa',
            'product.sandwich': 'Sandwich Trứng',
            'product.croissant': 'Croissant Bơ Pháp',
            'product.granola': 'Granola Bowl',
            'product.cookie': 'Cookie Choco Chip',
            'product.cheesecake': 'Cheesecake Slice',
            'product.khoai.tay': 'Khoai Tây Chiên',

            // Contact Form
            'contact.title': 'Liên Hệ',
            'contact.subtitle': 'Gửi tin nhắn cho chúng tôi',
            'contact.name': 'Họ Tên',
            'contact.name.placeholder': 'Nhập họ tên của bạn',
            'contact.phone': 'Số Điện Thoại',
            'contact.phone.placeholder': 'Nhập số điện thoại',
            'contact.email': 'Email',
            'contact.email.placeholder': 'Nhập email của bạn',
            'contact.subject': 'Chủ Đề',
            'contact.subject.select': 'Chọn chủ đề',
            'contact.subject.general': 'Câu hỏi chung',
            'contact.subject.support': 'Hỗ trợ khách hàng',
            'contact.subject.feedback': 'Góp ý',
            'contact.subject.partnership': 'Hợp tác',
            'contact.message': 'Tin Nhắn',
            'contact.message.placeholder': 'Nhập tin nhắn của bạn',
            'contact.submit': 'Gửi Tin Nhắn',
            'contact.submitting': '⏳ Đang gửi...',
            'contact.success': '✅ Đã gửi thành công!',

            // Footer
            'footer.address': 'Địa Chỉ',
            'footer.address.text': '123 Đường Trần Phú, P.1, TP.Sa Đéc, Đồng Tháp',
            'footer.phone': 'Điện Thoại',
            'footer.email': 'Email',
            'footer.hours': 'Giờ Mở Cửa',
            'footer.hours.text': 'Thứ 2 - CN: 6:00 - 22:00',
            'footer.social': 'Mạng Xã Hội',
            'footer.copyright': '© 2026 F&B Container Café. All rights reserved.',

            // Success Page
            'success.title': 'Đặt Hàng Thành Công!',
            'success.message': 'Cảm ơn bạn đã đặt hàng tại F&B Container Café. Chúng tôi sẽ liên hệ xác nhận trong vòng 5 phút.',
            'success.order.id': 'Mã đơn hàng',
            'success.order.total': 'Tổng cộng',
            'success.payment.method': 'Phương thức thanh toán',
            'success.next.steps': 'Các Bước Tiếp Theo',
            'success.step.1': 'Chúng tôi sẽ gọi/xác nhận đơn qua Zalo trong 5 phút',
            'success.step.2': 'Chuẩn bị và đóng gói đồ uống',
            'success.step.3': 'Giao hàng trong 15-20 phút (hoặc sẵn sàng tại quán)',
            'success.btn.order.more': '🛒 Đặt Thêm',
            'success.btn.home': '🏠 Về Trang Chủ',

            // Payment Methods
            'payment.cod': 'Tiền mặt (COD)',
            'payment.momo': 'Ví MoMo',
            'payment.payos': 'PayOS',
            'payment.vnpay': 'VNPay',

            // Order Status
            'status.pending': 'Chờ xác nhận...',
            'status.confirmed': 'Nhà hàng đã xác nhận',
            'status.preparing': 'Đang chuẩn bị',
            'status.ready': 'Sẵn sàng giao',
            'status.delivering': 'Đang giao hàng',
            'status.completed': 'Hoàn thành',
            'status.cancelled': 'Đã hủy',

            // Common
            'common.loading': 'Đang tải...',
            'common.error': 'Có lỗi xảy ra',
            'common.close': 'Đóng',
            'common.save': 'Lưu',
            'common.cancel': 'Hủy',
            'common.delete': 'Xóa',
            'common.edit': 'Sửa',
            'common.view': 'Xem',
            'common.back': 'Quay Lại',
            'common.continue': 'Tiếp Tục',
            'common.yes': 'Có',
            'common.no': 'Không',

            // Theme
            'theme.dark': 'Giao diện tối',
            'theme.light': 'Giao diện sáng',
            'theme.toggle': 'Chuyển đổi giao diện',

            // Language
            'lang.vi': 'Tiếng Việt',
            'lang.en': 'English',
            'lang.switch': 'Chuyển ngôn ngữ',

            // Toast Messages
            'toast.added.cart': 'Đã thêm vào giỏ hàng',
            'toast.removed.cart': 'Đã xóa khỏi giỏ hàng',
            'toast.updated.cart': 'Đã cập nhật giỏ hàng',
            'toast.order.success': 'Đặt hàng thành công!',
            'toast.order.error': 'Có lỗi khi đặt hàng',
            'toast.form.success': 'Gửi thành công!',
            'toast.form.error': 'Có lỗi khi gửi',

            // Validation
            'validation.required': 'Trường này bắt buộc',
            'validation.name.min': 'Họ tên phải có ít nhất 2 ký tự',
            'validation.phone.invalid': 'Số điện thoại không hợp lệ',
            'validation.email.invalid': 'Email không hợp lệ',
            'validation.subject.select': 'Vui lòng chọn chủ đề',
            'validation.message.min': 'Tin nhắn phải có ít nhất 10 ký tự'
        },

        en: {
            // Navigation
            'nav.home': 'Home',
            'nav.menu': 'Menu',
            'nav.order': 'Order',
            'nav.contact': 'Contact',
            'nav.loyalty': 'Loyalty',
            'nav.dashboard': 'Dashboard',

            // Hero Section
            'hero.title': 'F&B Container Café',
            'hero.subtitle': 'Container-style Coffee in Sa Dec',
            'hero.cta.primary': 'Order Now',
            'hero.cta.secondary': 'View Menu',
            'hero.scroll': 'Scroll to explore',

            // Features
            'feature.container.title': 'Container Space',
            'feature.container.desc': 'Unique industrial design, perfect check-in spot',
            'feature.coffee.title': 'Pure Coffee',
            'feature.coffee.desc': 'Selected Robusta & Arabica beans from renowned regions',
            'feature.delivery.title': 'Fast Delivery',
            'feature.delivery.desc': 'Home delivery within 15-20 minutes in Sa Dec area',

            // Menu Categories
            'menu.coffee': 'Coffee',
            'menu.signature': 'Signature',
            'menu.snacks': 'Snacks',
            'menu.all': 'All',

            // Order
            'order.cart': 'Cart',
            'order.cart.empty': 'Cart is empty',
            'order.cart.total': 'Total',
            'order.cart.shipping': 'Shipping Fee',
            'order.cart.checkout': 'Checkout',
            'order.cart.add': 'Add',
            'order.qty': 'Qty',

            // Product Names (Coffee)
            'product.espresso': 'Espresso Single/Double',
            'product.coffee.milk': 'Iced Coffee with Milk',
            'product.bac.xiu': 'Iced Bac Xiu',
            'product.cold.brew': 'Cold Brew Tower (12h)',
            'product.pour.over': 'Pour Over V60',
            'product.latte': 'Latte / Cappuccino',
            'product.caramel.macchiato': 'Caramel Macchiato',

            // Product Names (Signature)
            'product.container.special': 'Container Special',
            'product.dirty.matcha': 'Dirty Matcha Latte',
            'product.tra.sen.vang': 'Golden Lotus Tea',
            'product.kombucha': 'Fresh Kombucha',
            'product.soda.chanh': 'Lemon Mint Soda',
            'product.tra.cay': 'Tropical Fruit Tea',
            'product.matcha.latte': 'Matcha Latte',

            // Product Names (Snacks)
            'product.banh.mi': 'Banh Mi with Pork Roll',
            'product.sandwich': 'Egg Sandwich',
            'product.croissant': 'French Butter Croissant',
            'product.granola': 'Granola Bowl',
            'product.cookie': 'Chocolate Chip Cookie',
            'product.cheesecake': 'Cheesecake Slice',
            'product.khoai.tay': 'French Fries',

            // Contact Form
            'contact.title': 'Contact',
            'contact.subtitle': 'Send us a message',
            'contact.name': 'Full Name',
            'contact.name.placeholder': 'Enter your full name',
            'contact.phone': 'Phone Number',
            'contact.phone.placeholder': 'Enter your phone number',
            'contact.email': 'Email',
            'contact.email.placeholder': 'Enter your email',
            'contact.subject': 'Subject',
            'contact.subject.select': 'Select subject',
            'contact.subject.general': 'General Inquiry',
            'contact.subject.support': 'Customer Support',
            'contact.subject.feedback': 'Feedback',
            'contact.subject.partnership': 'Partnership',
            'contact.message': 'Message',
            'contact.message.placeholder': 'Enter your message',
            'contact.submit': 'Send Message',
            'contact.submitting': '⏳ Sending...',
            'contact.success': '✅ Sent successfully!',

            // Footer
            'footer.address': 'Address',
            'footer.address.text': '123 Tran Phu Street, Ward 1, Sa Dec City, Dong Thap',
            'footer.phone': 'Phone',
            'footer.email': 'Email',
            'footer.hours': 'Opening Hours',
            'footer.hours.text': 'Mon - Sun: 6:00 AM - 10:00 PM',
            'footer.social': 'Social Media',
            'footer.copyright': '© 2026 F&B Container Café. All rights reserved.',

            // Success Page
            'success.title': 'Order Successful!',
            'success.message': 'Thank you for ordering at F&B Container Café. We will contact you to confirm within 5 minutes.',
            'success.order.id': 'Order ID',
            'success.order.total': 'Total',
            'success.payment.method': 'Payment Method',
            'success.next.steps': 'Next Steps',
            'success.step.1': 'We will call/confirm via Zalo within 5 minutes',
            'success.step.2': 'Prepare and package beverages',
            'success.step.3': 'Delivery within 15-20 minutes (or ready at shop)',
            'success.btn.order.more': '🛒 Order More',
            'success.btn.home': '🏠 Home',

            // Payment Methods
            'payment.cod': 'Cash (COD)',
            'payment.momo': 'MoMo Wallet',
            'payment.payos': 'PayOS',
            'payment.vnpay': 'VNPay',

            // Order Status
            'status.pending': 'Pending...',
            'status.confirmed': 'Confirmed by restaurant',
            'status.preparing': 'Preparing',
            'status.ready': 'Ready for delivery',
            'status.delivering': 'Delivering',
            'status.completed': 'Completed',
            'status.cancelled': 'Cancelled',

            // Common
            'common.loading': 'Loading...',
            'common.error': 'An error occurred',
            'common.close': 'Close',
            'common.save': 'Save',
            'common.cancel': 'Cancel',
            'common.delete': 'Delete',
            'common.edit': 'Edit',
            'common.view': 'View',
            'common.back': 'Back',
            'common.continue': 'Continue',
            'common.yes': 'Yes',
            'common.no': 'No',

            // Theme
            'theme.dark': 'Dark mode',
            'theme.light': 'Light mode',
            'theme.toggle': 'Toggle theme',

            // Language
            'lang.vi': 'Tiếng Việt',
            'lang.en': 'English',
            'lang.switch': 'Switch language',

            // Toast Messages
            'toast.added.cart': 'Added to cart',
            'toast.removed.cart': 'Removed from cart',
            'toast.updated.cart': 'Cart updated',
            'toast.order.success': 'Order placed successfully!',
            'toast.order.error': 'Error placing order',
            'toast.form.success': 'Sent successfully!',
            'toast.form.error': 'Error sending',

            // Validation
            'validation.required': 'This field is required',
            'validation.name.min': 'Name must be at least 2 characters',
            'validation.phone.invalid': 'Invalid phone number',
            'validation.email.invalid': 'Invalid email',
            'validation.subject.select': 'Please select a subject',
            'validation.message.min': 'Message must be at least 10 characters'
        }
    },

    /**
     * Initialize i18n system
     */
    init() {
        // Load saved language from localStorage
        const savedLang = localStorage.getItem('language') || this.defaultLang;
        this.setLanguage(savedLang);

        // Add language toggle button to DOM
        this.addLanguageToggle();

        console.log('[i18n] Initialized with language:', this.currentLang);
    },

    /**
     * Set current language
     */
    setLanguage(lang) {
        if (!this.supportedLangs.includes(lang)) {
            lang = this.defaultLang;
        }
        this.currentLang = lang;
        localStorage.setItem('language', lang);
        document.documentElement.setAttribute('lang', lang);

        // Update all translatable elements
        this.translatePage();

        // Dispatch event for custom handling
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    },

    /**
     * Get translation by key
     */
    t(key, params = {}) {
        const lang = this.currentLang;
        let translation = this.translations[lang]?.[key] || this.translations[this.defaultLang]?.[key] || key;

        // Replace parameters
        Object.keys(params).forEach(param => {
            translation = translation.replace(`{${param}}`, params[param]);
        });

        return translation;
    },

    /**
     * Translate all elements with data-i18n attribute
     */
    translatePage() {
        // Translate elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const params = JSON.parse(el.getAttribute('data-i18n-params') || '{}');
            el.textContent = this.t(key, params);
        });

        // Translate placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.setAttribute('placeholder', this.t(key));
        });

        // Translate titles
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.setAttribute('title', this.t(key));
        });

        // Update language toggle button text
        this.updateLanguageToggle();
    },

    /**
     * Add language toggle button to navigation
     */
    addLanguageToggle() {
        // Check if toggle already exists
        if (document.getElementById('langToggle')) return;

        // Create toggle button
        const toggle = document.createElement('button');
        toggle.id = 'langToggle';
        toggle.className = 'lang-toggle';
        toggle.setAttribute('aria-label', this.t('lang.switch'));
        toggle.innerHTML = '<span class="lang-icon">🌐</span><span class="lang-text">EN</span>';
        toggle.style.cssText = `
            background: transparent;
            border: 1px solid var(--text-secondary, #888);
            border-radius: 8px;
            padding: 8px 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.85rem;
            color: var(--text-primary, #fff);
            transition: all 0.3s ease;
        `;
        toggle.addEventListener('click', () => this.toggleLanguage());

        // Find theme toggle and insert after it
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle && themeToggle.parentNode) {
            themeToggle.parentNode.insertBefore(toggle, themeToggle.nextSibling);
        } else {
            // Fallback: add to nav
            const nav = document.querySelector('.nav-links, .navbar');
            if (nav) {
                nav.appendChild(toggle);
            }
        }
    },

    /**
     * Toggle between Vietnamese and English
     */
    toggleLanguage() {
        const newLang = this.currentLang === 'vi' ? 'en' : 'vi';
        this.setLanguage(newLang);

        // Show toast notification
        this.showToast(`🌐 Language switched to ${newLang === 'vi' ? 'Vietnamese' : 'English'}`);
    },

    /**
     * Update language toggle button text
     */
    updateLanguageToggle() {
        const toggle = document.getElementById('langToggle');
        if (toggle) {
            const langText = toggle.querySelector('.lang-text');
            if (langText) {
                langText.textContent = this.currentLang === 'vi' ? 'EN' : 'VI';
            }
        }
    },

    /**
     * Show toast notification
     */
    showToast(message) {
        const existing = document.querySelector('.toast-notification');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: linear-gradient(135deg, var(--warm-amber, #f39c12), var(--warm-gold, #f1c40f));
            color: var(--coffee-espresso, #1a1a2e);
            padding: 14px 24px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 0.9rem;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 9999;
            transition: transform 0.4s ease;
        `;

        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });

        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(100px)';
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }
};

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => I18N.init());
} else {
    I18N.init();
}

// Export for global use
window.I18N = I18N;
