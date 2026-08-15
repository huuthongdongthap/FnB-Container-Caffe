export type PaymentMethod = 'payos' | 'cod';

export interface CartItem {
  id: string;
  name: string;
  detail: string;
  price: number;
  image: string;
  alt: string;
}

export interface FieldProps {
  label: string;
  type: 'text' | 'tel' | 'textarea';
  placeholder?: string;
  rows?: number;
}
