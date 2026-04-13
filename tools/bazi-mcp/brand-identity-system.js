/**
 * 🎨 BRAND IDENTITY SYSTEM — SINGLE SOURCE OF TRUTH (SSOT)
 * Standard: Global F&B 2026 Agency-Ready
 */

// ═══ 1. Bilingual Terminology (Hoa - Việt) ═══════════════
export const WU_XING_NAME = { '木': 'Mộc (Wood)', '火': 'Hỏa (Fire)', '土': 'Thổ (Earth)', '金': 'Kim (Metal)', '水': 'Thủy (Water)' };
export const WU_XING_VI = { '木': 'Mộc — Wood', '火': 'Hỏa — Fire', '土': 'Thổ — Earth', '金': 'Kim — Metal', '水': 'Thủy — Water' };

export const HEAVENLY_STEMS_VI = {
  '甲': 'Giáp (Dương Mộc)', '乙': 'Ất (Âm Mộc)',
  '丙': 'Bính (Dương Hỏa)', '丁': 'Đinh (Âm Hỏa)',
  '戊': 'Mậu (Dương Thổ)', '己': 'Kỷ (Âm Thổ)',
  '庚': 'Canh (Dương Kim)', '辛': 'Tân (Âm Kim)',
  '壬': 'Nhâm (Dương Thủy)', '癸': 'Quý (Âm Thủy)'
};

export const EARTHLY_BRANCHES_VI = {
  '子': 'Tý (Thủy)', '丑': 'Sửu (Thổ)', '寅': 'Dần (Mộc)', '卯': 'Mão (Mộc)',
  '辰': 'Thìn (Thổ)', '巳': 'Tỵ (Hỏa)', '午': 'Ngọ (Hỏa)', '未': 'Mùi (Thổ)',
  '申': 'Thân (Kim)', '酉': 'Dậu (Kim)', '戌': 'Tuất (Thổ)', '亥': 'Hợi (Thủy)'
};

export const TEN_GODS_VI = {
  '比肩': 'Tỷ Kiên (Friend)', '劫财': 'Kiếp Tài (Robber)',
  '食神': 'Thực Thần (Eating God)', '伤官': 'Thương Quan (Hurting Officer)',
  '正财': 'Chính Tài (Direct Wealth)', '偏财': 'Thiên Tài (Indirect Wealth)',
  '正官': 'Chính Quan (Direct Officer)', '七杀': 'Thất Sát (Seven Killings)',
  '正印': 'Chính Ấn (Direct Resource)', '偏印': 'Thiên Ấn (Indirect Resource)'
};

export const ZODIAC_VI = {
  '鼠': 'Chuột', '牛': 'Trâu', '虎': 'Hổ', '兔': 'Mèo',
  '龙': 'Rồng', '蛇': 'Rắn', '马': 'Ngựa', '羊': 'Dê',
  '猴': 'Khỉ', '鸡': 'Gà', '狗': 'Chó', '猪': 'Heo'
};

export const YIN_YANG_VI = { '阳': 'Dương (+)', '阴': 'Âm (-)' };
export const SHENG_XIAO_EMOJI = {
  '鼠': '🐭', '牛': '🐮', '虎': '🐯', '兔': '🐰', '龙': '🐲', '蛇': '🐍',
  '马': '🐴', '羊': '🐐', '猴': '🐵', '鸡': '🐔', '狗': '🐶', '猪': '🐷'
};

export const SHEN_SHA_VI = {
  '天德': 'Thiên Đức (Heavenly Virtue)', '月德': 'Nguyệt Đức (Monthly Virtue)',
  '天医': 'Thiên Y (Heavenly Doctor)', '文昌': 'Văn Xương (Intelligence)',
  '驿马': 'Dịch Mã (Sky Horse)', '华盖': 'Hoa Cái (Elegant Cover)',
  '将星': 'Tướng Tinh (General Star)', '桃花': 'Đào Hoa (Peach Blossom)',
  '羊刃': 'Dương Nhận (Goat Blade)', '天乙贵人': 'Thiên Ất Quý Nhân (Noble)',
};

// ═══ 2. Design Tokens per Element ═══════════════════════
export const ELEMENT_TOKENS = {
  '水': {
    primary: '#1A1A2E', // Navy Deep
    secondary: '#D4AF37', // Gold Metallic
    surface: '#F5F5F7',
    text: '#121212',
    accent: '#007AFF',
    palette: ['#0A0A1A', '#1A1A2E', '#3D3D5E', '#A0A0C0', '#D4AF37'],
    typography: 'Playfair Display, serif',
    radius: '16px',
    shadow: '0 8px 30px rgba(0,0,0,0.12)',
    description: 'Phong cách Noir Lounge — Huyền bí, Sang trọng, Lưu động.',
  },
  '木': {
    primary: '#1B4D3E', // Forest Green
    secondary: '#E6C9A8', // Raw Wood
    surface: '#F8F9F5',
    text: '#2C3E50',
    accent: '#2ECC71',
    palette: ['#0B211A', '#1B4D3E', '#4A7C6A', '#9CBAA1', '#E6C9A8'],
    typography: 'Outfit, sans-serif',
    radius: '12px',
    shadow: '0 4px 20px rgba(27,77,62,0.1)',
    description: 'Phong cách Biophilic — Tự nhiên, Tươi mới, Tăng trưởng.',
  },
  '火': {
    primary: '#800000', // Deep Maroon
    secondary: '#FFD700', // Flare Gold
    surface: '#FFF5F5',
    text: '#1A1A1A',
    accent: '#E74C3C',
    palette: ['#4A0000', '#800000', '#C0392B', '#E67E22', '#FFD700'],
    typography: 'Montserrat, sans-serif',
    radius: '4px', // Sharp
    shadow: '0 10px 40px rgba(128,0,0,0.15)',
    description: 'Phong cách Energetic — Năng lượng, Rực rỡ, Ấn tượng.',
  },
  '土': {
    primary: '#4B3621', // Dark Earth
    secondary: '#F5F5DC', // Beige
    surface: '#FCF8F2',
    text: '#3D2B1F',
    accent: '#D35400',
    palette: ['#2C1E12', '#4B3621', '#8B4513', '#D2B48C', '#F5F5DC'],
    typography: 'Lora, serif',
    radius: '24px', // Organic curves
    shadow: '0 6px 24px rgba(75,54,33,0.08)',
    description: 'Phong cách Zen & Earthy — Tĩnh lặng, Bền vững, Ấm áp.',
  },
  '金': {
    primary: '#333333', // Industrial Gray
    secondary: '#C0C0C0', // Silver Chrome
    surface: '#F0F0F0',
    text: '#111111',
    accent: '#7F8C8D',
    palette: ['#1A1A1A', '#333333', '#7F8C8D', '#BDC3C7', '#E0E0E0'],
    typography: 'Inter, sans-serif',
    radius: '0px', // Minimalist
    shadow: '0 2px 10px rgba(0,0,0,0.2)',
    description: 'Phong cách Minimalist Industrial — Sắc sảo, Tinh giản, Đẳng cấp.',
  }
};

// ═══ 3. Advanced Analysis Engine ════════════════════════
export function analyzeCompatibility(bossElement, staffElement) {
  const RELATION = {
    '水-木': { score: 100, text: 'Thủy sinh Mộc (Tương sinh) — Chủ nuôi dưỡng nhân viên.', css: 'green', icon: '🌟' },
    '木-火': { score: 100, text: 'Mộc sinh Hỏa (Tương sinh) — Nhân viên giúp chủ thăng tiến.', css: 'green', icon: '🔥' },
    '火-土': { score: 100, text: 'Hỏa sinh Thổ (Tương sinh) — Chủ tạo nền tảng cho nhân viên.', css: 'green', icon: '⛰️' },
    '土-金': { score: 100, text: 'Thổ sinh Kim (Tương sinh) — Nhân viên tạo ra lợi nhuận.', css: 'green', icon: '💰' },
    '金-水': { score: 100, text: 'Kim sinh Thủy (Tương sinh) — Chủ hỗ trợ tài chính tốt.', css: 'green', icon: '💧' },
    '水-水': { score: 85, text: 'Thủy - Thủy (Tương hòa) — Đồng lòng, lưu động.', css: 'green', icon: '🌊' },
    '木-木': { score: 85, text: 'Mộc - Mộc (Tương hòa) — Cùng phát triển.', css: 'green', icon: '🌳' },
    '火-火': { score: 85, text: '火 - 火 (Tương hòa) — Nhiệt huyết, bùng nổ.', css: 'green', icon: '🧨' },
    '土-土': { score: 85, text: '土 - 土 (Tương hòa) — Ổn định, bền vững.', css: 'green', icon: '🧱' },
    '金-金': { score: 85, text: '金 - 金 (Tương hòa) — Cứng rắn, quyết đoán.', css: 'green', icon: '⚔️' },
    '水-火': { score: 40, text: 'Thủy khắc Hỏa (Tương khắc) — Khó hòa hợp.', css: 'red', icon: '⚠️', bridge: '木' },
    '火-金': { score: 40, text: 'Hỏa khắc Kim (Tương khắc) — Xung đột gắt.', css: 'red', icon: '⚠️', bridge: '土' },
    '金-木': { score: 40, text: 'Kim khắc Mộc (Tương khắc) — Áp lực lớn.', css: 'red', icon: '⚠️', bridge: '水' },
    '木-土': { score: 40, text: 'Mộc khắc Thổ (Tương khắc) — Mất kiểm soát.', css: 'red', icon: '⚠️', bridge: '火' },
    '土-水': { score: 40, text: 'Thổ khắc Thủy (Tương khắc) — Ngăn trở dòng chảy.', css: 'red', icon: '⚠️', bridge: '金' },
  };

  const key = `${bossElement}-${staffElement}`;
  const reverseKey = `${staffElement}-${bossElement}`;
  const res = RELATION[key] || RELATION[reverseKey] || { score: 60, text: 'Bình hòa', css: 'amber', icon: '🤝' };

  if (res.bridge) {
    res.resolutionText = `
      <div class="alert alert-gold" style="margin-top:10px;font-size:0.85rem">
        <b>Hóa Giải (Thông Quan):</b> Dùng nguyên tố <b>${res.bridge} (${WU_XING_VI[res.bridge].split(' ')[0]})</b> làm cầu nối. 
        Khi làm việc nên đặt vật phẩm thuộc hành này giữa hai người (vd: Cây xanh nếu dùng Mộc) hoặc nhân sự mặc đồng phục màu ${ELEMENT_TOKENS[res.bridge].palette[2]}. 
        Nâng điểm tương hợp lên <b>100/100</b>.
      </div>
    `;
  }

  return { ...res, relation: res.text };
}

// ═══ 4. UI Generators ══════════════════════════════════
export function generateBrandGuidelinesHTML(element, businessName, assets = {}) {
  const tokens = ELEMENT_TOKENS[element] || ELEMENT_TOKENS['水'];
  const logoSrc = assets.logo ? `images/${assets.logo}` : 'images/fnb_water_logo.png';
  const interiorSrc = assets.interior ? `images/${assets.interior}` : 'images/fnb_water_interior.png';
  const exteriorSrc = assets.exterior ? `images/${assets.exterior}` : 'images/fnb_water_exterior.png';
  const packagingSrc = assets.packaging ? `images/${assets.packaging}` : 'images/fnb_water_packaging.png';
  const uniformSrc = assets.uniform ? `images/${assets.uniform}` : 'images/fnb_water_uniform.png';

  return `
  <!-- Brand Guidelines Section -->
  <div class="section brand-guidelines">
    <h2 style="color:${tokens.primary};">🎨 8. Brand Identity Guidelines — DNA ${WU_XING_VI[element]}</h2>
    <p class="desc">Bản hướng dẫn quy chuẩn thương hiệu dành riêng cho <b>${businessName}</b> dựa trên Nhật Chủ <b>${element}</b>. Đây là kim chỉ nam để Agency và Team Marketing triển khai đồng bộ.</p>

    <div class="guideline-grid">
      <!-- 1. Color Palette -->
      <div class="info-card highlight">
        <h4>1. Bảng Màu (Color Palette)</h4>
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          ${tokens.palette.map(c => `<div style="width:40px;height:40px;background:${c};border-radius:4px;border:1px solid #e8e8e8" title="${c}"></div>`).join('')}
        </div>
        <p style="font-size:0.85rem"><b>Màu chính:</b> ${tokens.primary}</p>
        <p style="font-size:0.85rem"><b>Màu nhấn:</b> ${tokens.secondary}</p>
        <p style="font-size:0.85rem;margin-top:8px;color:var(--color-green)"><b>Khuyến nghị:</b> ${tokens.description}</p>
      </div>

      <!-- 2. Typography -->
      <div class="info-card highlight">
        <h4>2. Typography & Font Scale</h4>
        <p style="font-family:${tokens.typography};font-size:1.4rem;font-weight:700;margin-bottom:8px">THE QUICK BROWN FOX</p>
        <p style="font-family:${tokens.typography};font-size:0.9rem">Phông chữ đề nghị: <b>${tokens.typography.split(',')[0]}</b></p>
        <ul style="font-size:0.8rem;margin-top:8px;padding-left:16px;color:#555">
          <li>Headline: font-weight 800, letter-spacing -0.02em</li>
          <li>Body: font-weight 400, line-height 1.6</li>
        </ul>
      </div>

      <!-- 3. Logo Concept -->
      <div class="info-card highlight" style="grid-column: span 2">
        <h4>3. Logo Concept Matrix</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div style="background:${tokens.primary};padding:30px;border-radius:12px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center">
             <img src="${logoSrc}" style="max-height:120px;border-radius:8px">
             <p style="color:white;font-size:0.75rem;margin-top:12px;letter-spacing:1px">REVERSE / DARK ALIGNMENT</p>
          </div>
          <div style="background:${tokens.surface};padding:30px;border-radius:12px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid #e8e8e8">
             <img src="${logoSrc}" style="max-height:120px;border-radius:8px">
             <p style="color:#333;font-size:0.75rem;margin-top:12px;letter-spacing:1px">STANDARD / LIGHT ALIGNMENT</p>
          </div>
        </div>
      </div>

      <!-- 4. Packaging specs -->
      <div class="info-card highlight brand-row" style="grid-column: span 2; display:flex; gap:20px; align-items:center">
        <img src="${packagingSrc}" style="width:300px; border-radius:12px; border:1px solid #e8e8e8; object-fit:cover" alt="Packaging">
        <div>
          <h4>4. Packaging Specs (Thiết Kế Bao Bì)</h4>
          <p style="font-size:0.9rem"><b>Vật liệu:</b> ${element === '水' ? 'Nhựa PET trong suốt phối giấy dập nổi, bọc lõi cách nhiệt nhám mờ.' : 'Giấy Kraft tái chế, Matte coating cao cấp.'}</p>
          <p style="font-size:0.9rem"><b>Kỹ thuật in:</b> Ép kim vàng nền sẫm, Phủ UV định hình logo để nổi bật hiệu ứng ánh sáng Noir Lounge.</p>
        </div>
      </div>

      <!-- 5. Staff Uniforms -->
      <div class="info-card highlight brand-row" style="grid-column: span 2; display:flex; gap:20px; align-items:center; flex-direction:row-reverse">
        <img src="${uniformSrc}" style="width:300px; border-radius:12px; border:1px solid #e8e8e8; object-fit:cover" alt="Uniform">
        <div style="text-align:right">
          <h4>5. Staff Uniforms (Đồng Phục OUTFIT)</h4>
          <p style="font-size:0.9rem"><b>Màu vải nền:</b> ${tokens.palette[1]} (Premium Navy / Dark Fabric)</p>
          <p style="font-size:0.9rem"><b>Phụ kiện:</b> Tạp dề da thật nguyên bản (Tan Leather), khóa đồng nguyên khối (Brass hardware). Điểm xuyết thêu logo chỉ bạc/vàng.</p>
        </div>
      </div>

      <!-- 6. Space DNA -->
      <div class="info-card highlight" style="grid-column: span 2">
        <h4>6. Space DNA (Architecture Guidelines)</h4>
        <p style="font-size:0.9rem;line-height:1.6;margin-bottom:12px">${tokens.description}</p>
        <div class="img-grid-2">
           <div style="text-align:center">
             <img src="${exteriorSrc}" style="border-radius:12px; width:100%">
             <p style="font-size:0.8rem; color:#666; margin-top:8px">Bản phối cảnh Ngoại Thất Exterior</p>
           </div>
           <div style="text-align:center">
             <img src="${interiorSrc}" style="border-radius:12px; width:100%">
             <p style="font-size:0.8rem; color:#666; margin-top:8px">Bản phối cảnh Nội Thất Interior Noir Space</p>
           </div>
        </div>
      </div>

      <!-- 7. CSS Design Tokens -->
      <div class="info-card highlight" style="background:#111;color:#a3e635;border:1px solid #222">
        <h4 style="color:#fff;border-color:#333">7. Developer Design Tokens (CSS)</h4>
        <pre style="font-size:0.75rem;overflow-x:auto;font-family:monospace;margin-top:10px">
:root {
  --primary: ${tokens.primary};
  --secondary: ${tokens.secondary};
  --bg: ${tokens.surface};
  --radius: ${tokens.radius};
  --font-main: '${tokens.typography.split(',')[0]}';
  --shadow: ${tokens.shadow};
}</pre>
        <p style="font-size:0.7rem;color:#888;margin-top:8px">// Copy paste cho Frontend Team</p>
      </div>

      <!-- 8. Do's & Don'ts -->
      <div class="info-card" style="border-left:4px solid var(--color-red); background:#fef2f2">
        <h4 style="color:#991b1b;border-bottom:none">8. Brand Don'ts (Cấm kỵ)</h4>
        <ul style="font-size:0.85rem;color:#991b1b;line-height:1.6;padding-left:16px">
          <li>Không dùng màu ${tokens.palette[0]} để làm background cho text mỏng vì vi phạm WCAG contrast.</li>
          <li>Không bóp méo tỷ lệ Logo (aspect-ratio 1:1) trong mọi ấn phẩm in ấn lẫn digital.</li>
          <li>Tuyệt đối không phối với màu hành xung khắc quá 10% diện tích không gian.</li>
        </ul>
      </div>
    </div>
  </div>

  <style>
    .guideline-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 24px; }
    @media (max-width: 768px) { 
      .guideline-grid { grid-template-columns: 1fr; }
      .brand-row { flex-direction: column !important; text-align: left !important; }
      .brand-row img { width: 100% !important; }
    }
  </style>
  `;
}

// ═══ 5. Additional Mapping Data ════════════════════════
export const DEEP_ARCH_MAPPING = {
  '水': {
    spatial: { title: 'Dòng chảy vô cực (Infinity Flow)', desc: 'Sử dụng các đường cong mềm mại, lối đi uốn lượn như dòng nước. Container nên được xếp chồng có độ lệch (offset) tạo hốc tối cinematic.' },
    sensory: { title: 'Noir Sensory (Cảm quan đen)', desc: 'Ánh sáng màu xanh deep-ocean hoặc tím than. Âm thanh Jazz chậm hoặc Lo-fi thư giãn.' },
    tech: { title: 'Liquid Automation', desc: 'Sử dụng màn hình LED hiển thị hiệu ứng "trọng lực nước". Hệ thống phun sương làm mát tự động theo độ ẩm.' },
    menu: { title: 'Cold-focused', desc: 'Tập trung các dòng Cold Brew, Cocktail màu tối. Cold-display chuyên nghiệp.' }
  }
  // Others omitted for brevity in first draft, will expand as needed
};

export const DEEP_BRANDING_MAPPING = {
  '水': {
    logo: 'Logo dạng Typography Serif uốn lượn, tối giản (Minimalist). Kết hợp hiệu ứng dập chìm (Debossing) thể hiện chiều sâu của nước.',
    packaging: 'Vật liệu giấy mờ, túi xách màu Navy phối quai lụa. Ly cafe PET trong suốt lộ màu nước drink cinematic.',
    uniform: 'Đương đại (Contemporary). Áo Polo hoặc Vest tối màu, thêu logo chỉ bạc (Kim sinh Thủy).'
  }
};

export const DAYUN_ADVICE = {
  '正财': { icon: '💰', text: 'Đại vận bước vào cung Tài Lộc. Đây là thời cơ vàng để mở rộng chi nhánh, đầu tư mạnh vào cơ sở hạ tầng F&B.' },
  '食神': { icon: '🍜', text: 'Vận may về ăn uống và hưởng thụ. Menu và khẩu vị khách hàng sẽ là điểm then chốt thu hút dòng tiền.' },
  // Others...  
};
