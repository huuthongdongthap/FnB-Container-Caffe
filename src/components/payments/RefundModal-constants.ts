export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
}

export const RETRYABLE_ERROR_PATTERN =
  /đã được|xử lý rồi|không tìm thấy|không hợp lệ|đã hoàn|đã tồn tại/i;
