import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { usePromotionsManager } from './use-promotions-manager';
import { PromotionsList } from './promotions-list';
import { PromotionFormModal } from './promotion-form-modal';
import { ConfirmDeleteModal } from './confirm-delete-modal';

export default function PromotionsManagerPage() {
  const { t } = useTranslation('adminPromotions');
  const {
    query,
    modalOpen,
    editingPromo,
    form,
    errors,
    deleteCode,
    setDeleteCode,
    saveMutation,
    deleteMutation,
    openAddModal,
    openEditModal,
    closeModal,
    handleFormChange,
    handleSave,
  } = usePromotionsManager();

  const promotions = query.data?.data ?? [];

  return (
    <>
      <HelmetHead
        title="Quản lý khuyến mãi — Promotions Management — AURA CAFE"
        description="Quản lý mã giảm giá và chương trình khuyến mãi tại AURA CAFE. Discount codes, promotions & offers management."
      />
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-display font-bold">{t('title')}</h1>
          </div>

          <PromotionsList
            promotions={promotions}
            isLoading={query.isLoading}
            isError={query.isError}
            onRefetch={() => query.refetch()}
            onEdit={openEditModal}
            onDelete={(code) => setDeleteCode(code)}
            onAdd={openAddModal}
          />
        </div>
      </div>

      <PromotionFormModal
        open={modalOpen}
        editing={editingPromo}
        form={form}
        errors={errors}
        onChange={handleFormChange}
        onSave={handleSave}
        onClose={closeModal}
        saving={saveMutation.isPending}
      />

      <ConfirmDeleteModal
        open={deleteCode !== null}
        title={t('confirmDeleteTitle')}
        message={t('confirmDeleteMsg', { code: deleteCode })}
        onConfirm={() => {
          if (deleteCode !== null) deleteMutation.mutate(deleteCode);
        }}
        onClose={() => setDeleteCode(null)}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
