/**
 * i18n - Internationalization Module
 * Hỗ trợ đa ngôn ngữ VI/EN cho F&B Container Café
 */

// Dictionary ngôn ngữ
const translations = {
    vi: {
        // Navigation
        'nav.home': 'Trang Chủ',
        'nav.menu': 'Menu',
        'nav.loyalty': 'Loyalty',
        'nav.contact': 'Liên Hệ',
        'nav.order': '📞 Đặt Bàn',

        // Hero Section
        'hero.tagline': 'Where Flavor Meets Design',
        'hero.cta.primary': '🛒 Đặt Hàng Ngay',
        'hero.cta.secondary': '📍 Xem Vị Trí',
        'hero.hours': 'Mở cửa 7:00 - 22:00 hàng ngày',

        // Features
        'feature.specialty': 'Specialty Coffee',
        'feature.specialty.desc': 'Cà phê chất lượng cao từ những vùng trồng cà phê tốt nhất',
        'feature.rooftop': 'Rooftop Bar',
        'feature.rooftop.desc': 'View đồng lúa panorama 360 độ giữa lòng Sa Đéc',
        'feature.cyberpunk': 'Cyberpunk Space',
        'feature.cyberpunk.desc': 'Không gian container 3 tầng độc đáo, check-in cực chất',
        'feature.container': 'Container Design',
        'feature.container.desc': 'Kiến trúc container công nghiệp độc đáo',

        // Menu Categories
        'menu.category.all': 'Tất Cả',
        'menu.category.coffee': 'Cà Phê',
        'menu.category.tea': 'Trà',
        'menu.category.specialty': 'Signature Drinks',
        'menu.category.snacks': 'Ăn Vặt',

        // Product
        'product.view_details': 'Xem Chi Tiết',
        'product.add_to_cart': 'Thêm Vào Giỏ',

        // Loyalty
        'loyalty.title': 'F&B Loyalty Club',
        'loyalty.tagline': 'Tích điểm đổi quà - Đặc quyền đẳng cấp',
        'loyalty.tier.bronze': 'Hạng Đồng',
        'loyalty.tier.silver': 'Hạng Bạc',
        'loyalty.tier.gold': 'Hạng Vàng',
        'loyalty.tier.diamond': 'Hạng Kim Cương',
        'loyalty.points': 'Điểm',
        'loyalty.rewards': 'Đổi Thưởng',
        'loyalty.history': 'Lịch Sử',

        // Checkout
        'checkout.title': 'Thanh Toán',
        'checkout.cart': 'Giỏ Hàng',
        'checkout.total': 'Tổng Cộng',
        'checkout.payment': 'Phương Thức Thanh Toán',
        'checkout.confirm': 'Xác Nhận Đơn Hàng',

        // Footer
        'footer.brand': 'F&B CONTAINER',
        'footer.tagline': 'Where Flavor Meets Design',
        'footer.links': 'Liên Kết',
        'footer.contact': 'Liên Hệ',
        'footer.social': 'Theo Dõi',
        'footer.address': '📍 Sa Đéc, Đồng Tháp',
        'footer.phone': '📞 0901 234 567',
        'footer.email': '✉️ hello@fnbcontainer.vn',
        'footer.copyright': '© 2026 F&B Container Café. Made with ❤️ in Sa Đéc.',

        // Common
        'common.loading': 'Đang tải...',
        'common.error': 'Có lỗi xảy ra',
        'common.success': 'Thành công',
        'common.close': 'Đóng',
        'common.cancel': 'Hủy',
        'common.confirm': 'Xác nhận',
        'common.save': 'Lưu',
        'common.delete': 'Xóa',
        'common.edit': 'Sửa',
        'common.search': 'Tìm kiếm',
        'common.filter': 'Bộ lọc',
        'common.sort': 'Sắp xếp',

        // Accessibility
        'a11y.menu': 'Menu điều hướng',
        'a11y.skip': 'Bỏ qua nội dung chính',
        'a11y.toggle_theme': 'Chuyển chế độ sáng/tối',
        'a11y.open_menu': 'Mở menu',
        'a11y.close_menu': 'Đóng menu',
        'a11y.cart': 'Giỏ hàng',
        'a11y.search': 'Tìm kiếm',

        // Order
        'order.status.pending': 'Chờ xử lý',
        'order.status.confirmed': 'Đã xác nhận',
        'order.status.preparing': 'Đang chế biến',
        'order.status.ready': 'Sẵn sàng',
        'order.status.delivered': 'Đã giao',
        'order.status.cancelled': 'Đã hủy',
        'order.number': 'Mã đơn hàng',
        'order.date': 'Ngày đặt',
        'order.items': 'Số lượng',
        'order.total': 'Tổng tiền',

        // Payment Methods
        'payment.cash': 'Tiền mặt',
        'payment.momo': 'MoMo',
        'payment.vnpay': 'VNPay',
        'payment.qr': 'QR Code',

        // Notifications
        'notify.added_to_cart': 'Đã thêm vào giỏ hàng',
        'notify.removed_from_cart': 'Đã xóa khỏi giỏ hàng',
        'notify.order_success': 'Đặt hàng thành công!',
        'notify.order_failed': 'Đặt hàng thất bại',
        'notify.login_required': 'Vui lòng đăng nhập',
        'notify.payment_success': 'Thanh toán thành công!',
        'notify.payment_failed': 'Thanh toán thất bại'
    },

    en: {
        // Navigation
        'nav.home': 'Home',
        'nav.menu': 'Menu',
        'nav.loyalty': 'Loyalty',
        'nav.contact': 'Contact',
        'nav.order': '📞 Book Table',

        // Hero Section
        'hero.tagline': 'Where Flavor Meets Design',
        'hero.cta.primary': '🛒 Order Now',
        'hero.cta.secondary': '📍 View Location',
        'hero.hours': 'Open 7:00 - 22:00 Daily',

        // Features
        'feature.specialty': 'Specialty Coffee',
        'feature.specialty.desc': 'Premium coffee from the finest coffee regions',
        'feature.rooftop': 'Rooftop Bar',
        'feature.rooftop.desc': '360° rice field panorama view in Sa Đéc',
        'feature.cyberpunk': 'Cyberpunk Space',
        'feature.cyberpunk.desc': 'Unique 3-floor container space, perfect for check-in',
        'feature.container': 'Container Design',
        'feature.container.desc': 'Unique industrial container architecture',

        // Menu Categories
        'menu.category.all': 'All',
        'menu.category.coffee': 'Coffee',
        'menu.category.tea': 'Tea',
        'menu.category.specialty': 'Signature Drinks',
        'menu.category.snacks': 'Snacks',

        // Product
        'product.view_details': 'View Details',
        'product.add_to_cart': 'Add to Cart',

        // Loyalty
        'loyalty.title': 'F&B Loyalty Club',
        'loyalty.tagline': 'Earn points, get rewards - Premium privileges',
        'loyalty.tier.bronze': 'Bronze Tier',
        'loyalty.tier.silver': 'Silver Tier',
        'loyalty.tier.gold': 'Gold Tier',
        'loyalty.tier.diamond': 'Diamond Tier',
        'loyalty.points': 'Points',
        'loyalty.rewards': 'Rewards',
        'loyalty.history': 'History',

        // Checkout
        'checkout.title': 'Checkout',
        'checkout.cart': 'Shopping Cart',
        'checkout.total': 'Total',
        'checkout.payment': 'Payment Method',
        'checkout.confirm': 'Confirm Order',

        // Footer
        'footer.brand': 'F&B CONTAINER',
        'footer.tagline': 'Where Flavor Meets Design',
        'footer.links': 'Links',
        'footer.contact': 'Contact',
        'footer.social': 'Follow Us',
        'footer.address': '📍 Sa Đéc, Đồng Tháp',
        'footer.phone': '📞 0901 234 567',
        'footer.email': '✉️ hello@fnbcontainer.vn',
        'footer.copyright': '© 2026 F&B Container Café. Made with ❤️ in Sa Đéc.',

        // Common
        'common.loading': 'Loading...',
        'common.error': 'An error occurred',
        'common.success': 'Success',
        'common.close': 'Close',
        'common.cancel': 'Cancel',
        'common.confirm': 'Confirm',
        'common.save': 'Save',
        'common.delete': 'Delete',
        'common.edit': 'Edit',
        'common.search': 'Search',
        'common.filter': 'Filter',
        'common.sort': 'Sort',

        // Accessibility
        'a11y.menu': 'Navigation menu',
        'a11y.skip': 'Skip to main content',
        'a11y.toggle_theme': 'Toggle light/dark mode',
        'a11y.open_menu': 'Open menu',
        'a11y.close_menu': 'Close menu',
        'a11y.cart': 'Shopping cart',
        'a11y.search': 'Search',

        // Order
        'order.status.pending': 'Pending',
        'order.status.confirmed': 'Confirmed',
        'order.status.preparing': 'Preparing',
        'order.status.ready': 'Ready',
        'order.status.delivered': 'Delivered',
        'order.status.cancelled': 'Cancelled',
        'order.number': 'Order Number',
        'order.date': 'Order Date',
        'order.items': 'Quantity',
        'order.total': 'Total Amount',

        // Payment Methods
        'payment.cash': 'Cash',
        'payment.momo': 'MoMo',
        'payment.vnpay': 'VNPay',
        'payment.qr': 'QR Code',

        // Notifications
        'notify.added_to_cart': 'Added to cart',
        'notify.removed_from_cart': 'Removed from cart',
        'notify.order_success': 'Order placed successfully!',
        'notify.order_failed': 'Order failed',
        'notify.login_required': 'Please log in',
        'notify.payment_success': 'Payment successful!',
        'notify.payment_failed': 'Payment failed'
    }
};

// Ngôn ngữ hiện tại
let currentLang = 'vi';

/**
 * Lấy ngôn ngữ từ localStorage hoặc browser
 */
function getPreferredLanguage() {
    // Ưu tiên localStorage
    const saved = localStorage.getItem('fnb_lang');
    if (saved && translations[saved]) {
        return saved;
    }

    // Fallback: browser language
    const browserLang = navigator.language?.split('-')[0] || 'vi';
    return translations[browserLang] ? browserLang : 'vi';
}

/**
 * Khởi tạo i18n
 */
function initI18n() {
    currentLang = getPreferredLanguage();
    document.documentElement.lang = currentLang;
    applyTranslations();
}

/**
 * Dịch một key
 * @param {string} key - Translation key
 * @param {object} params - Optional parameters
 * @returns {string} Translated text
 */
function t(key, params = {}) {
    const translation = translations[currentLang]?.[key] || translations['vi'][key] || key;

    // Replace parameters
    return Object.entries(params).reduce((str, [param, value]) => {
        return str.replace(new RegExp(`\\{${param}\\}`, 'g'), value);
    }, translation);
}

/**
 * Áp dụng translations cho tất cả elements có data-i18n attribute
 */
function applyTranslations() {
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });

    // Placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });

    // Title/aria-label
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });

    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria');
        el.setAttribute('aria-label', t(key));
    });

    // Update lang attribute
    document.documentElement.lang = currentLang;

    // Emit event for custom handling
    window.dispatchEvent(new CustomEvent('i18n:updated', { detail: { lang: currentLang } }));
}

/**
 * Chuyển ngôn ngữ
 * @param {string} lang - 'vi' hoặc 'en'
 */
function setLanguage(lang) {
    if (!translations[lang]) {
        return;
    }

    currentLang = lang;
    localStorage.setItem('fnb_lang', lang);
    applyTranslations();
}

/**
 * Toggle giữa VI và EN
 */
function toggleLanguage() {
    setLanguage(currentLang === 'vi' ? 'en' : 'vi');
}

/**
 * Lấy ngôn ngữ hiện tại
 */
function getCurrentLang() {
    return currentLang;
}

/**
 * Lấy danh sách ngôn ngữ hỗ trợ
 */
function getSupportedLanguages() {
    return [
        { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
        { code: 'en', name: 'English', flag: '🇬🇧' }
    ];
}

// Export
window.i18n = {
    init: initI18n,
    t,
    setLanguage,
    toggleLanguage,
    getCurrentLang,
    getSupportedLanguages,
    translations
};

// Auto-init khi DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initI18n);
} else {
    initI18n();
}
