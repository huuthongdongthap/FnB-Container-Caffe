import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

interface Props {
  subscriptionId: string;
  trigger: React.ReactNode;
}

export default function CancelSubscriptionDialog({ subscriptionId, trigger }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');

  const cancel = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || 'Customer requested cancellation' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || 'Cancel failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-active-subscription'] });
      setOpen(false);
    },
  });

  return (
    <>
      <div onClick={(e) => { e.stopPropagation(); setOpen(true); }}>{trigger}</div>
      <Modal open={open} onClose={() => setOpen(false)} title="Hủy subscription">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Bạn có chắc muốn hủy subscription? Bạn sẽ mất quyền truy cập vào hết ngày hiện tại.
          </p>
          <label className="block text-sm">
            <span className="text-gray-600">Lý do (tùy chọn)</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 p-2"
              rows={2}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Giữ lại</Button>
            <Button variant="destructive" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
              {cancel.isPending ? 'Đang xử lý...' : 'Xác nhận hủy'}
            </Button>
          </div>
          {cancel.isError && (
            <p className="text-sm text-red-600">{(cancel.error as Error).message}</p>
          )}
        </div>
      </Modal>
    </>
  );
}
