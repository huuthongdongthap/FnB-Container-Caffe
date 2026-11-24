import type { GroupedSalesChartProps } from './GroupedSalesChart-types';

/* ─── Title mapping ─── */

export const TITLE_MAP: Record<GroupedSalesChartProps['groupBy'], string> = {
  hour: 'Theo giờ',
  day: 'Theo ngày',
  category: 'Theo danh mục',
  payment: 'Theo phương thức thanh toán',
};

export const EMPTY_MSG: Record<GroupedSalesChartProps['groupBy'], string> = {
  hour: 'Chưa có dữ liệu theo giờ',
  day: 'Chưa có dữ liệu theo ngày',
  category: 'Chưa có dữ liệu theo danh mục',
  payment: 'Chưa có dữ liệu theo phương thức thanh toán',
};
