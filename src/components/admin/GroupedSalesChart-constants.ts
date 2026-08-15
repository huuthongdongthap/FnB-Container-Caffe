import type { GroupedSalesChartProps } from './GroupedSalesChart-types';

/* ─── Title mapping ─── */

export const TITLE_MAP: Record<GroupedSalesChartProps['groupBy'], string> = {
  hour: 'Theo gio',
  day: 'Theo ngay',
  category: 'Theo danh muc',
  payment: 'Theo phuong thuc thanh toan',
};

export const EMPTY_MSG: Record<GroupedSalesChartProps['groupBy'], string> = {
  hour: 'Chua co du lieu theo gio',
  day: 'Chua co du lieu theo ngay',
  category: 'Chua co du lieu theo danh muc',
  payment: 'Chua co du lieu theo phuong thuc thanh toan',
};
