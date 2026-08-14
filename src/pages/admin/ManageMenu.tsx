import { useState } from 'react';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { cn } from '@/lib/cn';
import type { Tab } from './types';
import { useProductManager } from './use-product-manager';
import { useCategoryManager } from './use-category-manager';
import { ProductList } from './product-list';
import { CategoryList } from './category-list';
import { ProductModal } from './product-modal';
import { CategoryModal } from './category-modal';
import { ConfirmDeleteModal } from './confirm-delete-modal';

export default function ManageMenuPage() {
  const [activeTab, setActiveTab] = useState<Tab>('products');

  const product = useProductManager();
  const category = useCategoryManager();

  const products = product.query.data?.data ?? [];
  const categories = category.query.data?.data ?? [];
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

          {activeTab === 'products' && (
            <ProductList
              products={products}
              categoriesById={categoriesById}
              isLoading={product.query.isLoading}
              isError={product.query.isError}
              onRefetch={() => product.query.refetch()}
              onEdit={product.openEditModal}
              onDelete={(id) => product.setDeleteId(id)}
              onToggleAvailability={(p) => product.toggleAvailabilityMutation.mutate(p)}
              onAdd={product.openAddModal}
              togglePending={product.toggleAvailabilityMutation.isPending}
              toggleVariableId={product.toggleAvailabilityMutation.variables?.id}
            />
          )}

          {activeTab === 'categories' && (
            <CategoryList
              categories={categories}
              isLoading={category.query.isLoading}
              isError={category.query.isError}
              onRefetch={() => category.query.refetch()}
              onEdit={category.openEditModal}
              onDelete={(id) => category.setDeleteId(id)}
              onAdd={category.openAddModal}
            />
          )}
        </div>

        <ProductModal
          open={product.modalOpen}
          editing={product.editing}
          form={product.form}
          errors={product.errors}
          categories={categories}
          onChange={product.handleFormChange}
          onSave={product.handleSave}
          onClose={product.closeModal}
          saving={product.saveMutation.isPending}
        />

        <CategoryModal
          open={category.modalOpen}
          editing={category.editing}
          form={category.form}
          errors={category.errors}
          onChange={category.handleFormChange}
          onSave={category.handleSave}
          onClose={category.closeModal}
          saving={category.saveMutation.isPending}
        />

        <ConfirmDeleteModal
          open={product.deleteId !== null}
          title="Xác nhận xoá"
          message="Bạn có chắc chắn muốn xoá sản phẩm này? Hành động này không thể hoàn tác."
          onConfirm={() => {
            if (product.deleteId !== null) product.deleteMutation.mutate(product.deleteId);
          }}
          onClose={() => product.setDeleteId(null)}
          loading={product.deleteMutation.isPending}
        />

        <ConfirmDeleteModal
          open={category.deleteId !== null}
          title="Xác nhận xoá"
          message="Bạn có chắc chắn muốn xoá danh mục này? Hành động này không thể hoàn tác."
          onConfirm={() => {
            if (category.deleteId !== null) category.deleteMutation.mutate(category.deleteId);
          }}
          onClose={() => category.setDeleteId(null)}
          loading={category.deleteMutation.isPending}
        />
      </div>
    </>
  );
}
