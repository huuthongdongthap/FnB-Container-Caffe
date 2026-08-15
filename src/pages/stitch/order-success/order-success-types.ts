export interface OrderItem {
  qty: number;
  name: string;
  price: string;
}

export interface Step {
  label: string;
  done: boolean;
  active: boolean;
}
