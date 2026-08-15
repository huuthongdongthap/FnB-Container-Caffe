export interface DinDinConfig {
  sections: Array<{
    name: string;
    items: Array<{
      id: string;
      name: string;
      price: number;
      description?: string;
      available: boolean;
      modifiers?: string[];
    }>;
  }>;
}

export interface DinDinItem {
  id?: string;
  name: string;
  price: number;
  description?: string;
  available: boolean;
  modifiers?: string[];
}

export interface DinDinSection {
  name: string;
  items: DinDinItem[];
}
