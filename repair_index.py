import os

index_path = "/Users/mac/mekong-cli/FnB-Container-Caffe/index.html"

# Read index.html
with open(index_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Restore complete head structure
# Let's replace the broken head section with a fully restored, physically accurate premium head.
header_search = """<!DOCTYPE html>
<html lang="vi">
<head>"""

# If top is missing, we can reconstruct it from the first link/meta element we see
# We see in index.html line 1 starts with nothing, then we have <meta property="og:image"...
broken_head_prefix = """    <meta property="og:image" content="https://sadec-marketing-hub-files.s3.ap-southeast-1.amazonaws.com/aura/aura-space-og.jpg">"""

restored_head = """<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AURA CAFE — Rooftop Container Café | Sa Đéc</title>
    <meta name="description" content="AURA CAFE — Specialty coffee, rooftop container café với không gian industrial-luxury tại 27 Nguyễn Tất Thành, Sa Đéc, Đồng Tháp.">
    <meta name="keywords" content="cà phê sa đéc, quán cafe sa đéc, quán cafe rooftop, aura space sa đéc, rooftop cafe đồng tháp, specialty coffee">
    <meta property="og:title" content="AURA CAFE — Rooftop Container Café | Sa Đéc">
    <meta property="og:description" content="Specialty coffee, rooftop container café với không gian industrial-luxury tại 27 Nguyễn Tất Thành, Sa Đéc, Đồng Tháp.">
    <meta property="og:type" content="website">
    <meta property="og:image" content="https://sadec-marketing-hub-files.s3.ap-southeast-1.amazonaws.com/aura/aura-space-og.jpg">
    <meta name="theme-color" content="#1A1A2E">

    <link rel="preload" as="image" href="assets/brand/fnb_water_logo.png" fetchpriority="high">
    <link rel="preload" as="style" href="css/brand-tokens.css">
    <link rel="preload" as="style" href="css/hero-v8-bazi.css">
    <link rel="preload" as="style" href="css/spaces-showcase.css">

    <!-- preconnect to font servers -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

    <!-- preload critical font files (WOFF2 format) -->
    <link rel="preload" href="https://fonts.gstatic.com/s/cormorantgaramond/v16/co3bmW5slhv3kqkk9yQStepq297QT_w.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="https://fonts.gstatic.com/s/spacegrotesk/v13/V8mQoQDjQSkFsp0FOBQYElyycToq5A.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="https://fonts.gstatic.com/s/jetbrainsmono/v18/tGLy8u1col2tc7b9_93AMsS8fknP-asG.woff2" as="font" type="font/woff2" crossorigin>

    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/brand-tokens.css">
    <link rel="stylesheet" href="css/hero-v8-bazi.css">
    <link rel="stylesheet" href="css/ui-polish-v5.css">
    <link rel="stylesheet" href="css/premium-upgrade.css">
    <link rel="stylesheet" href="css/mobile-responsive-v5.css">
    <link rel="stylesheet" href="css/spaces-showcase.css">
    <link rel="icon" href="assets/brand/favicon.svg" type="image/svg+xml">

    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "CafeOrCoffeeShop",
      "name": "AURA CAFE",
      "description": "Premium 2-story container coffee shop in Sa Dec with specialty coffee, high-end design, and panoramic view.",
      "image": "https://fnb-caffe-container.pages.dev/assets/brand/fnb_water_logo.png",
      "url": "https://fnb-caffe-container.pages.dev",
      "telephone": "+84-946-013-633",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "27 Nguyễn Tất Thành, Phường 1",
        "addressLocality": "Sa Đéc",
        "addressRegion": "Đồng Tháp",
        "addressCountry": "VN"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 10.289465,
        "longitude": 105.762950
      },
      "openingHoursSpecification": [{
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
        "opens": "07:00",
        "closes": "23:00"
      }],
      "priceRange": "₫₫",
      "servesCuisine": ["Coffee","Tea","Beverages","Light Food"],
      "amenityFeature": [
        {"@type": "LocationFeatureSpecification", "name": "Rooftop", "value": true},
        {"@type": "LocationFeatureSpecification", "name": "WiFi", "value": true},
        {"@type": "LocationFeatureSpecification", "name": "Outdoor Seating", "value": true}
      ]
    }
    </script>"""

# If file starts with whitespace, find index of '<meta property="og:image"' and replace everything up to that with restored_head
if broken_head_prefix in content:
    idx = content.find(broken_head_prefix)
    content = restored_head + "\n" + content[idx:]
    print("Reconstructed index.html head section successfully!")
else:
    print("WARNING: broken_head_prefix not found. Trying fallback replacement...")

# 2. Replace spaces-placeholder with interactive-spaces
placeholder_section = """<section class="spaces-placeholder reveal" id="spaces" aria-label="Không gian trải nghiệm — sắp ra mắt">
    <div class="placeholder-card">
        <div class="placeholder-icon" aria-hidden="true">🏛️</div>
        <p class="placeholder-label">KHÔNG GIAN TRẢI NGHIỆM</p>
        <h3>Khám Phá 5 Khu Vực</h3>
        <p>Từ quầy bar đến rooftop — mỗi không gian là một câu chuyện riêng. Chi tiết và hình ảnh sẽ được cập nhật khi quán hoàn thiện thi công.</p>
        <span class="badge">Coming Soon</span>
    </div>
</section>"""

interactive_spaces_section = """<section class="interactive-spaces reveal" id="spaces" aria-label="Không gian trải nghiệm AURA CAFE">
    <div class="spaces-container">
        <div class="spaces-header">
            <p class="spaces-label">🏛️ THIẾT KẾ ĐỘC BẢN</p>
            <h2 class="spaces-title">Không Gian Trải Nghiệm 100X Premium</h2>
            <p class="spaces-subtitle">Khám phá 5 phân khu kiến trúc container độc đáo với cấu trúc 2 tầng xếp chồng tinh tế, vật liệu kính cường lực và thép nguyên khối sang trọng.</p>
        </div>

        <div class="spaces-tabs" role="tablist">
            <button class="space-tab-btn active" role="tab" aria-selected="true" aria-controls="pane-1" id="tab-1">Tầng Trệt — The Bar</button>
            <button class="space-tab-btn" role="tab" aria-selected="false" aria-controls="pane-2" id="tab-2">Tầng Hai — Social Lounge</button>
            <button class="space-tab-btn" role="tab" aria-selected="false" aria-controls="pane-3" id="tab-3">Rooftop — Container Deck</button>
            <button class="space-tab-btn" role="tab" aria-selected="false" aria-controls="pane-4" id="tab-4">Rooftop Garden — Sunset</button>
            <button class="space-tab-btn" role="tab" aria-selected="false" aria-controls="pane-5" id="tab-5">VIP Room — Glass Pod</button>
        </div>

        <!-- Zone 1 -->
        <div class="space-pane active" id="pane-1" role="tabpanel" aria-labelledby="tab-1">
            <div class="space-visual">
                <div class="space-visual-placeholder">
                    <div class="space-visual-icon">☕</div>
                    <span class="space-visual-badge">GROUND LEVEL</span>
                </div>
            </div>
            <div class="space-info">
                <h4>Ground Level — The Coffee Bar</h4>
                <p class="space-tagline">Tương Tác & Công Nghiệp</p>
                <p class="space-desc">Quầy pha chế mở hiện đại thiết kế tinh giản bằng bê tông mài nguyên khối kết hợp khung thép không gỉ. Tại đây, bạn sẽ được thưởng lãm trực tiếp nghệ thuật pha chế thủ công từ các Barista và cảm nhận trọn vẹn hương vị espresso lan tỏa.</p>
                <div class="space-specs">
                    <div class="spec-item">
                        <div class="spec-label">Thiết kế</div>
                        <div class="spec-val">Industrial-Chic</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Sức chứa</div>
                        <div class="spec-val">30 khách</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Vật liệu</div>
                        <div class="spec-val">Bê tông mài & Thép</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Trải nghiệm</div>
                        <div class="spec-val">Live Barista Crafting</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Zone 2 -->
        <div class="space-pane" id="pane-2" role="tabpanel" aria-labelledby="tab-2">
            <div class="space-visual">
                <div class="space-visual-placeholder">
                    <div class="space-visual-icon">🛋️</div>
                    <span class="space-visual-badge">2ND LEVEL</span>
                </div>
            </div>
            <div class="space-info">
                <h4>Second Floor — The Social Lounge</h4>
                <p class="space-tagline">Ấm Cúng & Kết Nối</p>
                <p class="space-desc">Được bao quanh bởi những mảng kính cường lực lớn thu trọn ánh sáng tự nhiên. Trang bị bàn làm việc chung dài tiện lợi cùng hệ thống sofa da êm ái, điều hòa mát mẻ mang lại sự tập trung tuyệt đối cho học tập và làm việc.</p>
                <div class="space-specs">
                    <div class="spec-item">
                        <div class="spec-label">Không khí</div>
                        <div class="spec-val">Yên tĩnh & Máy lạnh</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Sức chứa</div>
                        <div class="spec-val">45 khách</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Tiện nghi</div>
                        <div class="spec-val">Trạm sạc & High-speed Wifi</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Phù hợp</div>
                        <div class="spec-val">Co-working & Study</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Zone 3 -->
        <div class="space-pane" id="pane-3" role="tabpanel" aria-labelledby="tab-3">
            <div class="space-visual">
                <div class="space-visual-placeholder">
                    <div class="space-visual-icon">🚢</div>
                    <span class="space-visual-badge">ROOFTOP DECK</span>
                </div>
            </div>
            <div class="space-info">
                <h4>Rooftop — The Container Deck</h4>
                <p class="space-tagline">Kiến Trúc Độc Bản</p>
                <p class="space-desc">Điểm nhấn đỉnh cao với hai khối container giật cấp chồng lên nhau tạo không gian 3D ấn tượng. Lan can thép ngoài trời mở ra tầm nhìn toàn cảnh 360 độ ngắm toàn thành phố Sa Đéc hoa lệ lung linh về đêm từ trên cao.</p>
                <div class="space-specs">
                    <div class="spec-item">
                        <div class="spec-label">Độ cao</div>
                        <div class="spec-val">12 mét so với mặt đất</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Sức chứa</div>
                        <div class="spec-val">50 khách</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Kiến trúc</div>
                        <div class="spec-val">Container giật cấp</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Tầm nhìn</div>
                        <div class="spec-val">Panorama 360° Sa Đéc</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Zone 4 -->
        <div class="space-pane" id="pane-4" role="tabpanel" aria-labelledby="tab-4">
            <div class="space-visual">
                <div class="space-visual-placeholder">
                    <div class="space-visual-icon">🍃</div>
                    <span class="space-visual-badge">ROOFTOP GARDEN</span>
                </div>
            </div>
            <div class="space-info">
                <h4>Rooftop Garden — The Sunset Zone</h4>
                <p class="space-tagline">Thiên Nhiên & Lộng Gió</p>
                <p class="space-desc">Mảng xanh nhiệt đới yên bình được bài trí khéo léo kết hợp xích đu gỗ phong cách. Nơi lý tưởng để đón những làn gió mát rượi, thưởng thức trà hoa thơm lành và bắt trọn khoảnh khắc hoàng hôn lãng mạn bên góc ảnh check-in đắt giá.</p>
                <div class="space-specs">
                    <div class="spec-item">
                        <div class="spec-label">Cảnh quan</div>
                        <div class="spec-val">Vườn nhiệt đới ngoài trời</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Sức chứa</div>
                        <div class="spec-val">25 khách</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Thời điểm vàng</div>
                        <div class="spec-val">17:00 - 18:30 (Hoàng hôn)</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Đặc trưng</div>
                        <div class="spec-val">Xích đu check-in cực chill</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Zone 5 -->
        <div class="space-pane" id="pane-5" role="tabpanel" aria-labelledby="tab-5">
            <div class="space-visual">
                <div class="space-visual-placeholder">
                    <div class="space-visual-icon">💎</div>
                    <span class="space-visual-badge">VIP POD</span>
                </div>
            </div>
            <div class="space-info">
                <h4>Aura VIP Room — The Glass Pod</h4>
                <p class="space-tagline">Riêng Tư & Đẳng Cấp</p>
                <p class="space-desc">Phòng kính cách âm tuyệt đối được bao bọc bởi kính 2 lớp cao cấp. Trang bị hệ thống điều hòa độc lập, màn hình trình chiếu thông minh và bàn họp tiêu chuẩn, đáp ứng hoàn hảo nhu cầu hội họp riêng tư hoặc kỷ niệm sự kiện đặc biệt.</p>
                <div class="space-specs">
                    <div class="spec-item">
                        <div class="spec-label">Loại phòng</div>
                        <div class="spec-val">Kính cách âm VIP</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Sức chứa</div>
                        <div class="spec-val">12 khách</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Thiết bị</div>
                        <div class="spec-val">Máy chiếu & Điều hòa riêng</div>
                    </div>
                    <div class="spec-item">
                        <div class="spec-label">Dịch vụ</div>
                        <div class="spec-val">Phục vụ tại phòng</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>"""

# Normalise newlines to ensure clean matches
content_norm = content.replace('\r\n', '\n')
placeholder_norm = placeholder_section.replace('\r\n', '\n')

if placeholder_norm in content_norm:
    content_norm = content_norm.replace(placeholder_norm, interactive_spaces_section)
    print("Replaced spaces placeholder successfully!")
else:
    print("WARNING: spaces-placeholder section not found in normalized content. Let's do fallback search...")
    # fallback search with simple tag matching
    start_tag = '<section class="spaces-placeholder'
    end_tag = '</section>'
    idx_start = content_norm.find(start_tag)
    if idx_start != -1:
        idx_end = content_norm.find(end_tag, idx_start)
        if idx_end != -1:
            full_block = content_norm[idx_start:idx_end + len(end_tag)]
            content_norm = content_norm.replace(full_block, interactive_spaces_section)
            print("Fallback replaced spaces block successfully!")

# 3. Add JS script for spaces showcase at the end
script_search = """})();
</script>
</body>
</html>"""

script_replacement = """})();

// ══ INTERACTIVE 5-ZONE SHOWCASE CONTROLLER ══
document.addEventListener('DOMContentLoaded', function() {
  const tabs = document.querySelectorAll('.space-tab-btn');
  const panes = document.querySelectorAll('.space-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Deactivate all tabs and panes
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      panes.forEach(p => p.classList.remove('active'));

      // Activate clicked tab
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      // Show targeted pane
      const targetId = tab.getAttribute('aria-controls');
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });
});
</script>
</body>
</html>"""

if script_search in content_norm:
    content_norm = content_norm.replace(script_search, script_replacement)
    print("Appended showcase script successfully!")
else:
    # Try with single script tags
    print("WARNING: script_search not found exactly. Trying fallback script replacement...")
    idx_end = content_norm.rfind('</script>')
    if idx_end != -1:
        # insert just before </script>
        content_norm = content_norm[:idx_end] + """
// ══ INTERACTIVE 5-ZONE SHOWCASE CONTROLLER ══
document.addEventListener('DOMContentLoaded', function() {
  const tabs = document.querySelectorAll('.space-tab-btn');
  const panes = document.querySelectorAll('.space-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Deactivate all tabs and panes
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      panes.forEach(p => p.classList.remove('active'));

      // Activate clicked tab
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      // Show targeted pane
      const targetId = tab.getAttribute('aria-controls');
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });
});
""" + content_norm[idx_end:]
        print("Fallback appended showcase script successfully!")

# Write output back to index.html
with open(index_path, 'w', encoding='utf-8') as f:
    f.write(content_norm)

print("index.html fully repaired and updated!")
