/**
 * Escape giá trị CSV: bọc double-quote và nhân đôi quote bên trong
 * Escape CSV value: wrap in double-quotes and double inner quotes.
 */
export function escapeCsv(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value);
  const prefixed = (/^[\t\r\n ]*[=+\-@]/.test(str) || /^[=+\-@|]/.test(str.trimStart())) ? `'${str}` : str;
  const safe = prefixed.replace(/([\r\n]+)(\s*[=+\-@|])/g, "$1'$2");
  // Luôn bọc quote để tránh lỗi parse với dấu phẩy / xuống dòng
  return `"${safe.replace(/"/g, '""')}"`;
}
