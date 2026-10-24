export const MENU_DRINK_IMAGES: Readonly<Record<string, string>> = {
  bt001: '/menu/aura-drinks/dasani.webp',
  bt002: '/menu/aura-drinks/coca-cola.webp',
  bt003: '/menu/aura-drinks/red-bull.webp',
  fp001: '/menu/aura-drinks/coffee-frappuccino.webp',
  fp002: '/menu/aura-drinks/cookie-frappuccino.webp',
  fp003: '/menu/aura-drinks/mocha-frappuccino.webp',
  fp004: '/menu/aura-drinks/coconut-blueberry-coffee.webp',
  fp005: '/menu/aura-drinks/blueberry-yogurt-frappuccino.webp',
  fp006: '/menu/aura-drinks/matcha-frappuccino.webp',
  hc001: '/menu/aura-drinks/espresso.webp',
  hc002: '/menu/aura-drinks/americano.webp',
  hc003: '/menu/aura-drinks/cappuccino.webp',
  hc004: '/menu/aura-drinks/mocha.webp',
  hc005: '/menu/aura-drinks/latte.webp',
  hc006: '/menu/aura-drinks/matcha-latte-nong.webp',
  jc001: '/menu/aura-drinks/da-chanh.webp',
  jc002: '/menu/aura-drinks/rau-ma.webp',
  jc003: '/menu/aura-drinks/rau-ma-dua-sua.webp',
  jc004: '/menu/aura-drinks/dua-trai.webp',
  jc005: '/menu/aura-drinks/dua-da.webp',
  jc006: '/menu/aura-drinks/cam-vat.webp',
  od001: '/menu/aura-drinks/tra-duong.webp',
  od002: '/menu/aura-drinks/binh-tra-bac.webp',
  od003: '/menu/aura-drinks/da-me.webp',
  od004: '/menu/aura-drinks/chanh-muoi.webp',
  od005: '/menu/aura-drinks/sua-tuoi.webp',
  sd001: '/menu/aura-drinks/soda-sapphire.webp',
  sd002: '/menu/aura-drinks/soda-emerald.webp',
  sm001: '/menu/aura-drinks/sinh-to-dau.webp',
  sm002: '/menu/aura-drinks/sinh-to-bo.webp',
  sm003: '/menu/aura-drinks/sinh-to-mang-cau.webp',
  sm004: '/menu/aura-drinks/sinh-to-sapo.webp',
  tc001: '/menu/aura-drinks/ca-phe-den.webp',
  tc002: '/menu/aura-drinks/ca-phe-sua.webp',
  tc003: '/menu/aura-drinks/ca-phe-muoi.webp',
  tc004: '/menu/aura-drinks/bac-xiu.webp',
  tc005: '/menu/aura-drinks/ca-cao.webp',
  tc006: '/menu/aura-drinks/ca-cao-sua.webp',
  tc007: '/menu/aura-drinks/matcha-latte-da.webp',
  te001: '/menu/aura-drinks/tra-lipton-chanh.webp',
  te002: '/menu/aura-drinks/tra-lipton-sua.webp',
  te003: '/menu/aura-drinks/tra-lipton-cam.webp',
  te004: '/menu/aura-drinks/tra-cuc.webp',
  te005: '/menu/aura-drinks/tra-mang-cau.webp',
  te006: '/menu/aura-drinks/tra-dao.webp',
  yg001: '/menu/aura-drinks/yaourt-da.webp',
  yg002: '/menu/aura-drinks/yaourt-ca-phe.webp',
  yg003: '/menu/aura-drinks/yaourt-viet-quoc.webp',
  yg004: '/menu/aura-drinks/yaourt-hu.webp',
};

export const MENU_DRINK_PACKSHOTS: Readonly<Record<string, readonly { src: string; alt: string }[]>> = {
  bt001: [
    { src: MENU_DRINK_IMAGES.bt001!, alt: 'Nước đóng chai Dasani 510 ml — ảnh sản phẩm từ Coca-Cola Việt Nam' },
  ],
  bt002: [
    { src: MENU_DRINK_IMAGES.bt002!, alt: 'Coca-Cola vị nguyên bản — ảnh sản phẩm từ Coca-Cola Việt Nam' },
    { src: '/menu/aura-drinks/pepsi.webp', alt: 'Pepsi Cola — ảnh sản phẩm từ Suntory PepsiCo Việt Nam' },
  ],
  bt003: [
    { src: MENU_DRINK_IMAGES.bt003!, alt: 'Red Bull lon vàng — ảnh sản phẩm từ TCP' },
  ],
};

const LEGACY_IMAGES = new Set([
  '/menu/aura-drinks/nuoc-suoi.webp',
  '/menu/aura-drinks/nuoc-ngot.webp',
  '/menu/aura-drinks/nuoc-tang-luc.webp',
  '/menu/bac-xiu.jpg',
  '/menu/binh-tra.jpg',
  '/menu/ca-phe-den.jpg',
  '/menu/ca-phe-muoi.jpg',
  '/menu/ca-phe-sua.jpg',
  '/menu/cappuccino.jpg',
  '/menu/da-me.jpg',
  '/menu/dong-chai.jpg',
  '/menu/frappuccino.jpg',
  '/menu/matcha-latte.jpg',
  '/menu/nuoc-cam.jpg',
  '/menu/rau-ma.jpg',
  '/menu/sinh-to-bo.jpg',
  '/menu/soda-blue.jpg',
  '/menu/tra-dao.jpg',
  '/menu/yaourt.jpg',
]);

const ID_ALIASES: Record<string, string> = {
  yo001: 'yg001',
  yo002: 'yg002',
  yo003: 'yg003',
  yo004: 'yg004',
};

export function resolveMenuDrinkImage(id: string, imageUrl?: string | null): string {
  if (imageUrl && !LEGACY_IMAGES.has(imageUrl)) return imageUrl;
  return MENU_DRINK_IMAGES[ID_ALIASES[id] ?? id] ?? imageUrl ?? '';
}

export function resolveMenuDrinkPackshots(id: string, imageUrl?: string | null) {
  return resolveMenuDrinkImage(id, imageUrl) === MENU_DRINK_IMAGES[id]
    ? MENU_DRINK_PACKSHOTS[id]
    : undefined;
}
