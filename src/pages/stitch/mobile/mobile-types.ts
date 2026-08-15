export interface MenuItem {
  id: string;
  nameVi: string;
  nameEn: string;
  price: number;
  image: string;
}

export interface NavItem {
  icon: string;
  label: string;
  labelEn: string;
  active: boolean;
  center?: boolean;
}
