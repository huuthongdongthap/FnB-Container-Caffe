export function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' đ';
}

export function formatPoints(points: number): string {
  return points.toLocaleString('vi-VN');
}
