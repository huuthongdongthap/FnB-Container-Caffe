import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { AuraImage } from '@/components/ui/AuraImage';
import { Modal } from '@/components/ui/modal';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { cn } from '@/lib/cn';
import { API_BASE } from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────────────────

interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  category_id: number;
  image_url: string;
  is_available: number;
  sort_order: number;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
}

interface ProductFormData {
  name: string;
  slug: string;
  description: string;
  price: string;
  category_id: string;
  image_url: string;
  is_available: boolean;
  sort_order: string;
}

interface CategoryFormData {
  name: string;
  slug: string;
  sort_order: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options?.headers as Record<string, string>) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Request failed: ${res.status}`);
  return data;
}

// ── Empty Product State ──────────────────────────────────────────────

const EMPTY_PRODUCT: ProductFormData = {
  name: '',
  slug: '',
  description: '',
  price: '',
  category_id: '',
  image_url: '',
  is_available: true,
  sort_order: '0',
};

const EMPTY_CATEGORY: CategoryFormData = {
  name: '',
  slug: '',
  sort_order: '0',
};

// ── Component ────────────────────────────────────────────────────────

type Tab = 'products' | 'categories';

export default function ManageMenuPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('products');

  // Product state
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<ProductFormData>(EMPTY_PRODUCT);
  const [productErrors, setProductErrors] = useState<Record<string, string>>({});
  const [deleteProductId, setDeleteProductId] = useState<number | null>(null);

  // Category state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormData>(EMPTY_CATEGORY);
  const [categoryErrors, setCategoryErrors] = useState<Record<string, string>>({});
  const [deleteCategoryId, setDeleteCategoryId] = useState<number | null>(null);

  // ── Queries ──────────────────────────────────────────────────────

  const productsQuery = useQuery<{ success: boolean; data: Product[] }>({
    queryKey: ['admin-products'],
    queryFn: () => apiFetch('/api/products'),
  });

  const categoriesQuery = useQuery<{ success: boolean; data: Category[] }>({
    queryKey: ['admin-categories'],
    queryFn: () => apiFetch('/api/categories'),
  });

  // ── Mutations (Products) ─────────────────────────────────────────

  const saveProductMutation = useMutation({
    mutationFn: async (formData: ProductFormData) => {
      const body = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        price: Number(formData.price),
        category_id: Number(formData.category_id),
        image_url: formData.image_url,
        is_available: formData.is_available ? 1 : 0,
        sort_order: Number(formData.sort_order),
      };

      if (editingProduct) {
        return apiFetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      }
      return apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      closeProductModal();
    },
    onError: (err: Error) => {
      setProductErrors({ _form: err.message });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setDeleteProductId(null);
    },
  });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: async (product: Product) => {
      const body = {
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        category_id: product.category_id,
        image_url: product.image_url,
        is_available: product.is_available ? 0 : 1,
        sort_order: product.sort_order,
      };
      return apiFetch(`/api/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
  });

  // ── Mutations (Categories) ───────────────────────────────────────

  const saveCategoryMutation = useMutation({
    mutationFn: async (formData: CategoryFormData) => {
      const body = {
        name: formData.name,
        slug: formData.slug,
        sort_order: Number(formData.sort_order),
      };

      if (editingCategory) {
        return apiFetch(`/api/categories/${editingCategory.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      }
      return apiFetch('/api/categories', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      closeCategoryModal();
    },
    onError: (err: Error) => {
      setCategoryErrors({ _form: err.message });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setDeleteCategoryId(null);
    },
  });

  // ── Product Modal handlers ───────────────────────────────────────

  function openAddProductModal() {
    setEditingProduct(null);
    setProductForm(EMPTY_PRODUCT);
    setProductErrors({});
    setProductModalOpen(true);
  }

  function openEditProductModal(product: Product) {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: String(product.price),
      category_id: String(product.category_id),
      image_url: product.image_url,
      is_available: product.is_available === 1,
      sort_order: String(product.sort_order),
    });
    setProductErrors({});
    setProductModalOpen(true);
  }

  function closeProductModal() {
    setProductModalOpen(false);
    setEditingProduct(null);
    setProductForm(EMPTY_PRODUCT);
    setProductErrors({});
  }

  function handleProductFormChange(field: keyof ProductFormData, value: string | boolean) {
    setProductForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'name' && !editingProduct) {
        updated.slug = slugify(updated.name);
      }
      return updated;
    });
    setProductErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      delete next._form;
      return next;
    });
  }

  function validateProductForm(): boolean {
    const errors: Record<string, string> = {};
    if (!productForm.name.trim()) errors.name = 'Vui lòng nhập tên sản phẩm';
    if (!productForm.price || Number(productForm.price) <= 0)
      errors.price = 'Giá phải lớn hơn 0';
    if (!productForm.category_id) errors.category_id = 'Vui lòng chọn danh mục';
    setProductErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSaveProduct() {
    if (!validateProductForm()) return;
    saveProductMutation.mutate(productForm);
  }

  // ── Category Modal handlers ──────────────────────────────────────

  function openAddCategoryModal() {
    setEditingCategory(null);
    setCategoryForm(EMPTY_CATEGORY);
    setCategoryErrors({});
    setCategoryModalOpen(true);
  }

  function openEditCategoryModal(category: Category) {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      sort_order: String(category.sort_order),
    });
    setCategoryErrors({});
    setCategoryModalOpen(true);
  }

  function closeCategoryModal() {
    setCategoryModalOpen(false);
    setEditingCategory(null);
    setCategoryForm(EMPTY_CATEGORY);
    setCategoryErrors({});
  }

  function handleCategoryFormChange(field: keyof CategoryFormData, value: string) {
    setCategoryForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'name' && !editingCategory) {
        updated.slug = slugify(updated.name);
      }
      return updated;
    });
    setCategoryErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      delete next._form;
      return next;
    });
  }

  function validateCategoryForm(): boolean {
    const errors: Record<string, string> = {};
    if (!categoryForm.name.trim()) errors.name = 'Vui lòng nhập tên danh mục';
    setCategoryErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSaveCategory() {
    if (!validateCategoryForm()) return;
    saveCategoryMutation.mutate(categoryForm);
  }

  // ── Renderers ────────────────────────────────────────────────────

  function renderSkeletonRows(count = 5) {
    return Array.from({ length: count }).map((_, i) => (
      <tr key={i}>
        {Array.from({ length: 6 }).map((__, j) => (
          <td key={j} className="px-4 py-3">
            <Skeleton className={j === 5 ? 'h-8 w-20' : 'h-4 w-full'} />
          </td>
        ))}
      </tr>
    ));
  }

  const products = productsQuery.data?.data ?? [];
  const categories = categoriesQuery.data?.data ?? [];
  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  return (
    <>
      <HelmetHead
        title="Quản lý thực đơn — Menu Management — AURA CAFE"
        description="Quản lý thực đơn, món ăn và đồ uống tại AURA CAFE. Menu items, categories & product management."
      />
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold">Quản lý thực đơn</h1>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab('products')}
            className={cn(
              'px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === 'products'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-foreground',
            )}
          >
            Sản phẩm
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={cn(
              'px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === 'categories'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-foreground',
            )}
          >
            Danh mục
          </button>
        </div>

        {/* ─────── Products Tab ─────── */}
        {activeTab === 'products' && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted">
                {productsQuery.isLoading
                  ? 'Đang tải...'
                  : `${products.length} sản phẩm`}
              </p>
              <Button onClick={openAddProductModal}>+ Thêm sản phẩm</Button>
            </div>

            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/5">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                        Tên
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                        Giá
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                        Danh mục
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                        Trạng thái
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {productsQuery.isLoading && renderSkeletonRows()}
                    {productsQuery.isError && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <p className="text-sm text-destructive">
                              Lỗi tải danh sách sản phẩm
                            </p>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => productsQuery.refetch()}
                            >
                              Thử lại
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {!productsQuery.isLoading &&
                      !productsQuery.isError &&
                      products.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-12 text-center text-sm text-muted"
                          >
                            Chưa có sản phẩm nào
                          </td>
                        </tr>
                      )}
                    {!productsQuery.isLoading &&
                      !productsQuery.isError &&
                      products.map((product) => (
                        <tr
                          key={product.id}
                          className="hover:bg-muted/5 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {product.image_url && (
                                <AuraImage
                                  src={product.image_url}
                                  alt={product.name}
                                  className="h-10 w-10 rounded-lg object-cover"
                                />
                              )}
                              <div>
                                <p className="text-sm font-medium">{product.name}</p>
                                {product.description && (
                                  <p className="text-xs text-muted line-clamp-1">
                                    {product.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {product.price.toLocaleString('vi-VN')}đ
                          </td>
                          <td className="px-4 py-3 text-sm text-muted">
                            {categoriesById.get(product.category_id)?.name ??
                              product.category_id}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                product.is_available ? 'success' : 'destructive'
                              }
                            >
                              {product.is_available ? 'Còn' : 'Hết'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  toggleAvailabilityMutation.mutate(product)
                                }
                                loading={
                                  toggleAvailabilityMutation.isPending &&
                                  toggleAvailabilityMutation.variables?.id ===
                                    product.id
                                }
                                title={
                                  product.is_available
                                    ? 'Đánh dấu hết'
                                    : 'Đánh dấu còn'
                                }
                              >
                                {product.is_available ? 'Hết' : 'Còn'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEditProductModal(product)}
                              >
                                Sửa
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setDeleteProductId(product.id)}
                              >
                                Xoá
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* ─────── Categories Tab ─────── */}
        {activeTab === 'categories' && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted">
                {categoriesQuery.isLoading
                  ? 'Đang tải...'
                  : `${categories.length} danh mục`}
              </p>
              <Button onClick={openAddCategoryModal}>+ Thêm danh mục</Button>
            </div>

            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/5">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                        Tên
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                        Slug
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                        Thứ tự
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {categoriesQuery.isLoading &&
                      Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 4 }).map((__, j) => (
                            <td key={j} className="px-4 py-3">
                              <Skeleton
                                className={
                                  j === 3 ? 'h-8 w-20 ml-auto' : 'h-4 w-full'
                                }
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    {categoriesQuery.isError && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <p className="text-sm text-destructive">
                              Lỗi tải danh sách danh mục
                            </p>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => categoriesQuery.refetch()}
                            >
                              Thử lại
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {!categoriesQuery.isLoading &&
                      !categoriesQuery.isError &&
                      categories.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-4 py-12 text-center text-sm text-muted"
                          >
                            Chưa có danh mục nào
                          </td>
                        </tr>
                      )}
                    {!categoriesQuery.isLoading &&
                      !categoriesQuery.isError &&
                      categories.map((category) => (
                        <tr
                          key={category.id}
                          className="hover:bg-muted/5 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm font-medium">
                            {category.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted">
                            {category.slug}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted">
                            {category.sort_order}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEditCategoryModal(category)}
                              >
                                Sửa
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setDeleteCategoryId(category.id)}
                              >
                                Xoá
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* ─────────────── Product Modal ─────────────── */}
      <Modal
        open={productModalOpen}
        onClose={closeProductModal}
        title={editingProduct ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
      >
        <div className="space-y-4">
          {productErrors._form && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {productErrors._form}
            </div>
          )}

          <Input
            label="Tên sản phẩm"
            placeholder="Nhập tên sản phẩm"
            value={productForm.name}
            onChange={(e) => handleProductFormChange('name', e.target.value)}
            error={productErrors.name}
          />

          <Input
            label="Slug"
            placeholder="ten-san-pham"
            value={productForm.slug}
            onChange={(e) => handleProductFormChange('slug', e.target.value)}
            helperText="Tự động tạo từ tên sản phẩm"
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Mô tả
            </label>
            <textarea
              className="rounded-lg border border-border bg-white px-4 py-2.5 text-base text-foreground placeholder:text-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent min-h-[80px] resize-y"
              placeholder="Nhập mô tả sản phẩm"
              value={productForm.description}
              onChange={(e) =>
                handleProductFormChange('description', e.target.value)
              }
            />
          </div>

          <Input
            label="Giá (VND)"
            type="number"
            placeholder="0"
            value={productForm.price}
            onChange={(e) => handleProductFormChange('price', e.target.value)}
            error={productErrors.price}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Danh mục
            </label>
            <select
              className={cn(
                'rounded-lg border border-border bg-white px-4 py-2.5 text-base text-foreground transition-colors duration-150',
                'focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent',
                productErrors.category_id && 'border-destructive',
              )}
              value={productForm.category_id}
              onChange={(e) =>
                handleProductFormChange('category_id', e.target.value)
              }
            >
              <option value="">-- Chọn danh mục --</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {productErrors.category_id && (
              <p className="text-sm text-destructive" role="alert">
                {productErrors.category_id}
              </p>
            )}
          </div>

          <Input
            label="Image URL"
            placeholder="https://example.com/image.jpg"
            value={productForm.image_url}
            onChange={(e) => handleProductFormChange('image_url', e.target.value)}
          />

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              Còn hàng
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={productForm.is_available}
              onClick={() =>
                handleProductFormChange(
                  'is_available',
                  !productForm.is_available,
                )
              }
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                productForm.is_available
                  ? 'bg-green-500'
                  : 'bg-muted/50',
              )}
            >
              <span
                className={cn(
                  'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200',
                  productForm.is_available ? 'translate-x-[22px]' : 'translate-x-[2px]',
                )}
              />
            </button>
          </div>

          <Input
            label="Thứ tự"
            type="number"
            placeholder="0"
            value={productForm.sort_order}
            onChange={(e) => handleProductFormChange('sort_order', e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeProductModal}>
              Huỷ
            </Button>
            <Button
              onClick={handleSaveProduct}
              loading={saveProductMutation.isPending}
              disabled={saveProductMutation.isPending}
            >
              {editingProduct ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─────────────── Category Modal ─────────────── */}
      <Modal
        open={categoryModalOpen}
        onClose={closeCategoryModal}
        title={editingCategory ? 'Sửa danh mục' : 'Thêm danh mục'}
      >
        <div className="space-y-4">
          {categoryErrors._form && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {categoryErrors._form}
            </div>
          )}

          <Input
            label="Tên danh mục"
            placeholder="Nhập tên danh mục"
            value={categoryForm.name}
            onChange={(e) => handleCategoryFormChange('name', e.target.value)}
            error={categoryErrors.name}
          />

          <Input
            label="Slug"
            placeholder="ten-danh-muc"
            value={categoryForm.slug}
            onChange={(e) => handleCategoryFormChange('slug', e.target.value)}
            helperText="Tự động tạo từ tên danh mục"
          />

          <Input
            label="Thứ tự"
            type="number"
            placeholder="0"
            value={categoryForm.sort_order}
            onChange={(e) =>
              handleCategoryFormChange('sort_order', e.target.value)
            }
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeCategoryModal}>
              Huỷ
            </Button>
            <Button
              onClick={handleSaveCategory}
              loading={saveCategoryMutation.isPending}
              disabled={saveCategoryMutation.isPending}
            >
              {editingCategory ? 'Lưu thay đổi' : 'Thêm danh mục'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─────────────── Confirm Delete Product ─────────────── */}
      <Modal
        open={deleteProductId !== null}
        onClose={() => setDeleteProductId(null)}
        title="Xác nhận xoá"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Bạn có chắc chắn muốn xoá sản phẩm này? Hành động này không thể hoàn
            tác.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setDeleteProductId(null)}
            >
              Huỷ
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteProductId !== null)
                  deleteProductMutation.mutate(deleteProductId);
              }}
              loading={deleteProductMutation.isPending}
              disabled={deleteProductMutation.isPending}
            >
              Xoá
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─────────────── Confirm Delete Category ─────────────── */}
      <Modal
        open={deleteCategoryId !== null}
        onClose={() => setDeleteCategoryId(null)}
        title="Xác nhận xoá"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Bạn có chắc chắn muốn xoá danh mục này? Hành động này không thể hoàn
            tác.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setDeleteCategoryId(null)}
            >
              Huỷ
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteCategoryId !== null)
                  deleteCategoryMutation.mutate(deleteCategoryId);
              }}
              loading={deleteCategoryMutation.isPending}
              disabled={deleteCategoryMutation.isPending}
            >
              Xoá
            </Button>
          </div>
        </div>
      </Modal>
    </div>
    </>
  );
}
