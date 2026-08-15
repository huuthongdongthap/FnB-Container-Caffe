export interface SplitBillModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (orders: Array<Record<string, unknown>>) => void;
  customerName: string;
  customerPhone: string;
  paymentMethod: string;
}
