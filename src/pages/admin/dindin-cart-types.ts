export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  modifiers?: string;
}

export interface DinDinCart {
  sessionId: string;
  items: CartItem[];
  total: number;
  createdAt?: string;
}
