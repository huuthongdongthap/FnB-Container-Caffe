PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "categories" ("id","name","slug","description","sort_order","created_at","updated_at") VALUES('cat_coffee','Coffee','coffee','Cà phê truyền thống & specialty',1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "categories" ("id","name","slug","description","sort_order","created_at","updated_at") VALUES('cat_signature','Signature Drinks','signature','Đồ uống đặc biệt AURA SPACE',2,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "categories" ("id","name","slug","description","sort_order","created_at","updated_at") VALUES('cat_snacks','Snacks','snacks','Đồ ăn nhẹ & bánh ngọt',3,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "categories" ("id","name","slug","description","sort_order","created_at","updated_at") VALUES('cat_combo','Combo','combo','Combo tiết kiệm',4,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "categories" ("id","name","slug","description","sort_order","created_at","updated_at") VALUES('traditional-coffee','☕ Cà phê truyền thống (Traditional Coffee)','traditional-coffee','Cà phê phin & máy truyền thống',0,'2026-05-05 01:41:23','2026-05-05 01:41:23');
INSERT INTO "categories" ("id","name","slug","description","sort_order","created_at","updated_at") VALUES('hot-coffee','🔥 Cà phê nóng (Hot Coffee)','hot-coffee','Cà phê kiểu Ý & Mỹ nóng',0,'2026-05-05 01:41:23','2026-05-05 01:41:23');
INSERT INTO "categories" ("id","name","slug","description","sort_order","created_at","updated_at") VALUES('frappuccino','🧊 Đá xay (Blended Drinks)','frappuccino','Đá xay mát lạnh',0,'2026-05-05 01:41:23','2026-05-05 01:41:23');
INSERT INTO "categories" ("id","name","slug","description","sort_order","created_at","updated_at") VALUES('soda','🫧 Soda kiểu Ý (Italian Soda)','soda','Soda tươi pha chế',0,'2026-05-05 01:41:23','2026-05-05 01:41:23');
INSERT INTO "categories" ("id","name","slug","description","sort_order","created_at","updated_at") VALUES('tea','🍵 Trà (Tea)','tea','Trà & thảo mộc',0,'2026-05-05 01:41:23','2026-05-05 01:41:23');
INSERT INTO "categories" ("id","name","slug","description","sort_order","created_at","updated_at") VALUES('smoothies','🥤 Sinh tố (Smoothies)','smoothies','Sinh tố trái cây tươi',0,'2026-05-05 01:41:24','2026-05-05 01:41:24');
INSERT INTO "categories" ("id","name","slug","description","sort_order","created_at","updated_at") VALUES('yogurt','🥛 Yaourt (Yogurt)','yogurt','Yaourt các loại',0,'2026-05-05 01:41:24','2026-05-05 01:41:24');
INSERT INTO "categories" ("id","name","slug","description","sort_order","created_at","updated_at") VALUES('juice','🍊 Nước ép (Fresh Juice)','juice','Nước ép tươi',0,'2026-05-05 01:41:24','2026-05-05 01:41:24');
INSERT INTO "categories" ("id","name","slug","description","sort_order","created_at","updated_at") VALUES('other-drinks','🥤 Thức uống khác (Other Drinks)','other-drinks','Trà, sữa, giải khát',0,'2026-05-05 01:41:24','2026-05-05 01:41:24');
INSERT INTO "categories" ("id","name","slug","description","sort_order","created_at","updated_at") VALUES('bottled','🧴 Giải khát đóng chai (Bottled Drinks)','bottled','Nước giải khát đóng chai',0,'2026-05-05 01:41:24','2026-05-05 01:41:24');
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    description TEXT,
    image_url TEXT,
    tags TEXT,          -- JSON array
    badge TEXT,
    is_available BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);
INSERT INTO "products" ("id","category_id","name","price","description","image_url","tags","badge","is_available","created_at","updated_at") VALUES('p001','cat_coffee','Espresso',45000,'Cà phê nguyên chất 100% Arabica',NULL,'["Hot/Cold","30ml"]','Best Seller',1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "products" ("id","category_id","name","price","description","image_url","tags","badge","is_available","created_at","updated_at") VALUES('p002','cat_coffee','Cappuccino',55000,'Espresso + sữa nóng đánh bọt + foam dày',NULL,'["Hot","180ml"]',NULL,1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "products" ("id","category_id","name","price","description","image_url","tags","badge","is_available","created_at","updated_at") VALUES('p003','cat_coffee','Latte Art',60000,'Espresso + sữa tươi + nghệ thuật vẽ foam',NULL,'["Hot/Cold","240ml"]','Popular',1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "products" ("id","category_id","name","price","description","image_url","tags","badge","is_available","created_at","updated_at") VALUES('p004','cat_coffee','Cà Phê Sữa Đá',35000,'Cà phê phin truyền thống + sữa đặc + đá',NULL,'["Cold","200ml"]','Vietnamese Classic',1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "products" ("id","category_id","name","price","description","image_url","tags","badge","is_available","created_at","updated_at") VALUES('p005','cat_coffee','Cold Brew Tower (12h)',55000,'Cà phê ủ lạnh 12 giờ, vị mượt, ít axit',NULL,'["Cold","300ml"]','Slow Brew',1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "products" ("id","category_id","name","price","description","image_url","tags","badge","is_available","created_at","updated_at") VALUES('p006','cat_signature','Container Special',65000,'Signature: Espresso + tonic + cam slice',NULL,'["Cold","300ml"]','Signature',1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "products" ("id","category_id","name","price","description","image_url","tags","badge","is_available","created_at","updated_at") VALUES('p007','cat_signature','Dirty Matcha Latte',55000,'Matcha Nhật Bản + espresso double shot',NULL,'["Hot/Cold","300ml"]',NULL,1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "products" ("id","category_id","name","price","description","image_url","tags","badge","is_available","created_at","updated_at") VALUES('p008','cat_signature','Trà Sen Vàng',45000,'Trà sen + hạt sen + đường phèn',NULL,'["Hot/Cold","350ml"]',NULL,1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "products" ("id","category_id","name","price","description","image_url","tags","badge","is_available","created_at","updated_at") VALUES('p009','cat_snacks','Bánh Mì Chả Lụa',35000,'Bánh mì baguette + chả lụa + đồ chua',NULL,'["Hot","1 ổ"]',NULL,1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "products" ("id","category_id","name","price","description","image_url","tags","badge","is_available","created_at","updated_at") VALUES('p010','cat_snacks','Croissant Bơ Pháp',45000,'Croissant nướng bơ Pháp, giòn tan',NULL,'["Hot","1 cái"]','French Style',1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "products" ("id","category_id","name","price","description","image_url","tags","badge","is_available","created_at","updated_at") VALUES('p011','cat_combo','Combo 2 Người',99000,'2 cà phê bất kỳ + 1 đồ ăn nhẹ',NULL,'["Tiết kiệm 21K"]','Best Value',1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "products" ("id","category_id","name","price","description","image_url","tags","badge","is_available","created_at","updated_at") VALUES('p012','cat_combo','Set Breakfast',55000,'1 cà phê + 1 bánh mì/sandwich (7:00-9:00)',NULL,'["7:00-9:00"]','Morning',1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
CREATE TABLE cafe_tables (
    id TEXT PRIMARY KEY,
    table_number INTEGER NOT NULL,
    zone TEXT NOT NULL,       -- 'Indoor', 'Outdoor', 'VIP'
    seats INTEGER DEFAULT 2,
    status TEXT DEFAULT 'Available',  -- Available, Occupied, Reserved, Overdue
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "cafe_tables" ("id","table_number","zone","seats","status","created_at") VALUES('t01',1,'Indoor',2,'Reserved','2026-04-13 03:23:39');
INSERT INTO "cafe_tables" ("id","table_number","zone","seats","status","created_at") VALUES('t02',2,'Indoor',2,'Reserved','2026-04-13 03:23:39');
INSERT INTO "cafe_tables" ("id","table_number","zone","seats","status","created_at") VALUES('t03',3,'Indoor',4,'Available','2026-04-13 03:23:39');
INSERT INTO "cafe_tables" ("id","table_number","zone","seats","status","created_at") VALUES('t04',4,'Indoor',4,'Available','2026-04-13 03:23:39');
INSERT INTO "cafe_tables" ("id","table_number","zone","seats","status","created_at") VALUES('t05',5,'Outdoor',2,'Available','2026-04-13 03:23:39');
INSERT INTO "cafe_tables" ("id","table_number","zone","seats","status","created_at") VALUES('t06',6,'Outdoor',2,'Available','2026-04-13 03:23:39');
INSERT INTO "cafe_tables" ("id","table_number","zone","seats","status","created_at") VALUES('t07',7,'Outdoor',4,'Reserved','2026-04-13 03:23:39');
INSERT INTO "cafe_tables" ("id","table_number","zone","seats","status","created_at") VALUES('t08',8,'Outdoor',4,'Available','2026-04-13 03:23:39');
INSERT INTO "cafe_tables" ("id","table_number","zone","seats","status","created_at") VALUES('t09',9,'Outdoor',6,'Available','2026-04-13 03:23:39');
INSERT INTO "cafe_tables" ("id","table_number","zone","seats","status","created_at") VALUES('t10',10,'VIP',4,'Reserved','2026-04-13 03:23:39');
INSERT INTO "cafe_tables" ("id","table_number","zone","seats","status","created_at") VALUES('t11',11,'VIP',6,'Reserved','2026-04-13 03:23:39');
INSERT INTO "cafe_tables" ("id","table_number","zone","seats","status","created_at") VALUES('t12',12,'VIP',8,'Reserved','2026-04-13 03:23:39');
CREATE TABLE menu_items (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    description TEXT,
    tags TEXT,  -- JSON array: ["Hot/Cold", "300ml"]
    badge TEXT,
    available BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('c001','coffee','Espresso',45000,'Cà phê nguyên chất 100% Arabica, đậm đà, hậu vị đắng nhẹ','["Hot/Cold", "30ml"]','Best Seller',1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('c002','coffee','Cappuccino',55000,'Espresso + sữa nóng đánh bọt + lớp foam dày','["Hot", "180ml"]',NULL,1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('c003','coffee','Latte Art',60000,'Espresso + sữa tươi + nghệ thuật vẽ hình trên foam','["Hot/Cold", "240ml"]','Popular',1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('c004','coffee','Cà Phê Sữa Đá',35000,'Cà phê phin truyền thống + sữa đặc + đá','["Cold", "200ml"]','Vietnamese Classic',1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('c005','coffee','Bạc Xỉu Đá',35000,'Sữa nóng + foam + cà phê espresso, vị béo ngọt','["Cold", "200ml"]',NULL,1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('c006','coffee','Cold Brew Tower (12h)',55000,'Cà phê ủ lạnh 12 giờ, vị mượt, ít axit','["Cold", "300ml"]','Slow Brew',1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('c007','coffee','Pour Over V60',55000,'Cà phê single-origin pha pour-over, hương vị tinh tế','["Hot", "200ml"]','Specialty',1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('c008','coffee','Caramel Macchiato',55000,'Espresso + vanilla syrup + caramel drizzle','["Hot/Cold", "350ml"]',NULL,1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('s001','signature','Container Special',65000,'Signature độc quyền: Espresso + tonic + cam slice','["Cold", "300ml"]','Signature',1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('s002','signature','Dirty Matcha Latte',55000,'Matcha Nhật Bản + espresso double shot','["Hot/Cold", "300ml"]',NULL,1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('s003','signature','Trà Sen Vàng',45000,'Trà sen + hạt sen + đường phèn','["Hot/Cold", "350ml"]',NULL,1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('s004','signature','Kombucha Tươi',45000,'Trà lên men tự nhiên, tốt cho tiêu hóa','["Cold", "300ml"]','Healthy',1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('s005','signature','Soda Chanh Bạc Hà',40000,'Soda tươi + chanh + bạc hà + đá','["Cold", "300ml"]',NULL,1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('s006','signature','Trái Cây Nhiệt Đới',50000,'Xoài, dâu, thơm xay nhuyễn + sữa','["Cold", "400ml"]',NULL,1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('s007','signature','Matcha Latte',50000,'Bột matcha Nhật + sữa tươi nóng/lạnh','["Hot/Cold", "300ml"]',NULL,1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('k001','snacks','Bánh Mì Chả Lụa',35000,'Bánh mì baguette + chả lụa + đồ chua','["Hot", "1 ổ"]',NULL,1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('k002','snacks','Sandwich Trứng',40000,'Bánh mì sandwich + trứng ốp la + xà lách','["Hot", "1 cái"]',NULL,1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('k003','snacks','Croissant Bơ Pháp',45000,'Croissant nướng bơ Pháp, giòn tan','["Hot", "1 cái"]','French Style',1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('k004','snacks','Granola Bowl',55000,'Granola + sữa chua Hy Lạp + trái cây tươi','["Cold", "300g"]','Healthy',1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('k005','snacks','Cookie Choco Chip',30000,'Cookie nướng giòn với sô cô la chip','["Hot", "2 cái"]',NULL,1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('k006','snacks','Cheesecake Slice',55000,'Cheesecake New York slice, béo ngậy','["Cold", "1 slice"]',NULL,1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('k007','snacks','Khoai Tây Chiên',45000,'Khoai tây chiên giòn + sốt cà chua/mayo','["Hot", "100g"]',NULL,1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('combo001','combo','Combo 2 Người',99000,'2 cà phê bất kỳ + 1 đồ ăn nhẹ','["Tiết kiệm 21K"]','Best Value',1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('combo002','combo','Combo Nhóm 4',189000,'4 đồ uống bất kỳ + 2 đồ ăn nhẹ','["Tiết kiệm 31K"]','Group Deal',1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('combo003','combo','Set Breakfast',55000,'1 cà phê + 1 bánh mì/sandwich (7:00-9:00)','["7:00-9:00"]','Morning',1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('combo004','combo','+ Phần Ăn Thêm',25000,'Thêm phần ăn nhẹ bất kỳ vào combo','["Add-on"]',NULL,1,'2026-04-13 03:23:39','2026-04-13 03:23:39');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('tc001','traditional-coffee','Cà phê máy/ phin (Iced/Hot Coffee)',20000,'','["Iced/Hot"]',NULL,1,'2026-05-05 01:41:24','2026-05-05 01:41:24');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('tc002','traditional-coffee','Cà phê sữa máy/ phin (Iced/Hot Milk Coffee)',25000,'','["Iced/Hot"]','Best Seller',1,'2026-05-05 01:41:24','2026-05-05 01:41:24');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('tc003','traditional-coffee','Cà phê/ Matcha muối (Salted Coffee / Matcha)',28000,'','["Iced/Hot"]','Signature',1,'2026-05-05 01:41:24','2026-05-05 01:41:24');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('tc004','traditional-coffee','Bạc xỉu đá/ nóng (Iced/ Hot White Coffee)',28000,'','["Iced/Hot"]',NULL,1,'2026-05-05 01:41:24','2026-05-05 01:41:24');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('tc005','traditional-coffee','Ca cao đá/ nóng (Iced/Hot Cocoa)',20000,'','["Iced/Hot"]',NULL,1,'2026-05-05 01:41:24','2026-05-05 01:41:24');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('tc006','traditional-coffee','Ca cao sữa đá/ nóng (Iced/Hot Milk Cocoa)',30000,'','["Iced/Hot"]',NULL,1,'2026-05-05 01:41:24','2026-05-05 01:41:24');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('tc007','traditional-coffee','Matcha latte đá (Iced Matcha Latte)',25000,'','["Iced"]',NULL,1,'2026-05-05 01:41:24','2026-05-05 01:41:24');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('hc001','hot-coffee','Cà phê kiểu Ý (Espresso)',20000,'','["Hot"]',NULL,1,'2026-05-05 01:41:24','2026-05-05 01:41:24');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('hc002','hot-coffee','Cà phê kiểu Mỹ (Americano)',25000,'','["Hot"]',NULL,1,'2026-05-05 01:41:24','2026-05-05 01:41:24');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('hc003','hot-coffee','Cà phê bọt sữa (Cappuccino)',35000,'','["Hot"]',NULL,1,'2026-05-05 01:41:24','2026-05-05 01:41:24');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('hc004','hot-coffee','Cà phê và Socola (Mocha)',35000,'','["Hot"]',NULL,1,'2026-05-05 01:41:25','2026-05-05 01:41:25');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('hc005','hot-coffee','Cà phê sữa nóng kiểu Ý (Latte)',35000,'','["Hot"]',NULL,1,'2026-05-05 01:41:25','2026-05-05 01:41:25');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('hc006','hot-coffee','Trà xanh sữa nóng (Greentea Latte)',35000,'','["Hot"]',NULL,1,'2026-05-05 01:41:25','2026-05-05 01:41:25');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('fp001','frappuccino','Cà phê đá xay (Coffee Frappu)',35000,'','["Blended"]','Popular',1,'2026-05-05 01:41:25','2026-05-05 01:41:25');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('fp002','frappuccino','Cà phê bánh xay (Cookie Frappu)',35000,'','["Blended"]',NULL,1,'2026-05-05 01:41:25','2026-05-05 01:41:25');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('fp003','frappuccino','Cà phê Socola đá xay (Mocha Frappu)',35000,'','["Blended"]',NULL,1,'2026-05-05 01:41:25','2026-05-05 01:41:25');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('fp004','frappuccino','Cà phê Dừa Việt quốc (Coconut Blueberry Coffee Ice)',35000,'','["Blended"]','Signature',1,'2026-05-05 01:41:25','2026-05-05 01:41:25');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('fp005','frappuccino','Sữa chua Việt quốc bánh xay (Blueberry Yogurt Frappu)',35000,'','["Blended"]',NULL,1,'2026-05-05 01:41:25','2026-05-05 01:41:25');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('fp006','frappuccino','Trà xanh đá xay (Matcha Frappu)',35000,'','["Blended"]',NULL,1,'2026-05-05 01:41:25','2026-05-05 01:41:25');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('sd001','soda','Sapphire (Blue Curacao Soda)',25000,'','["Iced"]',NULL,1,'2026-05-05 01:41:25','2026-05-05 01:41:25');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('sd002','soda','Emerald (Mint Soda)',25000,'','["Iced"]',NULL,1,'2026-05-05 01:41:25','2026-05-05 01:41:25');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('te001','tea','Lipton chanh đá/nóng (Iced/Hot Lemon Lipton)',18000,'','["Iced/Hot"]',NULL,1,'2026-05-05 01:41:25','2026-05-05 01:41:25');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('te002','tea','Lipton sữa đá/ nóng (Iced/Hot Milk Lipton)',25000,'','["Iced/Hot"]',NULL,1,'2026-05-05 01:41:25','2026-05-05 01:41:25');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('te003','tea','Lipton cam đá/ nóng (Iced/Hot Orange Lipton)',25000,'','["Iced/Hot"]',NULL,1,'2026-05-05 01:41:25','2026-05-05 01:41:25');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('te004','tea','Trà cúc thảo mộc đá/ nóng (Iced/Hot Herbal Chamomile Tea)',29000,'','["Iced/Hot"]',NULL,1,'2026-05-05 01:41:25','2026-05-05 01:41:25');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('te005','tea','Trà mãng cầu (Soursop Tea)',29000,'','["Iced/Hot"]',NULL,1,'2026-05-05 01:41:26','2026-05-05 01:41:26');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('te006','tea','Trà đào (Peach Tea)',30000,'','["Iced/Hot"]','Popular',1,'2026-05-05 01:41:26','2026-05-05 01:41:26');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('sm001','smoothies','Sinh tố Dâu (Strawberry Smoothie)',35000,'','["Blended"]',NULL,1,'2026-05-05 01:41:26','2026-05-05 01:41:26');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('sm002','smoothies','Sinh tố Bơ (Avocado Smoothie)',35000,'','["Blended"]','Best Seller',1,'2026-05-05 01:41:26','2026-05-05 01:41:26');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('sm003','smoothies','Sinh tố Mãng cầu (Soursop Smoothie)',35000,'','["Blended"]',NULL,1,'2026-05-05 01:41:26','2026-05-05 01:41:26');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('sm004','smoothies','Sinh tố Sapo (Sapodilla Smoothie)',35000,'','["Blended"]',NULL,1,'2026-05-05 01:41:26','2026-05-05 01:41:26');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('yg001','yogurt','Yaourt đá (Iced Yogurt)',20000,'','["Iced"]',NULL,1,'2026-05-05 01:41:26','2026-05-05 01:41:26');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('yg002','yogurt','Yaourt cà phê (Coffee Yogurt)',23000,'','["Iced"]',NULL,1,'2026-05-05 01:41:26','2026-05-05 01:41:26');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('yg003','yogurt','Yaourt Việt Quốc (Blueberry Yogurt)',25000,'','["Iced"]',NULL,1,'2026-05-05 01:41:26','2026-05-05 01:41:26');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('yg004','yogurt','Yaourt hủ (Traditional Jar Yogurt)',15000,'','["Original"]',NULL,1,'2026-05-05 01:41:26','2026-05-05 01:41:26');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('jc001','juice','Đá chanh (Iced Lemonade)',18000,'','["Iced"]',NULL,1,'2026-05-05 01:41:26','2026-05-05 01:41:26');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('jc002','juice','Rau má (Centella Juice)',18000,'','["Iced"]',NULL,1,'2026-05-05 01:41:26','2026-05-05 01:41:26');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('jc003','juice','Rau má dừa/sữa (Centella with Coconut/Milk)',25000,'','["Iced"]',NULL,1,'2026-05-05 01:41:26','2026-05-05 01:41:26');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('jc004','juice','Dừa trái (Fresh Coconut)',23000,'','["Iced"]',NULL,1,'2026-05-05 01:41:26','2026-05-05 01:41:26');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('jc005','juice','Dừa đá (Iced Coconut Water)',25000,'','["Iced"]',NULL,1,'2026-05-05 01:41:26','2026-05-05 01:41:26');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('jc006','juice','Cam vắt (Fresh Orange Juice)',23000,'','["Fresh"]',NULL,1,'2026-05-05 01:41:26','2026-05-05 01:41:26');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('od001','other-drinks','Trà đường (Sweetened Iced Tea)',18000,'','["Iced"]',NULL,1,'2026-05-05 01:41:27','2026-05-05 01:41:27');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('od002','other-drinks','Bình trà bắc (Northern Green Tea Pot)',15000,'','["Hot"]',NULL,1,'2026-05-05 01:41:27','2026-05-05 01:41:27');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('od003','other-drinks','Đá me (Iced Tamarind)',18000,'','["Iced"]',NULL,1,'2026-05-05 01:41:27','2026-05-05 01:41:27');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('od004','other-drinks','Chanh muối (Iced Salty Lemonade)',18000,'','["Iced"]',NULL,1,'2026-05-05 01:41:27','2026-05-05 01:41:27');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('od005','other-drinks','Sữa tươi (Fresh Milk)',20000,'','["Cold"]',NULL,1,'2026-05-05 01:41:27','2026-05-05 01:41:27');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('bt001','bottled','Nước suối (Mineral Water)',10000,'','["Bottled"]',NULL,1,'2026-05-05 01:41:27','2026-05-05 01:41:27');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('bt002','bottled','Sting/ Coca/ Pepsi/ 7 UP/ Ô long (Soft Drinks)',15000,'','["Bottled"]',NULL,1,'2026-05-05 01:41:27','2026-05-05 01:41:27');
INSERT INTO "menu_items" ("id","category","name","price","description","tags","badge","available","created_at","updated_at") VALUES('bt003','bottled','Redbull (Energy Drink)',20000,'','["Bottled"]',NULL,1,'2026-05-05 01:41:27','2026-05-05 01:41:27');
CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    phone TEXT,
    loyalty_points INTEGER DEFAULT 0,
    loyalty_tier TEXT DEFAULT 'bronze',  -- bronze, silver, gold, platinum
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "customers" ("id","email","name","phone","loyalty_points","loyalty_tier","created_at","updated_at") VALUES('CUST_mod5frzisnnt2','huuthong.dongthap@gmail.com','Phan Thong','0913211434',0,'bronze','2026-04-24 16:53:00','2026-05-04 09:40:06');
CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    items TEXT NOT NULL,  -- JSON array of order items
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, confirmed, preparing, ready, delivered, cancelled
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    customer_address TEXT,
    payment_method TEXT NOT NULL,  -- cod, momo, vnpay, payos
    payment_status TEXT DEFAULT 'unpaid',  -- unpaid, paid, refunded
    shipping_fee INTEGER DEFAULT 0,
    discount INTEGER DEFAULT 0,
    notes TEXT,
    delivery_time TEXT,  -- 'now' or scheduled time
    table_id TEXT,       -- FK to cafe_tables (nullable, for dine-in)
    subtotal INTEGER,
    tax INTEGER DEFAULT 0,
    total_amount INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, cashback_used REAL DEFAULT 0, cashback_earned REAL DEFAULT 0, points_earned INTEGER DEFAULT 0, reward_code_used TEXT,
    FOREIGN KEY (table_id) REFERENCES cafe_tables(id)
);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mo3pe54i17vr6','[{"product_id":"c005","name":"Bạc Xỉu Đá","price":35000,"quantity":1},{"product_id":"c004","name":"Cà Phê Sữa Đá","price":35000,"quantity":1},{"product_id":"c001","name":"Espresso","price":45000,"quantity":1},{"product_id":"combo003","name":"Set Breakfast","price":55000,"quantity":1}]',178500,'preparing','Thong test','0912333211',NULL,NULL,'cod','unpaid',0,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-18 02:13:54','2026-05-04 09:40:48',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mo3sfcc6f91f6','[{"product_id":"c004","name":"Cà Phê Sữa Đá","price":35000,"quantity":1},{"product_id":"c007","name":"Pour Over V60","price":55000,"quantity":1},{"product_id":"s001","name":"Container Special","price":65000,"quantity":1}]',162750,'pending','Khách lẻ','0000000000',NULL,NULL,'cod','unpaid',0,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-18 03:38:50','2026-04-18 03:38:50',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mo3vdo94hizqu','[{"product_id":"c007","name":"Pour Over V60","price":55000,"quantity":1},{"product_id":"c004","name":"Cà Phê Sữa Đá","price":35000,"quantity":1},{"product_id":"c001","name":"Espresso","price":45000,"quantity":1}]',141750,'preparing','Khách lẻ','0000000000',NULL,NULL,'payos','unpaid',0,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-18 05:01:30','2026-05-04 09:40:50',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mo46y8rm9f7cm','[{"product_id":"c007","name":"Pour Over V60","price":55000,"quantity":1},{"product_id":"c003","name":"Latte Art","price":60000,"quantity":1}]',120750,'preparing','Khách lẻ','0000000000',NULL,NULL,'payos','unpaid',0,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-18 10:25:26','2026-05-04 09:40:51',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mo61z099kc3vh','[{"product_id":1,"name":"Coffee","price":50000,"quantity":1}]',52500,'pending','Test User','0987654321',NULL,NULL,'cod','unpaid',0,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-19 17:41:36','2026-04-19 17:41:36',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mo627lphqof4z','[{"product_id":"c005","name":"Bạc Xỉu Đá","price":35000,"quantity":1},{"product_id":"c006","name":"Cold Brew Tower (12h)","price":55000,"quantity":1}]',94500,'pending','Khách lẻ','0000000000',NULL,NULL,'cod','unpaid',0,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-19 17:48:17','2026-04-19 17:48:17',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mo627z13r34kg','[{"product_id":"c005","name":"Bạc Xỉu Đá","price":35000,"quantity":1},{"product_id":"c006","name":"Cold Brew Tower (12h)","price":55000,"quantity":1}]',94500,'pending','Khách lẻ','0000000000',NULL,NULL,'payos','unpaid',0,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-19 17:48:34','2026-04-19 17:48:34',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mo6osva94namf','[{"product_id":"c006","name":"Cold Brew Tower (12h)","price":55000,"quantity":1},{"product_id":"c004","name":"Cà Phê Sữa Đá","price":35000,"quantity":1}]',94500,'preparing','Khách lẻ','0000000000',NULL,NULL,'cod','unpaid',0,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-20 04:20:40','2026-05-04 09:41:09',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mo6zcqi6zxp54','[{"product_id":"c006","name":"Cold Brew Tower (12h)","price":55000,"quantity":1},{"product_id":"c005","name":"Bạc Xỉu Đá","price":35000,"quantity":1},{"product_id":"c007","name":"Pour Over V60","price":55000,"quantity":1}]',152250,'preparing','Khách lẻ','0000000000',NULL,NULL,'cod','unpaid',0,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-20 09:16:04','2026-05-04 09:41:07',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mo73pl1slmgx8','[{"product_id":"c006","name":"Cold Brew Tower (12h)","price":55000,"quantity":1},{"product_id":"c007","name":"Pour Over V60","price":55000,"quantity":1}]',115500,'preparing','Khách lẻ','0000000000',NULL,NULL,'cod','unpaid',0,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-20 11:18:01','2026-05-04 09:41:06',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mo73tw9lolor3','[{"product_id":"c007","name":"Pour Over V60","price":55000,"quantity":1},{"product_id":"c001","name":"Espresso","price":45000,"quantity":1},{"product_id":"c005","name":"Bạc Xỉu Đá","price":35000,"quantity":1},{"product_id":"c006","name":"Cold Brew Tower (12h)","price":55000,"quantity":1}]',199500,'pending','Khách lẻ','0000000000',NULL,NULL,'cod','unpaid',0,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-20 11:21:23','2026-04-20 11:21:23',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mod5frwnu1qbe','[{"id":"c005","name":"Bạc Xỉu Đá","price":35000,"quantity":2,"category":"","emoji":""},{"id":"c006","name":"Cold Brew Tower (12h)","price":55000,"quantity":2,"category":"","emoji":""},{"id":"c003","name":"Latte Art","price":60000,"quantity":1,"category":"","emoji":""}]',255000,'ready','Phan Thong','0913211434','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, Phường 2, Sa Đéc, Đồng Tháp','cod','unpaid',15000,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-24 16:53:00','2026-04-26 09:49:50',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_moe42q9n9jl84','[{"id":"c005","name":"Bạc Xỉu Đá","price":35000,"quantity":3,"category":"","emoji":""},{"id":"c006","name":"Cold Brew Tower (12h)","price":55000,"quantity":3,"category":"","emoji":""},{"id":"c003","name":"Latte Art","price":60000,"quantity":1,"category":"","emoji":""},{"id":"c007","name":"Pour Over V60","price":55000,"quantity":1,"category":"","emoji":""}]',385000,'ready','Phan Thong','0913211434','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, Hòa Thuận, Sa Đéc, Đồng Tháp','payos','unpaid',0,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-25 09:02:38','2026-05-13 09:41:37',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_moe4sjerxq8x4','[{"id":"c005","name":"Bạc Xỉu Đá","price":35000,"quantity":4,"category":"","emoji":""},{"id":"c006","name":"Cold Brew Tower (12h)","price":55000,"quantity":4,"category":"","emoji":""},{"id":"c003","name":"Latte Art","price":60000,"quantity":2,"category":"","emoji":""},{"id":"c007","name":"Pour Over V60","price":55000,"quantity":1,"category":"","emoji":""}]',535000,'pending','Huu Thong Phan','0913211222','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, , Sa Đéc, Đồng Tháp','cod','unpaid',0,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-25 09:22:42','2026-04-25 09:22:42',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_moegi2b3q7pbe','[{"name":"Cà phê test","qty":1,"price":35000}]',35000,'pending','Test Bot','0913211434',NULL,NULL,'cod','unpaid',0,0,'Telegram smoke test','now',NULL,NULL,0,NULL,'2026-04-25 14:50:29','2026-04-25 14:50:29',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_moegjsgcpnkjo','[{"name":"Tail test","qty":1,"price":35000}]',35000,'pending','Tail','0913211434',NULL,NULL,'cod','unpaid',0,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-25 14:51:49','2026-04-25 14:51:49',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_moegn1l2frzjy','[{"name":"Espresso","qty":2,"price":45000},{"name":"Bánh croissant","qty":1,"price":35000}]',125000,'pending','Hữu Thong','0913211434',NULL,'Bàn 5','cod','unpaid',0,0,'Ít đường','now',NULL,NULL,0,NULL,'2026-04-25 14:54:21','2026-04-25 14:54:21',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_moegng3997d2y','[{"name":"Cà phê waitUntil test","qty":1,"price":35000}]',35000,'pending','WaitUntil Test','0913211434',NULL,NULL,'cod','unpaid',0,0,'Telegram via waitUntil','now',NULL,NULL,0,NULL,'2026-04-25 14:54:40','2026-04-25 14:54:40',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_moegqutfnzi2r','[{"name":"Cà phê waitUntil test","qty":1,"price":35000}]',35000,'ready','WaitUntil Test','0913211434',NULL,NULL,'cod','unpaid',0,0,'Telegram via waitUntil','now',NULL,NULL,0,NULL,'2026-04-25 14:57:19','2026-04-26 03:21:01',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_moeuyhpovijwv','[{"name":"Final ship test","qty":1,"price":35000}]',35000,'pending','Final','0913211434',NULL,NULL,'cod','unpaid',0,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-25 21:35:10','2026-04-25 21:35:10',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_moev1giba8j17','[{"id":"c005","name":"Bạc Xỉu Đá","price":35000,"quantity":4,"category":"","emoji":""},{"id":"c006","name":"Cold Brew Tower (12h)","price":55000,"quantity":5,"category":"","emoji":""},{"id":"c003","name":"Latte Art","price":60000,"quantity":3,"category":"","emoji":""},{"id":"c007","name":"Pour Over V60","price":55000,"quantity":1,"category":"","emoji":""}]',650000,'completed','Huu Thong Phan','0912333111','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, Phường 2, Sa Đéc, Đồng Tháp','cod','unpaid',0,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-25 21:37:28','2026-04-26 03:21:15',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_moev5hwyy65lb','[{"id":"c005","name":"Bạc Xỉu Đá","price":35000,"quantity":4,"category":"","emoji":""},{"id":"c006","name":"Cold Brew Tower (12h)","price":55000,"quantity":5,"category":"","emoji":""},{"id":"c003","name":"Latte Art","price":60000,"quantity":3,"category":"","emoji":""},{"id":"c007","name":"Pour Over V60","price":55000,"quantity":1,"category":"","emoji":""},{"id":"c002","name":"Cappuccino","price":55000,"quantity":1,"category":"","emoji":""},{"id":"c008","name":"Caramel Macchiato","price":55000,"quantity":1,"category":"","emoji":""}]',760000,'pending','Huu Thong Phan','0911222333','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, , Sa Đéc, Đồng Tháp','cod','unpaid',0,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-25 21:40:37','2026-04-25 21:40:37',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_moevd5lny7xdo','[{"id":"c005","name":"Bạc Xỉu Đá","price":35000,"quantity":5,"category":"","emoji":""},{"id":"c006","name":"Cold Brew Tower (12h)","price":55000,"quantity":6,"category":"","emoji":""},{"id":"c003","name":"Latte Art","price":60000,"quantity":3,"category":"","emoji":""},{"id":"c007","name":"Pour Over V60","price":55000,"quantity":1,"category":"","emoji":""},{"id":"c002","name":"Cappuccino","price":55000,"quantity":1,"category":"","emoji":""},{"id":"c008","name":"Caramel Macchiato","price":55000,"quantity":1,"category":"","emoji":""}]',850000,'pending','Huu Thong Phan','0915997989','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, , Sa Đéc, Đồng Tháp','payos','unpaid',0,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-25 21:46:34','2026-04-25 21:46:34',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_moevzb5ugb3ol','[{"id":"c004","name":"Cà Phê Sữa Đá","price":35000,"quantity":1,"category":"","emoji":""},{"id":"c007","name":"Pour Over V60","price":55000,"quantity":1,"category":"","emoji":""}]',105000,'pending','Phan Thong','0913211434','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, Phường 2, Sa Đéc, Đồng Tháp','cod','unpaid',15000,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-25 22:03:48','2026-04-25 22:03:48',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mof66sn1tn3uv','[{"id":"c007","name":"Pour Over V60","price":55000,"quantity":1,"category":"","emoji":""},{"id":"c001","name":"Espresso","price":45000,"quantity":1,"category":"","emoji":""},{"id":"c002","name":"Cappuccino","price":55000,"quantity":1,"category":"","emoji":""}]',170000,'ready','Phan Thong','0913211434','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, Phường 2, Sa Đéc, Đồng Tháp','cod','unpaid',15000,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-26 02:49:33','2026-05-13 09:41:35',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mof6d8i33voj1','[{"id":"c008","name":"Caramel Macchiato","price":55000,"quantity":1,"category":"","emoji":""},{"id":"c001","name":"Espresso","price":45000,"quantity":1,"category":"","emoji":""},{"id":"c004","name":"Cà Phê Sữa Đá","price":35000,"quantity":1,"category":"","emoji":""},{"id":"s001","name":"Container Special","price":65000,"quantity":1,"category":"","emoji":""}]',215000,'pending','Phan Thong','0913211434','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, Phường 2, Sa Đéc, Đồng Tháp','cod','unpaid',15000,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-26 02:54:34','2026-05-04 09:41:17',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mof6nls05lz3t','[{"id":"c001","name":"Espresso","price":45000,"quantity":1,"category":"","emoji":""},{"id":"c007","name":"Pour Over V60","price":55000,"quantity":1,"category":"","emoji":""}]',115000,'completed','Phan Thong','0913211434','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, Phường 2, Sa Đéc, Đồng Tháp','cod','unpaid',15000,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-26 03:02:37','2026-04-27 14:44:00',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mof75lxz74vnq','[{"id":"c001","name":"Espresso","price":45000,"quantity":1,"category":"","emoji":""},{"id":"c004","name":"Cà Phê Sữa Đá","price":35000,"quantity":1,"category":"","emoji":""},{"id":"k002","name":"Sandwich Trứng","price":40000,"quantity":1,"category":"","emoji":""},{"id":"k001","name":"Bánh Mì Chả Lụa","price":35000,"quantity":1,"category":"","emoji":""},{"id":"combo001","name":"Combo 2 Người","price":99000,"quantity":1,"category":"","emoji":""}]',269000,'completed','Phan Thong','0913211434','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, Phường 2, Sa Đéc, Đồng Tháp','cod','unpaid',15000,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-26 03:16:37','2026-04-26 03:18:02',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mof7l3nrygmgb','[{"name":"Tail debug","qty":1,"price":35000}]',35000,'pending','Debug','0913211434',NULL,NULL,'cod','unpaid',0,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-26 03:28:40','2026-04-26 03:28:40',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mof7mau1sy78e','[{"name":"Telegram HTML test","qty":1,"price":45000}]',45000,'pending','Debug HTML','0913211434',NULL,NULL,'cod','unpaid',0,0,'kiểm tra & <bold>','now',NULL,NULL,0,NULL,'2026-04-26 03:29:36','2026-04-26 03:29:36',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mofkg330mm3ce','[{"id":"c003","name":"Latte Art","price":60000,"quantity":1,"category":"","emoji":""},{"id":"c007","name":"Pour Over V60","price":55000,"quantity":1,"category":"","emoji":""},{"id":"c001","name":"Espresso","price":45000,"quantity":1,"category":"","emoji":""}]',175000,'pending','Phan Thong','0913211434','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, Phường 2, Sa Đéc, Đồng Tháp','cod','unpaid',15000,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-26 09:28:41','2026-04-26 09:28:41',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mofkhgsronstp','[{"id":"c005","name":"Bạc Xỉu Đá","price":35000,"quantity":1,"category":"","emoji":""}]',50000,'San sang','Huu Thong Phan','0913211434','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, Hòa Thuận, Sa Đéc, Đồng Tháp','payos','paid',15000,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-26 09:29:46','2026-04-26 09:31:47',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mofktmvm7cki7','[{"id":"c005","name":"Bạc Xỉu Đá","price":35000,"quantity":1,"category":"","emoji":""},{"id":"c006","name":"Cold Brew Tower (12h)","price":55000,"quantity":1,"category":"","emoji":""},{"id":"c004","name":"Cà Phê Sữa Đá","price":35000,"quantity":1,"category":"","emoji":""}]',140000,'pending','Huu Thong Phan','0913211434','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, Phường 2, Sa Đéc, Đồng Tháp','vnpay','unpaid',15000,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-26 09:39:13','2026-04-26 09:39:13',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mofkttvyqczex','[{"id":"c005","name":"Bạc Xỉu Đá","price":35000,"quantity":1,"category":"","emoji":""},{"id":"c006","name":"Cold Brew Tower (12h)","price":55000,"quantity":1,"category":"","emoji":""},{"id":"c004","name":"Cà Phê Sữa Đá","price":35000,"quantity":1,"category":"","emoji":""}]',140000,'pending','Huu Thong Phan','0913211434','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, Phường 2, Sa Đéc, Đồng Tháp','momo','unpaid',15000,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-26 09:39:22','2026-04-26 09:39:22',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mofku30mgib9c','[{"id":"c005","name":"Bạc Xỉu Đá","price":35000,"quantity":1,"category":"","emoji":""},{"id":"c006","name":"Cold Brew Tower (12h)","price":55000,"quantity":1,"category":"","emoji":""},{"id":"c004","name":"Cà Phê Sữa Đá","price":35000,"quantity":1,"category":"","emoji":""}]',140000,'pending','Huu Thong Phan','0913211434','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, Phường 2, Sa Đéc, Đồng Tháp','momo','unpaid',15000,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-26 09:39:34','2026-04-26 09:39:34',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mofku8p4pzymp','[{"id":"c005","name":"Bạc Xỉu Đá","price":35000,"quantity":1,"category":"","emoji":""},{"id":"c006","name":"Cold Brew Tower (12h)","price":55000,"quantity":1,"category":"","emoji":""},{"id":"c004","name":"Cà Phê Sữa Đá","price":35000,"quantity":1,"category":"","emoji":""}]',140000,'pending','Huu Thong Phan','0913211434','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, Phường 2, Sa Đéc, Đồng Tháp','vnpay','unpaid',15000,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-26 09:39:42','2026-04-26 09:39:42',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mofkuc33flxcz','[{"id":"c005","name":"Bạc Xỉu Đá","price":35000,"quantity":1,"category":"","emoji":""},{"id":"c006","name":"Cold Brew Tower (12h)","price":55000,"quantity":1,"category":"","emoji":""},{"id":"c004","name":"Cà Phê Sữa Đá","price":35000,"quantity":1,"category":"","emoji":""}]',140000,'pending','Huu Thong Phan','0913211434','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, Phường 2, Sa Đéc, Đồng Tháp','cod','unpaid',15000,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-26 09:39:46','2026-04-26 09:39:46',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mofkv9pua7i0n','[{"id":"c007","name":"Pour Over V60","price":55000,"quantity":1,"category":"","emoji":""},{"id":"c006","name":"Cold Brew Tower (12h)","price":55000,"quantity":1,"category":"","emoji":""}]',125000,'completed','Huu Thong Phan','0913211434','huuthong.dongthap@gmail.com','12, Phường 2, Sa Đéc, Đồng Tháp','cod','unpaid',15000,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-26 09:40:30','2026-05-13 09:41:53',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mofkx93t0ywsq','[{"id":"c006","name":"Cold Brew Tower (12h)","price":55000,"quantity":1,"category":"","emoji":""},{"id":"c001","name":"Espresso","price":45000,"quantity":1,"category":"","emoji":""}]',115000,'completed','Phan Thong','0913211434','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, , Sa Đéc, Đồng Tháp','payos','paid',15000,0,NULL,'2026-04-28T20:00',NULL,NULL,0,NULL,'2026-04-26 09:42:02','2026-04-26 09:50:00',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mofljzs40p0n4','[{"id":"c006","name":"Cold Brew Tower (12h)","price":55000,"quantity":1,"category":"","emoji":""}]',70000,'pending','Test','0911222333',NULL,'11, Phường 1, Sa Đéc, Đồng Tháp','cod','unpaid',15000,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-26 09:59:43','2026-04-26 09:59:43',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_moflobl252haz','[{"id":"c004","name":"Cà Phê Sữa Đá","price":35000,"quantity":1,"category":"","emoji":""}]',50000,'pending','Test1','0912333222',NULL,'123, Phường 2, Sa Đéc, Đồng Tháp','cod','unpaid',15000,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-26 10:03:05','2026-04-26 10:03:05',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mohb3k5t1msvh','[{"id":"c005","name":"Bạc Xỉu Đá","price":35000,"quantity":1,"category":"","emoji":""},{"id":"c006","name":"Cold Brew Tower (12h)","price":55000,"quantity":1,"category":"","emoji":""},{"id":"c003","name":"Latte Art","price":60000,"quantity":1,"category":"","emoji":""}]',165000,'completed','Phan Thong','0913211434','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, Phường 1, Sa Đéc, Đồng Tháp','cod','unpaid',15000,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-27 14:42:33','2026-04-27 14:43:59',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mohdkulakozp6','[{"id":"k007","name":"Khoai Tây Chiên","price":45000,"qty":1},{"id":"k002","name":"Sandwich Trứng","price":40000,"qty":1},{"id":"k004","name":"Granola Bowl","price":55000,"qty":1}]',151200,'confirmed','Walk-in','0000000000',NULL,NULL,'cash','paid',0,0,'Mang về | Staff: AURA Owner','now',NULL,NULL,0,NULL,'2026-04-27 15:51:58','2026-04-27 15:52:00',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mohdmvgycaupq','[{"id":"k002","name":"Sandwich Trứng","price":40000,"qty":1},{"id":"k007","name":"Khoai Tây Chiên","price":45000,"qty":1}]',91800,'preparing','Walk-in','0000000000',NULL,NULL,'payos','unpaid',0,0,'Mang về | Staff: AURA Owner','now',NULL,NULL,0,NULL,'2026-04-27 15:53:33','2026-05-13 09:41:40',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_moi6n5yhe07mu','[{"id":"c004","name":"Cà Phê Sữa Đá","price":35000,"quantity":1,"category":"","emoji":""},{"id":"c007","name":"Pour Over V60","price":55000,"quantity":1,"category":"","emoji":""},{"id":"c001","name":"Espresso","price":45000,"quantity":1,"category":"","emoji":""}]',150000,'preparing','Phan Thong','0913211434','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, Phường 2, Sa Đéc, Đồng Tháp','cod','unpaid',15000,0,NULL,'now',NULL,NULL,0,NULL,'2026-04-28 05:25:35','2026-05-13 09:41:39',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mor0ctub65zwv','[{"id":1,"name":"Cà Phê Phin Truyền Thống","price":45000,"quantity":1,"category":"","emoji":""},{"id":2,"name":"Bạc Xỉu","price":55000,"quantity":1,"category":"","emoji":""}]',115000,'completed','Phan Thong','0913211434','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, Phường 2, Sa Đéc, Đồng Tháp','cod','unpaid',15000,0,NULL,'now',NULL,NULL,0,NULL,'2026-05-04 09:39:31','2026-05-13 09:41:52',0,0,0,NULL);
INSERT INTO "orders" ("id","items","total","status","customer_name","customer_phone","customer_email","customer_address","payment_method","payment_status","shipping_fee","discount","notes","delivery_time","table_id","subtotal","tax","total_amount","created_at","updated_at","cashback_used","cashback_earned","points_earned","reward_code_used") VALUES('ORD_mor0dkgz6ajhx','[{"id":1,"name":"Cà Phê Phin Truyền Thống","price":45000,"quantity":1,"category":"","emoji":""},{"id":2,"name":"Bạc Xỉu","price":55000,"quantity":1,"category":"","emoji":""}]',115000,'completed','Phan Thong','0913211434','huuthong.dongthap@gmail.com','Long Hau, Hoa Long, Phường 2, Sa Đéc, Đồng Tháp','cod','unpaid',15000,0,NULL,'now',NULL,NULL,0,NULL,'2026-05-04 09:40:06','2026-05-13 09:41:42',0,0,0,NULL);
CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    method TEXT NOT NULL,  -- cod, momo, vnpay, payos
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, completed, failed, refunded
    transaction_id TEXT,  -- External payment gateway transaction ID
    payment_url TEXT,  -- Payment redirect URL
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mo3pe54ywf1ge','ORD_mo3pe54i17vr6','cod',178500,'pending',NULL,NULL,'2026-04-18 02:13:54','2026-04-18 02:13:54');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mo3sfctgibcxo','ORD_mo3sfcc6f91f6','cod',162750,'pending',NULL,NULL,'2026-04-18 03:38:50','2026-04-18 03:38:50');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mo3vdo9lumd73','ORD_mo3vdo94hizqu','payos',141750,'pending',NULL,NULL,'2026-04-18 05:01:30','2026-04-18 05:01:30');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('pay_1776488491594_5hcb6','ORD_mo3vdo94hizqu','payos',141750,'pending','88491313','https://pay.payos.vn/web/0b85178f862a4e2f9a96257be759312c','2026-04-18T05:01:31.594Z','2026-04-18 05:01:31');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mo46y8s4giers','ORD_mo46y8rm9f7cm','payos',120750,'pending',NULL,NULL,'2026-04-18 10:25:26','2026-04-18 10:25:26');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('pay_1776507927012_1zic6','ORD_mo46y8rm9f7cm','payos',120750,'pending','7926795','https://pay.payos.vn/web/609ddee0afcb4b849f96819c276a92fe','2026-04-18T10:25:27.012Z','2026-04-18 10:25:27');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mo61z0qzb5e2x','ORD_mo61z099kc3vh','cod',52500,'pending',NULL,NULL,'2026-04-19 17:41:36','2026-04-19 17:41:36');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mo627lpv2loya','ORD_mo627lphqof4z','cod',94500,'pending',NULL,NULL,'2026-04-19 17:48:17','2026-04-19 17:48:17');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mo627z1moorij','ORD_mo627z13r34kg','payos',94500,'pending',NULL,NULL,'2026-04-19 17:48:34','2026-04-19 17:48:34');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('pay_1776620915290_57372','ORD_mo627z13r34kg','payos',94500,'pending','1776620915032916','https://pay.payos.vn/web/be025119e3f54ffd894a9a302f255fe4','2026-04-19T17:48:35.290Z','2026-04-19 17:48:35');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mo6osvbm58coo','ORD_mo6osva94namf','cod',94500,'pending',NULL,NULL,'2026-04-20 04:20:41','2026-04-20 04:20:41');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mo6zcqiluiy2z','ORD_mo6zcqi6zxp54','cod',152250,'pending',NULL,NULL,'2026-04-20 09:16:04','2026-04-20 09:16:04');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mo73pl2aoirph','ORD_mo73pl1slmgx8','cod',115500,'pending',NULL,NULL,'2026-04-20 11:18:01','2026-04-20 11:18:01');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mo73tw9zwahp5','ORD_mo73tw9lolor3','cod',199500,'pending',NULL,NULL,'2026-04-20 11:21:23','2026-04-20 11:21:23');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mod5fry6weerq','ORD_mod5frwnu1qbe','cod',255000,'pending',NULL,NULL,'2026-04-24 16:53:00','2026-04-24 16:53:00');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_moe42qa33jt2a','ORD_moe42q9n9jl84','payos',385000,'pending',NULL,NULL,'2026-04-25 09:02:38','2026-04-25 09:02:38');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('pay_1777107759401_bug22','ORD_moe42q9n9jl84','payos',385000,'pending','1777107759138426','https://pay.payos.vn/web/ab76178ca8044b7b8577958cede13b60','2026-04-25T09:02:39.401Z','2026-04-25 09:02:39');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_moe4sjfgpwl67','ORD_moe4sjerxq8x4','cod',535000,'pending',NULL,NULL,'2026-04-25 09:22:42','2026-04-25 09:22:42');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_moegi34flapwp','ORD_moegi2b3q7pbe','cod',35000,'pending',NULL,NULL,'2026-04-25 14:50:30','2026-04-25 14:50:30');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_moegjshru96lf','ORD_moegjsgcpnkjo','cod',35000,'pending',NULL,NULL,'2026-04-25 14:51:49','2026-04-25 14:51:49');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_moegn2653t9dh','ORD_moegn1l2frzjy','cod',125000,'pending',NULL,NULL,'2026-04-25 14:54:22','2026-04-25 14:54:22');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_moegng71wwsxh','ORD_moegng3997d2y','cod',35000,'pending',NULL,NULL,'2026-04-25 14:54:40','2026-04-25 14:54:40');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_moegqvcpkuwhj','ORD_moegqutfnzi2r','cod',35000,'pending',NULL,NULL,'2026-04-25 14:57:20','2026-04-25 14:57:20');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_moeuyi7vmj1nn','ORD_moeuyhpovijwv','cod',35000,'pending',NULL,NULL,'2026-04-25 21:35:11','2026-04-25 21:35:11');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_moev1gksoerws','ORD_moev1giba8j17','cod',650000,'pending',NULL,NULL,'2026-04-25 21:37:28','2026-04-25 21:37:28');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_moev5hy5apzv8','ORD_moev5hwyy65lb','cod',760000,'pending',NULL,NULL,'2026-04-25 21:40:37','2026-04-25 21:40:37');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_moevd5o5re9iv','ORD_moevd5lny7xdo','payos',850000,'pending',NULL,NULL,'2026-04-25 21:46:34','2026-04-25 21:46:34');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('pay_1777153595674_x7xee','ORD_moevd5lny7xdo','payos',850000,'pending','1777153595425090','https://pay.payos.vn/web/c1afc2530e9340fbac198f67be90337d','2026-04-25T21:46:35.674Z','2026-04-25 21:46:35');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_moevzb7atrsts','ORD_moevzb5ugb3ol','cod',105000,'pending',NULL,NULL,'2026-04-25 22:03:48','2026-04-25 22:03:48');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mof66snhrum2l','ORD_mof66sn1tn3uv','cod',170000,'pending',NULL,NULL,'2026-04-26 02:49:33','2026-04-26 02:49:33');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mof6d8ih435yc','ORD_mof6d8i33voj1','cod',215000,'pending',NULL,NULL,'2026-04-26 02:54:34','2026-04-26 02:54:34');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mof6nlsd7d4nd','ORD_mof6nls05lz3t','cod',115000,'pending',NULL,NULL,'2026-04-26 03:02:37','2026-04-26 03:02:37');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mof75lzcsddio','ORD_mof75lxz74vnq','cod',269000,'pending',NULL,NULL,'2026-04-26 03:16:37','2026-04-26 03:16:37');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mof7l3ql1dnji','ORD_mof7l3nrygmgb','cod',35000,'pending',NULL,NULL,'2026-04-26 03:28:40','2026-04-26 03:28:40');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mof7may1aqd0w','ORD_mof7mau1sy78e','cod',45000,'pending',NULL,NULL,'2026-04-26 03:29:36','2026-04-26 03:29:36');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mofkg34bmignp','ORD_mofkg330mm3ce','cod',175000,'pending',NULL,NULL,'2026-04-26 09:28:41','2026-04-26 09:28:41');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mofkhgvira2tu','ORD_mofkhgsronstp','payos',50000,'pending',NULL,NULL,'2026-04-26 09:29:46','2026-04-26 09:29:46');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('pay_1777195787129_18xqu','ORD_mofkhgsronstp','payos',50000,'completed','1777195786910942','https://pay.payos.vn/web/875df06f1f9843f894aa25902705d1dc','2026-04-26T09:29:47.129Z','2026-04-26 09:31:47');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mofktmzii30e2','ORD_mofktmvm7cki7','vnpay',140000,'pending',NULL,NULL,'2026-04-26 09:39:14','2026-04-26 09:39:14');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mofkttxj7lxxk','ORD_mofkttvyqczex','momo',140000,'pending',NULL,NULL,'2026-04-26 09:39:22','2026-04-26 09:39:22');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mofku31yzemj4','ORD_mofku30mgib9c','momo',140000,'pending',NULL,NULL,'2026-04-26 09:39:34','2026-04-26 09:39:34');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mofku8qiuct1a','ORD_mofku8p4pzymp','vnpay',140000,'pending',NULL,NULL,'2026-04-26 09:39:42','2026-04-26 09:39:42');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mofkuc708v32e','ORD_mofkuc33flxcz','cod',140000,'pending',NULL,NULL,'2026-04-26 09:39:46','2026-04-26 09:39:46');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mofkv9ukhlhyf','ORD_mofkv9pua7i0n','cod',125000,'pending',NULL,NULL,'2026-04-26 09:40:30','2026-04-26 09:40:30');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mofkx96re62eb','ORD_mofkx93t0ywsq','payos',115000,'pending',NULL,NULL,'2026-04-26 09:42:02','2026-04-26 09:42:02');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('pay_1777196523737_lw77i','ORD_mofkx93t0ywsq','payos',115000,'completed','1777196523424816','https://pay.payos.vn/web/16d3c18977e94b95aba8da592cec811a','2026-04-26T09:42:03.737Z','2026-04-26 09:43:07');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mofljzvu35mje','ORD_mofljzs40p0n4','cod',70000,'pending',NULL,NULL,'2026-04-26 09:59:43','2026-04-26 09:59:43');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_moflobmcmi2v9','ORD_moflobl252haz','cod',50000,'pending',NULL,NULL,'2026-04-26 10:03:05','2026-04-26 10:03:05');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mohb3knpgta2h','ORD_mohb3k5t1msvh','cod',165000,'pending',NULL,NULL,'2026-04-27 14:42:33','2026-04-27 14:42:33');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mohdkum35vclk','ORD_mohdkulakozp6','cash',151200,'completed',NULL,NULL,'2026-04-27 15:51:58','2026-04-27 15:52:00');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mohdmvhra1ovk','ORD_mohdmvgycaupq','payos',91800,'pending',NULL,NULL,'2026-04-27 15:53:33','2026-04-27 15:53:33');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('pay_1777305214284_1ahxh','ORD_mohdmvgycaupq','payos',91800,'pending','1777305214038956','https://pay.payos.vn/web/2ef29f1682c34bc28b4258b1881ce19b','2026-04-27T15:53:34.284Z','2026-04-27 15:53:34');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_moi6n5yyyd7ox','ORD_moi6n5yhe07mu','cod',150000,'pending',NULL,NULL,'2026-04-28 05:25:35','2026-04-28 05:25:35');
INSERT INTO "payments" ("id","order_id","method","amount","status","transaction_id","payment_url","created_at","updated_at") VALUES('PAY_mor0dl0s2wg2t','ORD_mor0dkgz6ajhx','cod',115000,'pending',NULL,NULL,'2026-05-04 09:40:06','2026-05-04 09:40:06');
CREATE TABLE order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    subtotal INTEGER NOT NULL,
    modifiers TEXT,      -- JSON: {"size":"L","ice":"less"}
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE TABLE reservations (id TEXT PRIMARY KEY, table_id TEXT NOT NULL, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, guest_count INTEGER NOT NULL DEFAULT 2, date TEXT NOT NULL, time TEXT NOT NULL, zone TEXT NOT NULL, status TEXT DEFAULT 'confirmed', notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (table_id) REFERENCES cafe_tables(id));
INSERT INTO "reservations" ("id","table_id","customer_name","customer_phone","guest_count","date","time","zone","status","notes","created_at","updated_at") VALUES('rsv_1776296370294_1ti9c','t11','thong','0912311434',2,'2026-04-17','10:00','VIP','confirmed',NULL,'2026-04-15T23:39:30.294Z','2026-04-15T23:39:30.294Z');
INSERT INTO "reservations" ("id","table_id","customer_name","customer_phone","guest_count","date","time","zone","status","notes","created_at","updated_at") VALUES('rsv_1777206355656_6wusc','t12','QQQ','0913122333',2,'2026-05-02','21:00','VIP','confirmed','','2026-04-26T12:25:55.656Z','2026-04-26T12:25:55.656Z');
INSERT INTO "reservations" ("id","table_id","customer_name","customer_phone","guest_count","date","time","zone","status","notes","created_at","updated_at") VALUES('rsv_1777206457334_x5kse','t11','XXX','0911291123',2,'2026-05-09','10:00','VIP','confirmed','','2026-04-26T12:27:37.334Z','2026-04-26T12:27:37.334Z');
INSERT INTO "reservations" ("id","table_id","customer_name","customer_phone","guest_count","date","time","zone","status","notes","created_at","updated_at") VALUES('rsv_1777947360925_29l2w','t07','Test','0913211434',2,'2026-05-09','19:00','Outdoor','confirmed','','2026-05-05T02:16:00.925Z','2026-05-05T02:16:00.925Z');
INSERT INTO "reservations" ("id","table_id","customer_name","customer_phone","guest_count","date","time","zone","status","notes","created_at","updated_at") VALUES('rsv_1777947739094_g7amv','t01','Test Guest','0896047661',4,'2026-05-06','18:00','Indoor','confirmed','','2026-05-05T02:22:19.094Z','2026-05-05T02:22:19.094Z');
INSERT INTO "reservations" ("id","table_id","customer_name","customer_phone","guest_count","date","time","zone","status","notes","created_at","updated_at") VALUES('rsv_1777951451542_pa0tz','t02','Sync Test','0896047661',2,'2026-05-07','19:00','Indoor','confirmed','','2026-05-05T03:24:11.542Z','2026-05-05T03:24:11.542Z');
INSERT INTO "reservations" ("id","table_id","customer_name","customer_phone","guest_count","date","time","zone","status","notes","created_at","updated_at") VALUES('rsv_1777955470215_2eorx','t11','Thông','0912123111',2,'2026-05-09','20:00','VIP','confirmed','','2026-05-05T04:31:10.215Z','2026-05-05T04:31:10.215Z');
INSERT INTO "reservations" ("id","table_id","customer_name","customer_phone","guest_count","date","time","zone","status","notes","created_at","updated_at") VALUES('rsv_1778847865260_o7c96','t10','Test','0912333444',2,'2026-05-16','19:00','VIP','confirmed','','2026-05-15T12:24:25.260Z','2026-05-15T12:24:25.260Z');
CREATE TABLE users (
    id           TEXT PRIMARY KEY,
    phone        TEXT UNIQUE NOT NULL,
    full_name    TEXT,
    tier         TEXT DEFAULT 'Silver',
    total_points INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT (datetime('now'))
);
CREATE TABLE rewards (
    id             TEXT PRIMARY KEY,
    title          TEXT NOT NULL,
    discount_type  TEXT NOT NULL,
    discount_value REAL NOT NULL,
    point_cost     INTEGER NOT NULL,
    created_at     TEXT DEFAULT (datetime('now'))
);
INSERT INTO "rewards" ("id","title","discount_type","discount_value","point_cost","created_at") VALUES('reward_001','Free Cà Phê Sữa Đá','FIXED_AMOUNT',35000,100,'2026-05-07 04:25:25');
INSERT INTO "rewards" ("id","title","discount_type","discount_value","point_cost","created_at") VALUES('reward_002','Free Espresso','FIXED_AMOUNT',35000,150,'2026-05-07 04:25:25');
INSERT INTO "rewards" ("id","title","discount_type","discount_value","point_cost","created_at") VALUES('reward_003','Voucher 30K','FIXED_AMOUNT',30000,250,'2026-05-07 04:25:25');
INSERT INTO "rewards" ("id","title","discount_type","discount_value","point_cost","created_at") VALUES('reward_004','Free Signature Drink','FIXED_AMOUNT',65000,300,'2026-05-07 04:25:25');
INSERT INTO "rewards" ("id","title","discount_type","discount_value","point_cost","created_at") VALUES('reward_005','Voucher 50K','FIXED_AMOUNT',50000,450,'2026-05-07 04:25:25');
INSERT INTO "rewards" ("id","title","discount_type","discount_value","point_cost","created_at") VALUES('reward_006','2x Signature Drinks','FIXED_AMOUNT',140000,600,'2026-05-07 04:25:25');
INSERT INTO "rewards" ("id","title","discount_type","discount_value","point_cost","created_at") VALUES('reward_007','Limited Edition Mug','FIXED_AMOUNT',150000,800,'2026-05-07 04:25:25');
INSERT INTO "rewards" ("id","title","discount_type","discount_value","point_cost","created_at") VALUES('reward_008','Voucher 100K','FIXED_AMOUNT',100000,1000,'2026-05-07 04:25:25');
INSERT INTO "rewards" ("id","title","discount_type","discount_value","point_cost","created_at") VALUES('reward_009','10% Discount Voucher','PERCENTAGE',10,1200,'2026-05-07 04:25:25');
CREATE TABLE promotions (
    code           TEXT PRIMARY KEY,
    percent        INTEGER NOT NULL,          -- e.g. 10, 20
    max_discount   INTEGER DEFAULT 0,          -- VND cap; 0 = no cap
    min_order      INTEGER DEFAULT 0,          -- VND minimum order
    usage_limit    INTEGER DEFAULT 0,          -- 0 = unlimited
    usage_count    INTEGER DEFAULT 0,
    starts_at      TEXT,
    expires_at     TEXT,
    is_active      INTEGER DEFAULT 1,
    created_at     TEXT DEFAULT (datetime('now'))
);
INSERT INTO "promotions" ("code","percent","max_discount","min_order","usage_limit","usage_count","starts_at","expires_at","is_active","created_at") VALUES('FIRSTORDER',10,50000,0,0,0,NULL,NULL,1,'2026-04-20 10:59:31');
INSERT INTO "promotions" ("code","percent","max_discount","min_order","usage_limit","usage_count","starts_at","expires_at","is_active","created_at") VALUES('WELCOME10',10,30000,0,0,0,NULL,NULL,1,'2026-04-20 10:59:31');
INSERT INTO "promotions" ("code","percent","max_discount","min_order","usage_limit","usage_count","starts_at","expires_at","is_active","created_at") VALUES('SADEC20',20,100000,0,0,0,NULL,NULL,1,'2026-04-20 10:59:31');
INSERT INTO "promotions" ("code","percent","max_discount","min_order","usage_limit","usage_count","starts_at","expires_at","is_active","created_at") VALUES('CONTAINER',15,75000,0,0,0,NULL,NULL,1,'2026-04-20 10:59:31');
CREATE TABLE staff_shifts (
    id           TEXT PRIMARY KEY,
    staff_email  TEXT NOT NULL,
    clock_in     TEXT NOT NULL,
    clock_out    TEXT,
    shift_type   TEXT,                         -- 'morning' | 'afternoon' | 'evening'
    notes        TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
);
CREATE TABLE loyalty_tiers (
    tier_name       TEXT PRIMARY KEY,
    min_points      INTEGER NOT NULL,
    cashback_rate   REAL NOT NULL DEFAULT 0.02,
    point_multiplier REAL NOT NULL DEFAULT 1.0,
    birthday_discount INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now'))
);
INSERT INTO "loyalty_tiers" ("tier_name","min_points","cashback_rate","point_multiplier","birthday_discount","created_at") VALUES('silver',0,0.02,1,10,'2026-05-07 04:25:13');
INSERT INTO "loyalty_tiers" ("tier_name","min_points","cashback_rate","point_multiplier","birthday_discount","created_at") VALUES('gold',500,0.05,1.5,30,'2026-05-07 04:25:13');
INSERT INTO "loyalty_tiers" ("tier_name","min_points","cashback_rate","point_multiplier","birthday_discount","created_at") VALUES('platinum',2000,0.05,2,50,'2026-05-07 04:25:13');
CREATE TABLE cashback_wallets (
    id              TEXT PRIMARY KEY,
    customer_id     TEXT NOT NULL,
    balance         REAL DEFAULT 0,
    total_earned    REAL DEFAULT 0,
    total_spent     REAL DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);
INSERT INTO "cashback_wallets" ("id","customer_id","balance","total_earned","total_spent","created_at","updated_at") VALUES('wal_mosd050u65a4','CUST_mod5frzisnnt2',0,0,0,'2026-05-05T08:21:20.622Z','2026-05-05T08:21:20.622Z');
CREATE TABLE cashback_transactions (
    id              TEXT PRIMARY KEY,
    wallet_id       TEXT NOT NULL,
    order_id        TEXT,
    type             TEXT NOT NULL,  -- earn, spend, bonus, expire, refund
    amount           REAL NOT NULL,
    balance_after    REAL,
    description     TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);
CREATE TABLE loyalty_point_logs (
    id              TEXT PRIMARY KEY,
    customer_id     TEXT NOT NULL,
    order_id        TEXT,
    points_change   INTEGER NOT NULL,
    reason          TEXT NOT NULL,  -- purchase, redeem, bonus, tier_upgrade
    balance_after   INTEGER,
    description     TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);
CREATE TABLE user_rewards (
    id              TEXT PRIMARY KEY,
    customer_id     TEXT NOT NULL,
    reward_id       TEXT NOT NULL,
    code            TEXT NOT NULL,
    status          TEXT DEFAULT 'active',  -- active, used, expired
    expires_at      TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_available ON products(is_available);
CREATE INDEX idx_tables_zone ON cafe_tables(zone);
CREATE INDEX idx_tables_status ON cafe_tables(status);
CREATE INDEX idx_menu_items_category ON menu_items(category);
CREATE INDEX idx_menu_items_available ON menu_items(available);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_loyalty_tier ON customers(loyalty_tier);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_reservations_date ON reservations(date);
CREATE INDEX idx_reservations_table ON reservations(table_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_cafe_tables_zone   ON cafe_tables(zone);
CREATE INDEX idx_cafe_tables_status ON cafe_tables(status);
CREATE INDEX idx_orders_table   ON orders(table_id);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_payments_order          ON payments(order_id);
CREATE INDEX idx_promo_active ON promotions(is_active);
CREATE INDEX idx_shifts_staff ON staff_shifts(staff_email);
CREATE INDEX idx_shifts_open  ON staff_shifts(clock_out);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_cashback_wallets_customer ON cashback_wallets(customer_id);
CREATE INDEX idx_cbtxn_wallet ON cashback_transactions(wallet_id);
CREATE INDEX idx_cbtxn_type ON cashback_transactions(type);
CREATE INDEX idx_ptlog_customer ON loyalty_point_logs(customer_id);
CREATE INDEX idx_ptlog_reason ON loyalty_point_logs(reason);
CREATE INDEX idx_urewards_customer ON user_rewards(customer_id);
CREATE INDEX idx_urewards_status ON user_rewards(status);
CREATE TRIGGER update_menu_items_timestamp
AFTER UPDATE ON menu_items
BEGIN
    UPDATE menu_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
CREATE TRIGGER update_customers_timestamp
AFTER UPDATE ON customers
BEGIN
    UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
CREATE TRIGGER update_orders_timestamp
AFTER UPDATE ON orders
BEGIN
    UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
CREATE TRIGGER update_payments_timestamp
AFTER UPDATE ON payments
BEGIN
    UPDATE payments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
CREATE TRIGGER update_categories_timestamp
AFTER UPDATE ON categories
BEGIN
    UPDATE categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
CREATE TRIGGER update_products_timestamp
AFTER UPDATE ON products
BEGIN
    UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
