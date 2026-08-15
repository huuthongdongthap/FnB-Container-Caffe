import type { CheckoutFormData } from '@/lib/validators';

export const INITIAL_FORM: CheckoutFormData = {
  fullName: '',
  email: '',
  phone: '',
  address: '',
  ward: '',
  notes: '',
  deliveryTime: 'now',
  scheduledTime: '',
  paymentMethod: 'cod',
  discountCode: '',
  tip: 0,
};
