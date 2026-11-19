/**
 * 4 Built-in F&B Storefront Templates for Atomic Self-Serve Tenant Provisioning.
 *
 * Every template includes:
 * - Clean non-AURA branding defaults (primary/accent colors, tagline, receipt footer)
 * - Categories, Products, Ingredients + BOM Recipes, Cafe Tables, and Default Shifts
 */

export type SaasTemplateId =
  | 'traditional-cafe'
  | 'milktea-takeaway'
  | 'garden-container'
  | 'bistro-acoustic';

export interface TemplateCategory {
  key: string;
  name: string;
  description: string;
  sortOrder: number;
}

export interface TemplateIngredient {
  key: string;
  name: string;
  unit: string;
  costPerUnit: number;
  initialStock: number;
  minStock: number;
}

export interface TemplateProduct {
  key: string;
  categoryKey: string;
  name: string;
  price: number;
  description: string;
  bom: ReadonlyArray<{ ingredientKey: string; quantity: number; unit: string }>;
}

export interface TemplateTable {
  code: string;
  name: string;
  zone: string;
  capacity: number;
}

export interface TemplateShift {
  name: string;
  startTime: string;
  endTime: string;
}

export interface SaasStoreTemplate {
  id: SaasTemplateId;
  nameVi: string;
  descriptionVi: string;
  defaultTagline: string;
  primaryColor: string;
  accentColor: string;
  receiptFooter: string;
  categories: readonly TemplateCategory[];
  ingredients: readonly TemplateIngredient[];
  products: readonly TemplateProduct[];
  tables: readonly TemplateTable[];
  shifts: readonly TemplateShift[];
}

export const SAAS_TEMPLATES: Record<SaasTemplateId, SaasStoreTemplate> = {
  'traditional-cafe': {
    id: 'traditional-cafe',
    nameVi: 'Quán Cà Phê Truyền Thống',
    descriptionVi: 'Cà phê phin đậm vị, bạc xỉu, trà trái cây và điểm tâm nhẹ.',
    defaultTagline: 'Hương vị cà phê rang xay nguyên bản mỗi sáng',
    primaryColor: '#3E2723',
    accentColor: '#D97706',
    receiptFooter: 'Cảm ơn quý khách! Hẹn gặp lại vào buổi cà phê tiếp theo.',
    categories: [
      { key: 'ca-phe-phin', name: 'Cà Phê Phin', description: 'Cà phê rang mộc pha phin truyền thống', sortOrder: 1 },
      { key: 'tra-trai-cay', name: 'Trà Trái Cây', description: 'Trà ủ lạnh kết hợp trái cây tươi', sortOrder: 2 },
      { key: 'banh-ngot', name: 'Điểm Tâm & Bánh', description: 'Bánh ăn kèm cà phê sáng', sortOrder: 3 },
    ],
    ingredients: [
      { key: 'cafe-bot', name: 'Cà phê Robusta rang mộc', unit: 'g', costPerUnit: 250, initialStock: 5000, minStock: 1000 },
      { key: 'sua-dac', name: 'Sữa đặc có đường', unit: 'ml', costPerUnit: 80, initialStock: 4000, minStock: 800 },
      { key: 'tra-den', name: 'Trà đen nguyên lá', unit: 'g', costPerUnit: 200, initialStock: 2000, minStock: 500 },
      { key: 'dao-ngam', name: 'Đào ngâm cắt lát', unit: 'g', costPerUnit: 120, initialStock: 3000, minStock: 600 },
    ],
    products: [
      {
        key: 'ca-phe-den-da',
        categoryKey: 'ca-phe-phin',
        name: 'Cà Phê Đen Đá',
        price: 25_000,
        description: 'Cà phê phin đậm đà nguyên chất',
        bom: [{ ingredientKey: 'cafe-bot', quantity: 25, unit: 'g' }],
      },
      {
        key: 'ca-phe-sua-da',
        categoryKey: 'ca-phe-phin',
        name: 'Cà Phê Sữa Đá',
        price: 29_000,
        description: 'Cà phê phin hòa quyện sữa đặc béo ngọt',
        bom: [
          { ingredientKey: 'cafe-bot', quantity: 25, unit: 'g' },
          { ingredientKey: 'sua-dac', quantity: 35, unit: 'ml' },
        ],
      },
      {
        key: 'bac-xiu',
        categoryKey: 'ca-phe-phin',
        name: 'Bạc Xỉu Đá',
        price: 32_000,
        description: 'Nhiều sữa béo thơm nhẹ hương cà phê',
        bom: [
          { ingredientKey: 'cafe-bot', quantity: 15, unit: 'g' },
          { ingredientKey: 'sua-dac', quantity: 45, unit: 'ml' },
        ],
      },
      {
        key: 'tra-dao-cam-sa',
        categoryKey: 'tra-trai-cay',
        name: 'Trà Đào Cam Sả',
        price: 39_000,
        description: 'Trà đen thanh mát cùng đào giòn và hương sả',
        bom: [
          { ingredientKey: 'tra-den', quantity: 10, unit: 'g' },
          { ingredientKey: 'dao-ngam', quantity: 40, unit: 'g' },
        ],
      },
      {
        key: 'banh-mi-que',
        categoryKey: 'banh-ngot',
        name: 'Bánh Mì Que Pate',
        price: 22_000,
        description: 'Bánh mì nướng giòn nóng nhân pate thơm béo',
        bom: [],
      },
    ],
    tables: [
      { code: 'T01', name: 'Bàn 01', zone: 'Trong nhà', capacity: 2 },
      { code: 'T02', name: 'Bàn 02', zone: 'Trong nhà', capacity: 2 },
      { code: 'T03', name: 'Bàn 03', zone: 'Trong nhà', capacity: 4 },
      { code: 'T04', name: 'Bàn 04', zone: 'Trong nhà', capacity: 4 },
      { code: 'T05', name: 'Bàn 05', zone: 'Hành lang', capacity: 4 },
      { code: 'T06', name: 'Bàn 06', zone: 'Hành lang', capacity: 6 },
    ],
    shifts: [
      { name: 'Ca Sáng', startTime: '06:30', endTime: '14:30' },
      { name: 'Ca Chiều', startTime: '14:30', endTime: '22:00' },
    ],
  },

  'milktea-takeaway': {
    id: 'milktea-takeaway',
    nameVi: 'Trà Sữa & Takeaway',
    descriptionVi: 'Tối ưu tốc độ ra món mang đi, trà sữa topping và trà trái cây.',
    defaultTagline: 'Trà tươi pha máy — Topping nấu mới mỗi ngày',
    primaryColor: '#7C2D12',
    accentColor: '#EC4899',
    receiptFooter: 'Lắc đều trước khi uống! Cảm ơn bạn đã ủng hộ quán.',
    categories: [
      { key: 'tra-sua', name: 'Trà Sữa Signature', description: 'Trà sữa đậm vị trà, topping đa dạng', sortOrder: 1 },
      { key: 'tra-hoa-qua', name: 'Trà Hoa Quả Tươi', description: 'Giải nhiệt nhanh cho khách mang đi', sortOrder: 2 },
      { key: 'topping', name: 'Topping Thêm', description: 'Trân châu, pudding, kem cheese', sortOrder: 3 },
    ],
    ingredients: [
      { key: 'tra-olong', name: 'Trà Olong nướng', unit: 'g', costPerUnit: 320, initialStock: 3000, minStock: 500 },
      { key: 'bot-sua', name: 'Bột sữa béo thực vật', unit: 'g', costPerUnit: 110, initialStock: 6000, minStock: 1000 },
      { key: 'tran-chau', name: 'Trân châu đường đen', unit: 'g', costPerUnit: 95, initialStock: 5000, minStock: 1000 },
      { key: 'matcha', name: 'Bột Matcha Uji', unit: 'g', costPerUnit: 900, initialStock: 1000, minStock: 200 },
    ],
    products: [
      {
        key: 'ts-tran-chau-duong-den',
        categoryKey: 'tra-sua',
        name: 'Trà Sữa Trân Châu Đường Đen',
        price: 38_000,
        description: 'Trân châu nấu đường đen dẻo thơm cùng trà sữa béo',
        bom: [
          { ingredientKey: 'tra-olong', quantity: 10, unit: 'g' },
          { ingredientKey: 'bot-sua', quantity: 30, unit: 'g' },
          { ingredientKey: 'tran-chau', quantity: 50, unit: 'g' },
        ],
      },
      {
        key: 'olong-kem-cheese',
        categoryKey: 'tra-sua',
        name: 'Olong Nướng Kem Cheese',
        price: 42_000,
        description: 'Trà Olong đậm vị phủ lớp kem phô mai mặn béo',
        bom: [
          { ingredientKey: 'tra-olong', quantity: 12, unit: 'g' },
          { ingredientKey: 'bot-sua', quantity: 25, unit: 'g' },
        ],
      },
      {
        key: 'matcha-latte',
        categoryKey: 'tra-sua',
        name: 'Matcha Latte Sữa Tươi',
        price: 45_000,
        description: 'Matcha nguyên chất đánh mịn cùng sữa tươi thanh',
        bom: [{ ingredientKey: 'matcha', quantity: 6, unit: 'g' }],
      },
      {
        key: 'hong-tra-tac',
        categoryKey: 'tra-hoa-qua',
        name: 'Hồng Trà Tắc Mật Ong',
        price: 28_000,
        description: 'Chua ngọt giải khát chuẩn vị mang đi',
        bom: [{ ingredientKey: 'tra-olong', quantity: 8, unit: 'g' }],
      },
    ],
    tables: [
      { code: 'TW01', name: 'Quầy Mang Đi 01', zone: 'Takeaway', capacity: 2 },
      { code: 'TW02', name: 'Quầy Mang Đi 02', zone: 'Takeaway', capacity: 2 },
      { code: 'B01', name: 'Bàn Ngồi 01', zone: 'Quầy bar', capacity: 2 },
      { code: 'B02', name: 'Bàn Ngồi 02', zone: 'Quầy bar', capacity: 4 },
    ],
    shifts: [
      { name: 'Ca 1 (Sáng)', startTime: '08:00', endTime: '15:00' },
      { name: 'Ca 2 (Tối)', startTime: '15:00', endTime: '22:30' },
    ],
  },

  'garden-container': {
    id: 'garden-container',
    nameVi: 'Cà Phê Sân Vườn / Container',
    descriptionVi: 'Không gian mở nhiều khu vực, specialty coffee, cold brew và ăn vặt.',
    defaultTagline: 'Không gian xanh thoáng đãng — Cà phê chất lượng mỗi ngày',
    primaryColor: '#14532D',
    accentColor: '#10B981',
    receiptFooter: 'Chúc quý khách có khoảng thời gian thư giãn tuyệt vời!',
    categories: [
      { key: 'specialty-coffee', name: 'Specialty & Cold Brew', description: 'Cà phê pha máy và ủ lạnh 16 giờ', sortOrder: 1 },
      { key: 'signature-tea', name: 'Trà Sân Vườn', description: 'Trà hoa và trái cây nhiệt đới', sortOrder: 2 },
      { key: 'snacks', name: 'Món Ăn Nhẹ', description: 'Đồ ăn vặt chia sẻ theo nhóm', sortOrder: 3 },
    ],
    ingredients: [
      { key: 'arabica-hat', name: 'Cà phê Arabica nguyên hạt', unit: 'g', costPerUnit: 420, initialStock: 5000, minStock: 1000 },
      { key: 'cam-tuoi', name: 'Cam vàng tươi', unit: 'g', costPerUnit: 65, initialStock: 4000, minStock: 800 },
      { key: 'vai-ngam', name: 'Vải thiều ngâm', unit: 'g', costPerUnit: 130, initialStock: 3000, minStock: 600 },
      { key: 'khoai-tay', name: 'Khoai tây cắt sợi đông lạnh', unit: 'g', costPerUnit: 75, initialStock: 5000, minStock: 1000 },
    ],
    products: [
      {
        key: 'cold-brew-cam',
        categoryKey: 'specialty-coffee',
        name: 'Cold Brew Cam Sả',
        price: 49_000,
        description: 'Cà phê ủ lạnh thanh mượt hòa cùng cam tươi',
        bom: [
          { ingredientKey: 'arabica-hat', quantity: 22, unit: 'g' },
          { ingredientKey: 'cam-tuoi', quantity: 50, unit: 'g' },
        ],
      },
      {
        key: 'espresso-tonic',
        categoryKey: 'specialty-coffee',
        name: 'Espresso Tonic',
        price: 52_000,
        description: 'Shot espresso đậm hương kết hợp tonic sảng khoái',
        bom: [{ ingredientKey: 'arabica-hat', quantity: 18, unit: 'g' }],
      },
      {
        key: 'tra-vai-hoa-hong',
        categoryKey: 'signature-tea',
        name: 'Trà Vải Hoa Hồng',
        price: 45_000,
        description: 'Vải ngọt giòn thơm dịu hương hoa hồng',
        bom: [{ ingredientKey: 'vai-ngam', quantity: 45, unit: 'g' }],
      },
      {
        key: 'khoai-tay-lac-pho-mai',
        categoryKey: 'snacks',
        name: 'Khoai Tây Lắc Phô Mai',
        price: 39_000,
        description: 'Khoai tây chiên vàng giòn lắc phô mai béo ngậy',
        bom: [{ ingredientKey: 'khoai-tay', quantity: 150, unit: 'g' }],
      },
    ],
    tables: [
      { code: 'IN01', name: 'Bàn Container 01', zone: 'Trong nhà', capacity: 4 },
      { code: 'IN02', name: 'Bàn Container 02', zone: 'Trong nhà', capacity: 4 },
      { code: 'IN03', name: 'Bàn Container 03', zone: 'Trong nhà', capacity: 6 },
      { code: 'GD01', name: 'Bàn Sân Vườn 01', zone: 'Sân vườn', capacity: 4 },
      { code: 'GD02', name: 'Bàn Sân Vườn 02', zone: 'Sân vườn', capacity: 4 },
      { code: 'GD03', name: 'Bàn Sân Vườn 03', zone: 'Sân vườn', capacity: 6 },
      { code: 'GD04', name: 'Bàn Sân Vườn 04', zone: 'Sân vườn', capacity: 8 },
      { code: 'RT01', name: 'Bàn Sân Thượng 01', zone: 'Sân thượng', capacity: 4 },
    ],
    shifts: [
      { name: 'Ca Sáng', startTime: '07:00', endTime: '15:00' },
      { name: 'Ca Tối', startTime: '15:00', endTime: '23:00' },
    ],
  },

  'bistro-acoustic': {
    id: 'bistro-acoustic',
    nameVi: 'Bistro & Acoustic Lounge',
    descriptionVi: 'Đồ uống tối, mocktail, món Âu nhẹ và bàn khu sân khấu nhạc sống.',
    defaultTagline: 'Âm nhạc mộc mạc — Ẩm thực tinh tế mỗi tối',
    primaryColor: '#1E1B4B',
    accentColor: '#F59E0B',
    receiptFooter: 'Cảm ơn quý khách đã thưởng thức đêm nhạc cùng chúng tôi!',
    categories: [
      { key: 'mocktail', name: 'Mocktail & Signature', description: 'Pha chế không cồn đặc trưng cho buổi tối', sortOrder: 1 },
      { key: 'bistro-food', name: 'Món Chính Bistro', description: 'Mì Ý, gà chiên và đồ nhấm kèm nhạc sống', sortOrder: 2 },
      { key: 'combo-dem-nhac', name: 'Combo Acoustic', description: 'Gói tiết kiệm cho nhóm bạn', sortOrder: 3 },
    ],
    ingredients: [
      { key: 'syrup-chanh-day', name: 'Syrup chanh dây', unit: 'ml', costPerUnit: 140, initialStock: 3000, minStock: 500 },
      { key: 'mi-y', name: 'Mì Ý khô loại 1', unit: 'g', costPerUnit: 85, initialStock: 5000, minStock: 1000 },
      { key: 'kem-beo', name: 'Kem béo nấu ăn', unit: 'ml', costPerUnit: 160, initialStock: 3000, minStock: 600 },
      { key: 'canh-ga', name: 'Cánh gà tươi', unit: 'g', costPerUnit: 115, initialStock: 6000, minStock: 1500 },
    ],
    products: [
      {
        key: 'mocktail-nhiet-doi',
        categoryKey: 'mocktail',
        name: 'Mocktail Chanh Dây Nhiệt Đới',
        price: 59_000,
        description: 'Vị chua thanh cân bằng cùng soda lạnh',
        bom: [{ ingredientKey: 'syrup-chanh-day', quantity: 35, unit: 'ml' }],
      },
      {
        key: 'mi-y-kem-nam',
        categoryKey: 'bistro-food',
        name: 'Mì Ý Sốt Kem Nấm',
        price: 89_000,
        description: 'Mì Ý chuẩn vị phủ sốt kem nấm béo mịn',
        bom: [
          { ingredientKey: 'mi-y', quantity: 120, unit: 'g' },
          { ingredientKey: 'kem-beo', quantity: 80, unit: 'ml' },
        ],
      },
      {
        key: 'canh-ga-nuoc-mam',
        categoryKey: 'bistro-food',
        name: 'Cánh Gà Chiên Nước Mắm',
        price: 79_000,
        description: 'Cánh gà giòn rụm áo sốt mắm tỏi đậm đà',
        bom: [{ ingredientKey: 'canh-ga', quantity: 220, unit: 'g' }],
      },
      {
        key: 'combo-acoustic-2',
        categoryKey: 'combo-dem-nhac',
        name: 'Combo Acoustic 2 Người',
        price: 189_000,
        description: '2 Mocktail tùy chọn + 1 Cánh gà chiên nước mắm',
        bom: [
          { ingredientKey: 'syrup-chanh-day', quantity: 70, unit: 'ml' },
          { ingredientKey: 'canh-ga', quantity: 220, unit: 'g' },
        ],
      },
    ],
    tables: [
      { code: 'ST01', name: 'Bàn Sân Khấu 01', zone: 'Sân khấu', capacity: 2 },
      { code: 'ST02', name: 'Bàn Sân Khấu 02', zone: 'Sân khấu', capacity: 4 },
      { code: 'ST03', name: 'Bàn Sân Khấu 03', zone: 'Sân khấu', capacity: 4 },
      { code: 'LG01', name: 'Bàn Lounge 01', zone: 'Lounge', capacity: 4 },
      { code: 'LG02', name: 'Bàn Lounge 02', zone: 'Lounge', capacity: 6 },
      { code: 'LG03', name: 'Bàn Lounge 03', zone: 'Lounge', capacity: 8 },
    ],
    shifts: [
      { name: 'Ca Chiều (Bistro)', startTime: '14:00', endTime: '19:00' },
      { name: 'Ca Tối (Acoustic)', startTime: '19:00', endTime: '23:30' },
    ],
  },
};

export function isValidTemplateId(value: string): value is SaasTemplateId {
  return Object.prototype.hasOwnProperty.call(SAAS_TEMPLATES, value);
}

export const SAAS_TEMPLATE_LIST: readonly SaasStoreTemplate[] = [
  SAAS_TEMPLATES['traditional-cafe'],
  SAAS_TEMPLATES['milktea-takeaway'],
  SAAS_TEMPLATES['garden-container'],
  SAAS_TEMPLATES['bistro-acoustic'],
];
