# Pha 03: M4-B Digital Menu Catalog Integration

## Mục tiêu
- Tích hợp `MenuPage` và `MenuItemDetailPage` trực tiếp với `@aura/domain-catalog` qua `getCustomerMenu` query command.
- Loại bỏ phụ thuộc vào `crm.ts` routes hoặc legacy product queries cho catalog hiển thị khách.
- Đảm bảo real-time sync: thay đổi catalog (cập nhật món, ẩn/hiện, giá) phản ánh ngay mà không cần reload app.

---

## Bối cảnh Domain

```ts
// packages/domain/catalog/index.ts (đã có sẵn)
export { getCustomerMenu, getMenu, getMenuItem, productsRouter, categoriesRouter } from './src';
export type { CustomerMenuView, MenuItemView } from './src/types';
```

`getCustomerMenu` trả về:
```ts
interface CustomerMenuView {
  categories: Array<{
    id: string;
    name: string;
    sortOrder: number;
    items: Array<{
      id: string;
      name: string;
      description: string;
      price: number;
      imageUrl?: string;
      tags: string[];        // 'vegan', 'spicy', 'popular', ...
      isAvailable: boolean;
      preparationTimeMinutes: number;
    }>;
  }>;
  lastUpdated: string; // ISO timestamp
}
```

---

## Các tệp liên quan

| File | Role | Hành động |
|------|------|-----------|
| `src/pages/MenuPage.tsx` | Trang Thực đơn chính | **REFACTOR** — dùng `useCustomerMenu` hook từ domain-catalog |
| `src/pages/MenuItemDetailPage.tsx` | Chi tiết món | **REFACTOR** — dùng `getMenuItem` |
| `src/hooks/useCustomerMenu.ts` | **NEW** | Tạo hook TanStack Query wrapper cho `getCustomerMenu` |
| `src/components/md3/MenuCategorySection.tsx` | UI section theo danh mục | **KEEP** — cập nhật props từ domain type |
| `src/components/md3/MenuItemCard.tsx` | Card món ăn | **KEEP** — cập nhật props từ domain type |
| `src/lib/api-client.ts` | API client | **UPDATE** — thêm `catalog` endpoint methods |

---

## 1. Tạo `useCustomerMenu` Hook

```tsx
// src/hooks/useCustomerMenu.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { CustomerMenuView } from '@aura/domain-catalog';

export function useCustomerMenu() {
  return useQuery<CustomerMenuView>({
    queryKey: ['customer-menu'],
    queryFn: () => apiClient.getCustomerMenu(),
    staleTime: 30_000,      // 30s cache
    refetchInterval: 60_000, // Poll 60s cho real-time feel
    refetchOnWindowFocus: true,
  });
}
```

---

## 2. Cập nhật `api-client.ts` — Thêm Catalog Endpoint

```ts
// src/lib/api-client.ts (thêm vào class ApiClient)
async getCustomerMenu(): Promise<CustomerMenuView> {
  const res = await this.request<CustomerMenuView>('/api/catalog/menu/customer');
  return res.data;
}

async getMenuItem(id: string): Promise<MenuItemView> {
  const res = await this.request<MenuItemView>(`/api/catalog/menu/items/${id}`);
  return res.data;
}
```

---

## 3. Cập nhật Worker Routes — Catalog Public API

```ts
// worker/src/routes/openapi-catalog.ts (NEW - barrel)
// worker/src/routes/catalog-handlers/routes.ts
import { OpenAPIHono } from '@hono/zod-openapi';
import { getCustomerMenuHandler } from './handlers';

export const catalogRouter = new OpenAPIHono()
  .get('/menu/customer', getCustomerMenuHandler)
  .get('/menu/items/:id', getMenuItemHandler);
```

Handler dùng `getCustomerMenu` từ `@aura/domain-catalog`:

```ts
// worker/src/routes/catalog-handlers/handlers.ts
import { getCustomerMenu } from '@aura/domain-catalog';

export async function getCustomerMenuHandler(c: Context) {
  const menu = await getCustomerMenu(c.env.AURA_DB);
  return c.json(menu);
}
```

---

## 4. Refactor `MenuPage.tsx`

```tsx
// src/pages/MenuPage.tsx
import { useCustomerMenu } from '@/hooks/useCustomerMenu';
import { MenuCategorySection } from '@/components/md3/MenuCategorySection';
import { Skeleton } from '@/components/ui/Skeleton';

export default function MenuPage() {
  const { data: menu, isLoading, error, refetch } = useCustomerMenu();

  if (isLoading) return <MenuSkeleton />;
  if (error) return <ErrorMessage onRetry={refetch} />;

  return (
    <div className="space-y-6 p-4 pb-24">
      {menu?.categories.map((cat) => (
        <MenuCategorySection key={cat.id} category={cat} />
      ))}
    </div>
  );
}

function MenuSkeleton() {
  return (
    <div className="space-y-6 p-4 pb-24">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-lg" />
      ))}
    </div>
  );
}
```

---

## 5. Cập nhật `MenuCategorySection` & `MenuItemCard` Types

```tsx
// src/components/md3/MenuCategorySection.tsx
import { MenuItemCard } from './MenuItemCard';
import type { CustomerMenuView } from '@aura/domain-catalog';

type Category = CustomerMenuView['categories'][0];

export function MenuCategorySection({ category }: { category: Category }) {
  return (
    <section className="space-y-3">
      <h2 className="m3-headline-small text-[var(--md-sys-color-on-surface)] px-2">
        {category.name}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {category.items
          .filter((item) => item.isAvailable)
          .map((item) => (
            <MenuItemCard key={item.id} item={item} />
          ))}
      </div>
    </section>
  );
}
```

```tsx
// src/components/md3/MenuItemCard.tsx
import type { MenuItemView } from '@aura/domain-catalog';
import { Tag } from '@/components/ui/Tag';

type Props = { item: MenuItemView };

export function MenuItemCard({ item }: Props) {
  return (
    <MD3Card variant="outlined" className="p-3 flex gap-3">
      {item.imageUrl && (
        <img src={item.imageUrl} alt={item.name} className="w-20 h-20 rounded-md object-cover flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <h3 className="m3-title-medium truncate">{item.name}</h3>
        <p className="m3-body-small text-[var(--md-sys-color-on-surface-variant)] line-clamp-2 mt-1">
          {item.description}
        </p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="m3-label-large text-[var(--md-sys-color-primary)] font-medium">
            {formatVnd(item.price)}
          </span>
          {item.tags.map((tag) => (
            <Tag key={tag} variant="outlined" size="small">{tag}</Tag>
          ))}
        </div>
        <p className="m3-body-small text-[var(--md-sys-color-outline)] mt-1">
          ⏱ {item.preparationTimeMinutes} phút
        </p>
      </div>
    </MD3Card>
  );
}
```

---

## 6. Loại bỏ Legacy Menu Queries

- Xóa `useMenu` hook cũ (nếu có) dùng `crm.ts` / `products` routes.
- Xóa `getProductsForCustomer` khỏi `api-client.ts` nếu không còn dùng nơi khác.

---

## Checklist hoàn thành Pha 03

- [ ] `useCustomerMenu` hook hoạt động với TanStack Query (cache, polling, refetch)
- [ ] `api-client.ts` có `getCustomerMenu` & `getMenuItem`
- [ ] Worker có route `/api/catalog/menu/customer` trả về `CustomerMenuView`
- [ ] `MenuPage` render từ domain catalog, không dùng CRM routes
- [ ] `MenuItemDetailPage` fetch từ `/api/catalog/menu/items/:id`
- [ ] Real-time: cập nhật catalog → UI refetch trong 60s (hoặc manual pull-to-refresh)
- [ ] Chạy `npx vitest run` — 3,379 tests pass
- [ ] Kiểm tra UI: Menu load đúng categories + items, tags hiển thị, giá format VND

---

## Tiêu chí hoàn thành
1. Catalog hiển thị khách 100% từ `@aura/domain-catalog` (single source of truth)
2. Không còn coupling `MenuPage` → `crm.ts` / legacy product API
3. Real-time sync hoạt động (polling 60s + window focus refetch)
4. Toàn bộ test suite pass, không regression