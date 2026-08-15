import { PHONE_REGEX } from './contact-form-types';

export function validateName(value: string): string | undefined {
  if (!value.trim()) return 'Vui lòng nhập tên của bạn.';
  if (value.trim().length < 2) return 'Tên phải có ít nhất 2 ký tự.';
  return undefined;
}

export function validatePhone(value: string): string | undefined {
  if (!value.trim()) return 'Vui lòng nhập số điện thoại.';
  if (!PHONE_REGEX.test(value.replace(/\s/g, '')))
    return 'Số điện thoại không hợp lệ (VD: 0946013633).';
  return undefined;
}

export function validateContent(value: string): string | undefined {
  if (!value.trim()) return 'Vui lòng nhập nội dung.';
  if (value.trim().length < 5) return 'Nội dung phải có ít nhất 5 ký tự.';
  return undefined;
}
