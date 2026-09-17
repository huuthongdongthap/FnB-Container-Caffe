/**
 * Escape giá trị CSV: bọc double-quote và nhân đôi quote bên trong
 * Escape CSV value: wrap in double-quotes and double inner quotes.
 */
export function escapeCsv(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value);
  // Luôn bọc quote để tránh lỗi parse với dấu phẩy / xuống dòng
  return `"${str.replace(/"/g, '""')}"`;
}