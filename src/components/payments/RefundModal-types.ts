export interface RefundPayment {
  id: string;
  orderId: string;
  amount: number;
  customerName: string;
}

export interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: RefundPayment;
  onRefundComplete: () => void;
}
