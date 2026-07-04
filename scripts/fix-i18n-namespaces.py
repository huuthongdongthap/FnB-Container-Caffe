#!/usr/bin/env python3
"""Add missing namespace translations to locale files."""
import re, json, os, sys
from collections import defaultdict

# Read locale files
with open('src/locales/en.json') as f: en = json.load(f)
with open('src/locales/vi.json') as f: vi = json.load(f)

# Find all namespaced components and their t() keys
namespace_keys = {}
for root, dirs, files in os.walk('src'):
    if 'node_modules' in root or '__tests__' in root: continue
    for f in files:
        if not f.endswith('.tsx'): continue
        fpath = os.path.join(root, f)
        with open(fpath) as fh: content = fh.read()
        ns_match = re.search(r"""useTranslation\(['\"]([\w-]+)['\"]""", content)
        if ns_match:
            ns = ns_match.group(1)
            keys = re.findall(r"""t\(['\"]([\w.]+)['\"]""", content)
            if ns not in namespace_keys:
                namespace_keys[ns] = set()
            for k in keys:
                # Skip keys that exist in default namespace
                if k not in en and k not in vi:
                    namespace_keys[ns].add(k)

# Generate Vietnamese and English translations based on key names
VN_TRANSLATIONS = {
    # Common
    'title': 'Tiêu đề', 'subtitle': 'Phụ đề', 'description': 'Mô tả',
    'loading': 'Đang tải...', 'loadingData': 'Đang tải dữ liệu...',
    'error': 'Lỗi', 'retry': 'Thử lại', 'cancel': 'Hủy', 'save': 'Lưu',
    'delete': 'Xóa', 'close': 'Đóng', 'back': 'Quay lại', 'next': 'Tiếp',
    'search': 'Tìm kiếm', 'noData': 'Không có dữ liệu', 'emptyTitle': 'Trống',
    'confirm': 'Xác nhận', 'count': 'Số lượng', 'total': 'Tổng cộng',
    'name': 'Tên', 'status': 'Trạng thái', 'date': 'Ngày', 'time': 'Giờ',
    'address': 'Địa chỉ', 'phone': 'Số điện thoại', 'email': 'Email',
    'note': 'Ghi chú', 'notes': 'Ghi chú', 'info': 'Thông tin',
    'seoTitle': '', 'seoDescription': '',
    # Dashboard
    'dashboard': 'Bảng điều khiển', 'recentOrders': 'Đơn hàng gần đây',
    'statsTodayRevenue': 'Doanh thu hôm nay', 'statsOrders': 'Đơn hàng',
    'statsCustomers': 'Khách hàng', 'statsAvgOrderValue': 'Giá trị TB đơn',
    'customersCount': 'Số lượng khách', 'ordersCount': 'Số lượng đơn',
    'topCustomers': 'Khách hàng thân thiết', 'topProductError': 'Lỗi sản phẩm',
    'exportCsv': 'Xuất CSV', 'exporting': 'Đang xuất...',
    'customerMetricError': 'Lỗi chỉ số khách hàng',
    'peakHourError': 'Lỗi giờ cao điểm',
    'revenueError': 'Lỗi doanh thu',
    # Checkout
    'luxuryTax': 'Phí xa xỉ', 'deliveryFee': 'Phí giao hàng',
    'variantStandard': 'Tiêu chuẩn', 'failedToCreateOrder': 'Tạo đơn thất bại',
    'paymentLinkFailed': 'Tạo link thanh toán thất bại',
    'order_id': 'Mã đơn', 'payment': 'Thanh toán',
    # Reviews
    'shareExperience': 'Chia sẻ trải nghiệm', 'submitReview': 'Gửi đánh giá',
    'submitting': 'Đang gửi...', 'rateStars': 'Đánh giá sao',
    'rating': 'Đánh giá', 'enterName': 'Nhập tên của bạn',
    'commentOptional': 'Bình luận (không bắt buộc)',
    'commentPlaceholder': 'Chia sẻ cảm nhận của bạn...',
    'closeForm': 'Đóng form', 'previous': 'Trước', 'pageOf': 'Trang {0}/{1}',
    'errorLoadMessage': 'Không thể tải đánh giá',
    # Contact
    'hotline': 'Hotline', 'followUs': 'Theo dõi chúng tôi',
    'sendMessage': 'Gửi tin nhắn', 'feedbackMatters': 'Ý kiến của bạn rất quan trọng',
    'weekdayHours': 'Thứ 2 - Thứ 6: 06:00 - 22:00',
    'weekendHours': 'Thứ 7 - CN: 06:00 - 23:00',
    'breadcrumbHome': 'Trang chủ', 'breadcrumbContact': 'Liên hệ',
    # Track Order
    'orderLabel': 'Mã đơn hàng', 'orderInfo': 'Thông tin đơn hàng',
    'orderDate': 'Ngày đặt', 'customer': 'Khách hàng',
    'items': 'Sản phẩm', 'helper': 'Nhập mã đơn hàng để tra cứu',
    'autoRefresh': 'Tự động làm mới', 'notFound': 'Không tìm thấy',
    'emptyTitle': 'Chưa có đơn hàng', 'emptyDesc': 'Đặt hàng ngay để theo dõi',
    'confirmed': 'Đã xác nhận', 'delivering': 'Đang giao',
    'delivered': 'Đã giao',
    # Events
    'nav.menu': 'Thực đơn', 'nav.spaces': 'Không gian',
    'nav.reservations': 'Đặt bàn', 'nav.events': 'Sự kiện',
    # Event specific
    'events.nocturnalSessions': 'Phiên đêm',
    'events.defaultDescription': 'Khám phá các sự kiện đặc sắc tại AURA CAFE',
    'events.defaultTitle': 'Sự kiện - AURA CAFE',
    # Order failure
    'backToMenu': 'Quay lại thực đơn', 'errorCode': 'Mã lỗi',
    'errorFail': 'Thanh toán thất bại', 'errorReason': 'Lý do',
    'error100': 'Giao dịch bị từ chối',
    'error51': 'Số dư không đủ',
    'error85': 'Hết thời gian chờ',
    'error24': 'Kết nối bị gián đoạn',
    'error99': 'Lỗi không xác định',
    'causeTimeout': 'Phiên thanh toán đã hết hạn',
    'causeNetwork': 'Mất kết nối mạng',
    'causeInsufficientBalance': 'Số dư tài khoản không đủ',
    'causeOtp': 'Sai mã OTP',
    'commonCausesTitle': 'Nguyên nhân thường gặp',
    # Admin
    'addPromotion': 'Thêm khuyến mãi', 'addTitle': 'Thêm mới',
    'colCode': 'Mã', 'colDiscount': 'Giảm giá', 'colLimit': 'Giới hạn',
    'colDate': 'Ngày', 'colUsed': 'Đã dùng', 'colStatus': 'Trạng thái',
    'colActions': 'Thao tác', 'colCustomer': 'Khách hàng',
    'colPlan': 'Gói', 'colPeriod': 'Kỳ hạn', 'colContainer': 'Container',
    'colDeposit': 'Tiền cọc',
    'createFirst': 'Tạo mới', 'confirmDeleteTitle': 'Xác nhận xóa',
    'confirmDeleteMsg': 'Bạn có chắc muốn xóa?',
    'allTiers': 'Tất cả hạng', 'clearFilters': 'Xóa bộ lọc',
    'customerCount': 'Số lượng khách', 'emptyFiltered': 'Không tìm thấy',
    'emptyNoOrders': 'Chưa có đơn hàng',
    'loyal': 'Thân thiết', 'regular': 'Thường xuyên',
    'searchPlaceholder': 'Tìm kiếm...', 'tierFilter': 'Lọc theo hạng',
    # Subscriptions
    'addPlan': 'Thêm gói', 'addPlanTitle': 'Thêm gói mới',
    'billingMonthly': 'Hàng tháng', 'billingQuarterly': 'Hàng quý',
    'billingYearly': 'Hàng năm', 'cancelSub': 'Hủy gói',
    'cancelSubMsg': 'Bạn có chắc muốn hủy gói này?',
    'cancelSubTitle': 'Xác nhận hủy gói',
    # Account
    'notLoggedIn.title': 'Chưa đăng nhập',
    'notLoggedIn.body': 'Đăng nhập để xem thông tin tài khoản',
    'notLoggedIn.cta': 'Đăng nhập ngay',
    'todayWithTime': 'Hôm nay lúc {time}',
    'yesterdayWithTime': 'Hôm qua lúc {time}',
    # Container
    # AdminCustomers
    # AdminPromotions
    # AdminSubscriptions
}

EN_TRANSLATIONS = {
    'loading': 'Loading...', 'loadingData': 'Loading data...',
    'noData': 'No data',
}

def generate_translations(keys, lang):
    """Generate translations for missing keys."""
    result = {}
    translations = VN_TRANSLATIONS if lang == 'vi' else EN_TRANSLATIONS
    for k in sorted(keys):
        # Try direct lookup
        if k in translations:
            result[k] = translations[k]
        else:
            # Generate from key name
            if lang == 'en':
                result[k] = k.split('.')[-1].replace('_', ' ').title()
            else:
                result[k] = k.split('.')[-1].replace('_', ' ')
    return result

# Add namespace entries to locale files
for ns in sorted(namespace_keys.keys()):
    keys = namespace_keys[ns]
    vi_ns = generate_translations(keys, 'vi')
    en_ns = generate_translations(keys, 'en')

    # Filter out empty strings (for seoTitle etc)
    vi_ns = {k: v for k, v in vi_ns.items() if v}
    en_ns = {k: v for k, v in en_ns.items() if v}

    # Add to locale files
    for k, v in vi_ns.items():
        vi[f'{ns}.{k}'] = v
    for k, v in en_ns.items():
        en[f'{ns}.{k}'] = v

    print(f"  {ns}: {len(vi_ns)} VI + {len(en_ns)} EN keys added")

# Write updated locale files
with open('src/locales/vi.json', 'w', encoding='utf-8') as f:
    json.dump(vi, f, ensure_ascii=False, indent=2)
with open('src/locales/en.json', 'w', encoding='utf-8') as f:
    json.dump(en, f, ensure_ascii=False, indent=2)

total_added = sum(len(namespace_keys[ns]) for ns in namespace_keys)
print(f"\n✅ Total: {total_added} keys added across {len(namespace_keys)} namespaces")
print(f"   vi.json: {len(vi)} keys")
print(f"   en.json: {len(en)} keys")
