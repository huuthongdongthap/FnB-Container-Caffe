import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { ManageMenuTabBar } from './manage-menu-tab-bar';
import type { Tab } from './types';
import { useProductManager } from './use-product-manager';
import { useCategoryManager } from './use-category-manager';
import { ProductList } from './product-list';
import { CategoryList } from './category-list';
import { ProductModal } from './product-modal';
import { CategoryModal } from './category-modal';
import { ConfirmDeleteModal } from './confirm-delete-modal';
import { useModifierManager } from './use-modifier-manager';
import { ModifierGroupList } from './modifier-group-list';
import { ModifierGroupModal } from './modifier-group-modal';
import { ModifierChoiceModal } from './modifier-choice-modal';

export default function ManageMenuPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('products');

  const product = useProductManager();
  const category = useCategoryManager();
  const modifiers = useModifierManager();

  const products = product.query.data?.data ?? [];
  const categories = category.query.data?.data ?? [];
  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  return (
    <>
      <HelmetHead
        title={`${t('adminMenu.title')} — AURA CAFE`}
        description={t('adminMenu.subtitle')}
      />
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-display font-bold">{t('adminMenu.title')}</h1>
          </div>

          {/* Tabs */}
          <ManageMenuTabBar activeTab={activeTab} onChange={setActiveTab} />

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

          {activeTab === 'modifiers' && (
            <ModifierGroupList
              groups={modifiers.groupsQuery.data?.data ?? []}
              isLoading={modifiers.groupsQuery.isLoading}
              isError={modifiers.groupsQuery.isError}
              onRefetch={() => modifiers.groupsQuery.refetch()}
              onAdd={modifiers.openAddGroupModal}
              onManageChoices={modifiers.openChoiceModal}
              onDelete={modifiers.setConfirmDeleteGroup}
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

        <ConfirmDeleteModal
          open={modifiers.confirmDeleteGroup !== null}
          title="Xác nhận xoá"
          message="Xoá nhóm tùy chọn cũng xoá các lựa chọn bên trong nó. Các món đã gán nhóm này sẽ không còn hiện tùy chọn. Hành động này không thể hoàn tác."
          onConfirm={() => {
            if (modifiers.confirmDeleteGroup) {
              modifiers.deleteGroupMutation.mutate(modifiers.confirmDeleteGroup.id);
            }
          }}
          onClose={() => modifiers.setConfirmDeleteGroup(null)}
          loading={modifiers.deleteGroupMutation.isPending}
        />

        <ModifierGroupModal
          open={modifiers.groupModalOpen}
          form={modifiers.groupForm}
          errors={modifiers.errors}
          onChange={modifiers.handleGroupFormChange}
          onSave={() => {
            if (modifiers.validateGroupForm()) {
              modifiers.createGroupMutation.mutate(modifiers.groupForm);
            }
          }}
          onClose={modifiers.closeGroupModal}
          saving={modifiers.createGroupMutation.isPending}
        />

        <ModifierChoiceModal
          open={modifiers.choiceGroupId !== null}
          groupName={
            modifiers.groupsQuery.data?.data?.find((g) => g.id === modifiers.choiceGroupId)?.name ?? ''
          }
          choices={modifiers.choicesQuery.data?.data ?? []}
          form={modifiers.choiceForm}
          errors={modifiers.errors}
          onChange={modifiers.handleChoiceFormChange}
          onSave={() => {
            if (modifiers.validateChoiceForm() && modifiers.choiceGroupId) {
              modifiers.createChoiceMutation.mutate({
                groupId: modifiers.choiceGroupId,
                formData: modifiers.choiceForm,
              });
            }
          }}
          onClose={modifiers.closeChoiceModal}
          saving={modifiers.createChoiceMutation.isPending}
        />
      </div>
    </>
  );
}
