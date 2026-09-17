export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  loyalty_tier: string;
  loyalty_points: number;
  lifetime_points: number;
  cashback_balance: number;
  total_spent: number;
  total_earned: number;
  visit_count: number;
  created_at: string;
}

export const SEGMENTS = [
  { id: 'all', name: 'Tất cả khách hàng / All Customers' },
  { id: 'loyalty_bronze', name: 'Khách hàng Đồng / Bronze' },
  { id: 'loyalty_silver', name: 'Khách hàng Bạc / Silver' },
  { id: 'loyalty_gold', name: 'Khách hàng Vàng / Gold' },
  { id: 'loyalty_platinum', name: 'Khách hàng Bạch kim / Platinum' },
  { id: 'active_30d', name: 'Hoạt động 30 ngày / Active 30 Days' },
  { id: 'inactive_90d', name: 'Không hoạt động 90 ngày / Inactive 90 Days' },
  { id: 'birthday_this_month', name: 'Sinh nhật tháng này / Birthday This Month' }
] as const;

export const PROFILE_SQL = `
  SELECT c.id, c.name, c.phone, c.email,
         c.loyalty_tier, c.loyalty_points, c.lifetime_points,
         c.created_at,
         COALESCE(cw.balance, 0) AS cashback_balance,
         COALESCE(cw.total_earned, 0) AS total_earned,
         COALESCE(cw.total_spent, 0) AS total_spent,
         (SELECT COUNT(*) FROM orders o WHERE o.customer_phone = c.phone) AS visit_count
  FROM customers c
  LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
`;
