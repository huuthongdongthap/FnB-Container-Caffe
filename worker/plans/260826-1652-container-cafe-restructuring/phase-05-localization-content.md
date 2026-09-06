# Phase 5: Sa Đéc Localization & Content

**Duration:** Week 5  
**Owner:** Content + Frontend Team  
**Dependencies:** Phase 2 (i18n infrastructure), Phase 3 (pages use i18n keys)

---

## 5.1 i18n Content Model

### File Structure
```
src/locales/
├── vi.json                    # Vietnamese (primary)
├── en.json                    # English (fallback)
├── sa-dec/
│   ├── vi.json                # Sa Đéc specific overrides
│   └── en.json                # Sa Đéc English
├── menus/
│   ├── vi.json                # Menu items (vi)
│   └── en.json                # Menu items (en)
└── zones/
    ├── vi.json                # Zone descriptions (vi)
    └── en.json                # Zone descriptions (en)
```

### Core Brand Content (vi.json)
```json
{
  "brand": {
    "name": "AURA CAFE",
    "tagline": "Nghệ Thuật Của Ly Đổ Đêm",
    "taglineShort": "Container Bản Địa",
    "address": "39 Nguyễn Tất Thành, Phường 2, Sa Đéc, Đồng Tháp",
    "phone": "+84 277 382 XXXX",
    "email": "hello@auracafe.vn",
    "hours": "06:00 - 23:00",
    "coordinates": { "lat": 10.2934, "lng": 105.7589 },
    "story": {
      "title": "Câu Chuyện AURA",
      "lead": "Từ một container cũ, chúng tôi tạo ra không gian cà phê đặc trưng tại tim Sa Đéc.",
      "philosophy": "Cà phê ngon giá bình dân — Không gian mộc mạc — Công nghệ tiện lợi"
    }
  },
  "nav": {
    "menu": "Thực Đơn",
    "about": "Câu Chuyện",
    "loyalty": "Thành Viên",
    "reserve": "Đặt Chỗ",
    "track": "Theo Dõi Đơn",
    "events": "Sự Kiện",
    "promotions": "Ưu Đãi",
    "contact": "Liên Hệ",
    "login": "Đăng Nhập",
    "cart": "Giỏ Hàng"
  },
  "common": {
    "loading": "Đang tải...",
    "error": "Có lỗi xảy ra",
    "retry": "Thử lại",
    "confirm": "Xác nhận",
    "cancel": "Hủy",
    "save": "Lưu",
    "delete": "Xóa",
    "edit": "Sửa",
    "view": "Xem",
    "search": "Tìm kiếm",
    "filter": "Lọc",
    "sort": "Sắp xếp",
    "clear": "Xóa lọc",
    "apply": "Áp dụng",
    "next": "Tiếp theo",
    "previous": "Quay lại",
    "close": "Đóng",
    "open": "Mở",
    "yes": "Có",
    "no": "Không",
    "ok": "OK",
    "back": "Quay lại",
    "continue": "Tiếp tục",
    "finish": "Hoàn tất",
    "skip": "Bỏ qua",
    "later": "Sau",
    "never": "Không bao giờ",
    "always": "Luôn luôn",
    "sometimes": "Đôi khi",
    "required": "Bắt buộc",
    "optional": "Tùy chọn",
    "select": "Chọn",
    "selectAll": "Chọn tất cả",
    "deselectAll": "Bỏ chọn tất cả",
    "noResults": "Không tìm thấy kết quả",
    "noData": "Chưa có dữ liệu",
    "emptyState": "Trống",
    "comingSoon": "Sắp ra mắt",
    "underMaintenance": "Đang bảo trì",
    "unauthorized": "Chưa đăng nhập",
    "forbidden": "Không có quyền truy cập",
    "notFound": "Không tìm thấy trang",
    "serverError": "Lỗi máy chủ",
    "networkError": "Lỗi kết nối",
    "timeout": "Hết thời gian chờ",
    "tryAgainLater": "Vui lòng thử lại sau"
  }
}
```

### Menu Content (menus/vi.json)
```json
{
  "categories": [
    {
      "id": "ca-phe-ban-dia",
      "name": "Cà Phê Bản Địa",
      "description": "Cà phê Robusta Cao Lãnh, Arabica Đà Lạt - rang xay thủ công",
      "icon": "coffee",
      "sortOrder": 1,
      "isLocalSpecialty": true
    },
    {
      "id": "tra-suc-khoe",
      "name": "Trà & Sức Khỏe",
      "description": "Trà ô long Sa Đéc, trà thanh đạm, nước ép trái cây tươi",
      "icon": "local_drink",
      "sortOrder": 2,
      "isLocalSpecialty": true
    },
    {
      "id": "banh-moc-mac",
      "name": "Bánh Mộc Mạc",
      "description": "Bánh mì(container), bánh bông lan, croissant bơ thanh đạm",
      "icon": "bakery_dining",
      "sortOrder": 3,
      "isLocalSpecialty": false
    },
    {
      "id": "do-uong-dac-biet",
      "name": "Đồ Uống Đặc Biệt",
      "description": "Signature drinks chỉ có tại AURA CAFE Sa Đéc",
      "icon": "auto_awesome",
      "sortOrder": 4,
      "isLocalSpecialty": true
    }
  ],
  "items": [
    {
      "id": "midnight-espresso",
      "categoryId": "ca-phe-ban-dia",
      "name": "Midnight Espresso",
      "description": "Espresso đậm đà từ Robusta Cao Lãnh, crema mỏng tanh, hậu vị cacao đen",
      "price": 45000,
      "image": "midnight-espresso.jpg",
      "tags": ["signature", "caffeine-high", "local-bean"],
      "isLocalSpecialty": true,
      "ingredientSource": "local",
      "story": "Hạt Robusta từ vườn 30 năm tuổi tại Cao Lãnh, rang trung bình giữ nguyên vị đắng hậu ngọt tự nhiên.",
      "allergens": [],
      "nutrition": { "calories": 5, "caffeine": 120 }
    },
    {
      "id": "chrome-velvet-latte",
      "categoryId": "ca-phe-ban-dia",
      "name": "Chrome Velvet Latte",
      "description": "Espresso + sữa tươi organic + syrup vanille handcrafted, foam mịn như nhung",
      "price": 55000,
      "image": "chrome-velvet-latte.jpg",
      "tags": ["signature", "milk-based", "sweet"],
      "isLocalSpecialty": false,
      "ingredientSource": "mixed",
      "story": "Kết hợp hạt Arabica Đà Lạt với sữa tươi từ trang trại Đà Lạt, vanille tự làm từ quả vanille Madagascar.",
      "allergens": ["milk"],
      "nutrition": { "calories": 180, "caffeine": 90 }
    },
    {
      "id": "sa-dec-oolong",
      "categoryId": "tra-suc-khoe",
      "name": "Trà Ô Long Sa Đéc",
      "description": "Ô long cao cấp từ vườn trà Sa Đéc, hương hoa lan, vị ngọt tự nhiên",
      "price": 40000,
      "image": "sa-dec-oolong.jpg",
      "tags": ["tea", "local", "no-caffeine-option"],
      "isLocalSpecialty": true,
      "ingredientSource": "local",
      "story": "Trà ô long trồng tại Sa Đéc theo phương pháp truyền thống, hái thủ công chỉ lấy ngọn non.",
      "allergens": [],
      "nutrition": { "calories": 0, "caffeine": 30 }
    }
  ]
}
```

### Zone Content (zones/vi.json)
> **Image convention:** the `image` field stores the **stem** only (e.g. `zone-brew-bar`); on-disk files are `{stem}-640.webp / -1024.webp / -1920.webp` (see Imagery Manifest §5.2). The renderer composes the responsive srcset from the stem — never store a full filename here.

```json
{
  "zones": [
    {
      "id": "bar",
      "name": "Quầy Pha Chế",
      "description": "Ngắm nhìn quy trình pha chế thủ công, trò chuyện với barista",
      "capacity": 8,
      "features": ["power-outlets", "wifi", "barista-view"],
      "vibe": "energetic",
      "image": "zone-brew-bar",
      "sortOrder": 1
    },
    {
      "id": "rooftop",
      "name": "Sân Thượng",
      "description": "Không gian mở thoáng đãng, nhìn ra sông Sa Đéc, lý tưởng chiều tối",
      "capacity": 30,
      "features": ["sunset-view", "river-view", "outdoor", "pet-friendly"],
      "vibe": "relaxed",
      "image": "zone-courtyard-mezzanine", // TODO(replace): stand-in — awaiting dedicated rooftop photo
      "sortOrder": 2
    },
    {
      "id": "quiet",
      "name": "Góc Yên Tĩnh",
      "description": "Khu vực riêng biệt, ít tiếng ồn, phù hợp làm việc, đọc sách",
      "capacity": 12,
      "features": ["quiet", "power-outlets", "wifi", "bookshelf", "dim-light"],
      "vibe": "focused",
      "image": "zone-private-room", // TODO(replace): stand-in — awaiting quiet-zone photo
      "sortOrder": 3
    },
    {
      "id": "sofa",
      "name": "Khu Sofa",
      "description": "Ghế sofa êm ái, bàn thấp, không gian chill ngập bàn ghế",
      "capacity": 20,
      "features": ["comfortable", "group-friendly", "board-games"],
      "vibe": "social",
      "image": "zone-communal-table",
      "sortOrder": 4
    },
    {
      "id": "private",
      "name": "Phòng Riêng",
      "description": "Phòng kín隔音, phù hợp sinh nhật, họp nhóm, sự kiện nhỏ",
      "capacity": 10,
      "features": ["private", "soundproof", "projector", "whiteboard", "ac"],
      "vibe": "exclusive",
      "image": "zone-private-room",
      "sortOrder": 5
    }
  ]
}
```

---

## 5.2 Local Imagery Strategy

**Visual direction:** BRIGHT RUSTIC (AURA v6.1 Rustic Light) — warm lime-wash surfaces, forest green + container blue accents, wood amber warmth. All imagery is shot/processed from real Sa Đéc cafe photos (IMG_6790–6796). Overlay tints on photos use **warm charcoal `rgba(43,43,38,x)`**, NOT navy/dark-noir tints.

### Image Assets Required
> Hero & zone slots below are ALREADY PROCESSED on disk (see Imagery Manifest). Menu/story/values placeholders remain pending shoot.

```
/public/images/
├── hero/
│   ├── hero-container-front-{640,1024,1920}.webp    # ✅ DONE — front bar w/ banner (IMG_6795)
│   └── hero-patio-seating-{640,1024,1920}.webp      # ✅ DONE — covered patio (IMG_6790)
├── zones/
│   ├── zone-brew-bar-{640,1024,1920}.webp            # ✅ DONE — blue bar counter (IMG_6792)
│   ├── zone-courtyard-mezzanine-{640,1024,1920}.webp # ⚠️ STAND-IN for "rooftop" — awaiting dedicated rooftop photo (source: IMG_6791)
│   ├── zone-communal-table-{640,1024,1920}.webp      # ✅ DONE — long wooden table (IMG_6796)
│   └── zone-private-room-{640,1024,1920}.webp        # ⚠️ STAND-IN for "quiet" & "private" — awaiting dedicated photos (source: IMG_6794)
├── menu/
│   ├── midnight-espresso.jpg
│   ├── chrome-velvet-latte.jpg
│   ├── sa-dec-oolong.jpg
│   ├── smoked-truffle-croissant.jpg
│   ├── bronze-chai.jpg
│   └── industrial-cold-brew.jpg
├── story/
│   ├── container-concept.jpg              # Container architecture concept
│   ├── qr-ordering.jpg                    # QR ordering in action
│   ├── intimate-experience.jpg            # Close-up guest experience
│   ├── phase-01-2022.jpg                  # Founding vision
│   ├── phase-02-2023.jpg                  # First container
│   ├── phase-03-2024.jpg                  # Full menu launch
│   ├── phase-04-2025.jpg                  # Loyalty + mobile
│   └── phase-05-2026.jpg                  # Sa Đéc flagship
├── values/
│   ├── good-coffee-fair-price.jpg
│   ├── rustic-space.jpg
│   └── handy-tech.jpg
└── brand/
    ├── logo-full.svg
    ├── logo-mark.svg
    ├── logo-wordmark.svg
    └── favicon.ico
```

### Image Optimization
- **Format:** WebP q80 (primary), AVIF optional later; original HEICs kept in `assets/ảnh mới/`
- **Responsive srcset:** `640w` mobile / `1024w` tablet / `1920w` desktop — one `<img>` with `srcset="...-640.webp 640w, ...-1024.webp 1024w, ...-1920.webp 1920w"`
- **sizes attr guidance:**
  - Hero full-bleed: `sizes="100vw"`
  - Zone cards in grid: `sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"`
- **Loading strategy:** Hero images → `loading="eager"` + `fetchpriority="high"` + `<link rel="preload" as="image">` for the 1920w hero variant (LCP). Zone images → `loading="lazy"` + `decoding="async"`.
- **Blur placeholders:** 20px blurred base64 for LCP images
- **Overlay tints:** warm charcoal `rgba(43,43,38,0.4)` for text-legibility scrims over photos (bright-rustic direction); never navy/dark-noir tints

### Imagery Manifest (18 processed files — on disk)

Source photos: real Sa Đéc cafe (IMG_6790–6796). All WebP q80, 3 sizes each (`-640`, `-1024`, `-1920`). Variable names remain `--aura-*`; visual direction is AURA v6.1 Rustic Light.

| # | File base | Source photo | Semantic role / slot |
|---|-----------|--------------|----------------------|
| 1–3 | `public/images/hero/hero-container-front-{640,1024,1920}.webp` | IMG_6795 | Homepage LCP hero — container front bar with AURA banner |
| 4–6 | `public/images/hero/hero-patio-seating-{640,1024,1920}.webp` | IMG_6790 | Secondary hero / about-page banner — covered patio seating |
| 7–9 | `public/images/zones/zone-brew-bar-{640,1024,1920}.webp` | IMG_6792 | Zone card "bar" (Quầy Pha Chế) — blue brew-bar counter |
| 10–12 | `public/images/zones/zone-courtyard-mezzanine-{640,1024,1920}.webp` | IMG_6791 | Zone card "courtyard/mezzanine" — staircase + railings |
| 13–15 | `public/images/zones/zone-communal-table-{640,1024,1920}.webp` | IMG_6796 | Zone card "sofa/social" (Khu Sofa / không gian chung) — long wooden communal table |
| 16–18 | `public/images/zones/zone-private-room-{640,1024,1920}.webp` | IMG_6794 | Zone card "private" (Phòng Riêng) — two-story structure + glass room |

**Alt text (vi):**

| Image | alt |
|-------|-----|
| hero-container-front | "Mặt tiền quán cà phê container AURA với quầy bar và banner thương hiệu tại Sa Đéc" |
| hero-patio-seating | "Khu vực ngồi sân sau có mái che với cây xanh và bàn gỗ tại AURA CAFE" |
| zone-brew-bar | "Quầy pha chế màu xanh dương với barista đang pha cà phê thủ công" |
| zone-courtyard-mezzanine | "Cầu thang và lan can sân trong với tường sơn vôi màu xanh nhạt" |
| zone-communal-table | "Bàn gỗ dài chung cho nhóm bạn tụ tập tại khu vực sân trong" |
| zone-private-room | "Không gian hai tầng với phòng kính riêng tư dành cho sự kiện nhỏ" |

**srcset example (hero, eager/preloaded):**
```html
<link rel="preload" as="image" href="/images/hero/hero-container-front-1920.webp"
      media="(min-width: 1024px)" fetchpriority="high">
<img src="/images/hero/hero-container-front-1024.webp"
     srcset="/images/hero/hero-container-front-640.webp 640w,
             /images/hero/hero-container-front-1024.webp 1024w,
             /images/hero/hero-container-front-1920.webp 1920w"
     sizes="100vw" loading="eager" fetchpriority="high"
     alt="Mặt tiền quán cà phê container AURA với quầy bar và banner thương hiệu tại Sa Đéc">
```

**Zone card pattern:** same srcset triple, `loading="lazy" decoding="async"`, grid `sizes` attr per above, scrim overlay `bg-[rgba(43,43,38,0.4)]` only behind text labels (solid warm surfaces default per v6.1; glassmorphism demoted).

**Pending shoot (placeholders until then):** menu/, story/, values/, brand/ trees above remain placeholders — do not block Phase 5 completion on them.

---

## 5.3 Vietnamese Diacritic-Safe Slugs

### Slug Generation Utility
```typescript
// src/utils/slugify.ts
const VIETNAMESE_MAP: Record<string, string> = {
  'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
  'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
  'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
  'đ': 'd',
  'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
  'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
  'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
  'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
  'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
  'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
  'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
  'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
  'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
  'À': 'A', 'Á': 'A', 'Ả': 'A', 'Ã': 'A', 'Ạ': 'A',
  'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ẳ': 'A', 'Ẵ': 'A', 'Ặ': 'A',
  'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 'Ậ': 'A',
  'Đ': 'D',
  'È': 'E', 'É': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ẹ': 'E',
  'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ể': 'E', 'Ễ': 'E', 'Ệ': 'E',
  'Ì': 'I', 'Í': 'I', 'Ỉ': 'I', 'Ĩ': 'I', 'Ị': 'I',
  'Ò': 'O', 'Ó': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ọ': 'O',
  'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ổ': 'O', 'Ỗ': 'O', 'Ộ': 'O',
  'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ở': 'O', 'Ỡ': 'O', 'Ợ': 'O',
  'Ù': 'U', 'Ú': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ụ': 'U',
  'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ử': 'U', 'Ữ': 'U', 'Ự': 'U',
  'Ỳ': 'Y', 'Ý': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y', 'Ỵ': 'Y',
};

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .map(char => VIETNAMESE_MAP[char] || char)
    .join('')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Usage: slugify('Cà Phê Bản Địa') → 'ca-phe-ban-dia'
```

### URL Patterns with Slugs
```
/menu/ca-phe-ban-dia           # Category page
/menu/midnight-espresso        # Item detail
/reserve/khu-sofa              # Zone-specific reservation
/track/ORD-2847                # Order tracking (order ID)
```

---

## 5.4 Local Content Integration

### Menu Items with Local Stories
```typescript
// src/components/aura/patterns/MenuItemCard.tsx
import { useTranslation } from 'react-i18next';

interface MenuItemCardProps {
  item: MenuItem; // From menus/vi.json + menus/en.json
}

export function MenuItemCard({ item }: MenuItemCardProps) {
  const { t, i18n } = useTranslation('menus');
  const isVi = i18n.language === 'vi';
  
  const name = isVi ? item.name : item.nameEn || item.name;
  const description = isVi ? item.description : item.descriptionEn || item.description;
  const story = isVi ? item.story : item.storyEn || item.story;
  
  return (
    <Card variant="interactive" padding="md" className="group">
      <div className="relative aspect-[4/3] rounded-lg overflow-hidden mb-3">
        <img 
          src={`/images/menu/${item.image}`} 
          alt={name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {item.isLocalSpecialty && (
          <Badge variant="forest" className="absolute top-2 left-2">
            <Icon name="auto_awesome" size={12} /> Đặc sản Sa Đéc
          </Badge>
        )}
      </div>
      <div className="flex justify-between items-start gap-2">
        <div>
          <h3 className="font-display text-body-lg font-semibold text-text-primary">
            {name}
          </h3>
          <p className="font-body text-body-sm text-text-muted mt-1 line-clamp-2">
            {description}
          </p>
        </div>
        <span className="font-display text-body-lg font-bold text-primary whitespace-nowrap">
          {formatCurrency(item.price)}
        </span>
      </div>
      {story && (
        <details className="mt-3 group-open:animate-fade-in">
          <summary className="font-label-caps text-label-caps text-text-muted cursor-pointer flex items-center gap-1">
            <Icon name="expand_more" size={16} className="transition-transform group-open:rotate-180" />
            Câu chuyện món này
          </summary>
          <p className="font-body text-body-sm text-text-secondary mt-2">{story}</p>
        </details>
      )}
      <div className="flex items-center gap-2 mt-3">
        {item.tags.map(tag => (
          <Chip key={tag} variant="label" size="sm" className="opacity-70">
            {t(`menu.tags.${tag}`)}
          </Chip>
        ))}
      </div>
    </Card>
  );
}
```

### Zone Picker for Reservation
```typescript
// src/components/aura/patterns/ZonePicker.tsx
import { useTranslation } from 'react-i18next';

interface ZonePickerProps {
  selectedZone: string;
  onSelect: (zoneId: string) => void;
  zones: Zone[]; // From zones/vi.json
}

export function ZonePicker({ selectedZone, onSelect, zones }: ZonePickerProps) {
  const { t, i18n } = useTranslation('zones');
  const isVi = i18n.language === 'vi';
  
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {zones.map(zone => (
        <Card 
          key={zone.id}
          variant={selectedZone === zone.id ? 'elevated' : 'interactive'}
          border={selectedZone === zone.id ? 'forest' : 'default'}
          onClick={() => onSelect(zone.id)}
          className="relative"
        >
          <div className="relative aspect-[4/3] rounded-t-lg overflow-hidden">
            {/* zone.image stores the stem; renderer composes the responsive srcset
                from on-disk variants {stem}-640/-1024/-1920.webp (see §5.2 manifest) */}
            <img
              src={`/images/zones/${zone.image}-1024.webp`}
              srcSet={`/images/zones/${zone.image}-640.webp 640w,
                       /images/zones/${zone.image}-1024.webp 1024w,
                       /images/zones/${zone.image}-1920.webp 1920w`}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              alt={isVi ? zone.name : zone.nameEn}
              loading="lazy" decoding="async"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(43,43,38,0.55)] to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <h3 className="font-display text-body-lg font-semibold text-white">
                {isVi ? zone.name : zone.nameEn}
              </h3>
              <p className="font-body text-body-sm text-white/80 mt-1 line-clamp-1">
                {isVi ? zone.description : zone.descriptionEn}
              </p>
            </div>
          </div>
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2 text-text-muted text-body-sm">
              <Icon name="event_seat" size={16} />
              <span>{zone.capacity} chỗ</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {zone.features.map(feature => (
                <Chip key={feature} variant="label" size="xs">
                  {t(`zones.features.${feature}`)}
                </Chip>
              ))}
            </div>
          </div>
          {selectedZone === zone.id && (
            <div className="absolute inset-0 border-2 border-forest rounded-lg pointer-events-none" />
          )}
        </Card>
      ))}
    </div>
  );
}
```

---

## 5.5 i18n Configuration

### React-i18next Setup
```typescript
// src/lib/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

// Core namespaces
import viCommon from '@/locales/vi.json';
import enCommon from '@/locales/en.json';
import viMenus from '@/locales/menus/vi.json';
import enMenus from '@/locales/menus/en.json';
import viZones from '@/locales/zones/vi.json';
import enZones from '@/locales/zones/en.json';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'vi',
    supportedLngs: ['vi', 'en'],
    defaultNS: 'common',
    ns: ['common', 'brand', 'nav', 'menus', 'zones', 'auth', 'checkout', 'loyalty', 'admin'],
    
    resources: {
      vi: {
        common: viCommon,
        brand: viCommon.brand,
        nav: viCommon.nav,
        menus: viMenus,
        zones: viZones,
      },
      en: {
        common: enCommon,
        brand: enCommon.brand,
        nav: enCommon.nav,
        menus: enMenus,
        zones: enZones,
      },
    },
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
    
    interpolation: {
      escapeValue: false,
    },
    
    react: {
      useSuspense: false,
    },
  });

export default i18n;
```

### Language Switcher Component
```typescript
// src/components/aura/primitives/LanguageSwitcher.tsx
import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation('common');
  
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          <Icon name={i18n.language === 'vi' ? 'translate' : 'language'} size={18} />
          <span className="font-label-caps text-label-caps">
            {i18n.language === 'vi' ? 'VI' : 'EN'}
          </span>
          <Icon name="expand_more" size={16} />
        </Button>
      </DropdownTrigger>
      <DropdownContent align="end">
        <DropdownItem 
          onClick={() => i18n.changeLanguage('vi')}
          selected={i18n.language === 'vi'}
        >
          <span className="font-body text-body-sm">Tiếng Việt</span>
        </DropdownItem>
        <DropdownItem 
          onClick={() => i18n.changeLanguage('en')}
          selected={i18n.language === 'en'}
        >
          <span className="font-body text-body-sm">English</span>
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}
```

---

## 5.6 CMS Integration (Future-Proof)

### Content API Contract
```typescript
// worker/src/routes/content.ts
import { Hono } from 'hono';

export const contentRoutes = new Hono()
  .get('/menus', async (c) => {
    const locale = c.req.query('locale') || 'vi';
    // Fetch from D1 or CMS
    const menus = await c.env.DB.prepare(`
      SELECT * FROM menu_items 
      WHERE is_active = 1
      ORDER BY category_sort, sort_order
    `).all();
    
    // Transform with localized fields
    return c.json(transformMenus(menus.results, locale));
  })
  .get('/zones', async (c) => {
    const locale = c.req.query('locale') || 'vi';
    const zones = await c.env.DB.prepare(`
      SELECT * FROM zones WHERE is_active = 1 ORDER BY sort_order
    `).all();
    return c.json(transformZones(zones.results, locale));
  })
  .get('/brand', async (c) => {
    const locale = c.req.query('locale') || 'vi';
    const brand = await c.env.DB.prepare(`SELECT * FROM brand_content WHERE locale = ?`).bind(locale).first();
    return c.json(brand);
  });
```

---

## 5.7 Acceptance Criteria

### Content Completeness
- [ ] 100% UI strings externalized to i18n (no hardcoded Vietnamese/English)
- [ ] All menu items have vi/en names, descriptions, stories
- [ ] All zones have vi/en names, descriptions, features
- [ ] Brand story, values, timeline in both languages
- [ ] Error messages, validation messages, toast messages translated

### Technical
- [ ] Language switcher persists choice in localStorage
- [ ] SSR-compatible (no hydration mismatch)
- [ ] Slugs work for Vietnamese diacritics
- [ ] RTL support ready (for future Arabic)
- [ ] Pluralization rules for Vietnamese (no plural) / English

### Imagery
- [ ] All 18 hero/zone images on disk verified (WebP q80, 640/1024/1920) — see Imagery Manifest §5.2
- [ ] Responsive srcset + `sizes` attr per slot type (hero 100vw, zone grid)
- [ ] Hero eager+preload (LCP), zones lazy — loading strategy implemented
- [ ] Blur placeholders for LCP images
- [ ] Alt text vi/en per manifest table; overlay scrims use `rgba(43,43,38,0.4)` charcoal (no navy tints)

### Quality
- [ ] Native Vietnamese speaker review all vi content
- [ ] Native English speaker review all en content
- [ ] Terminology consistency (e.g., "đơn hàng" not "order" in vi)
- [ ] Tone matches brand voice (warm, local, premium-but-accessible)

---

## File Ownership Matrix

| Area | Files | Owner |
|------|-------|-------|
| Core i18n | `src/locales/*.json`, `src/lib/i18n.ts` | Content Team |
| Menu Content | `src/locales/menus/*.json` | Content + Menu Team |
| Zone Content | `src/locales/zones/*.json` | Content + Ops Team |
| Slug Utils | `src/utils/slugify.ts` | Frontend Core |
| Components | `src/components/aura/patterns/*` (localized) | Feature Teams |
| CMS API | `worker/src/routes/content.ts` | Backend |

---

## Rollback Plan
- Feature flag `ENABLE_FULL_I18N` gates new content
- Fallback to hardcoded strings if i18n keys missing
- English always available as fallback language

---

## Next Phase Dependency
Phase 6 (Testing) requires all localized content in place.