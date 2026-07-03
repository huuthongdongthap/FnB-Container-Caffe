export function validateRequired(value: string): string | null {
  if (!value || value.trim().length === 0) {
    return 'This field is required';
  }
  return null;
}

export function validateEmail(value: string): string | null {
  if (!value || value.trim().length === 0) {
    return 'Email is required';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return 'Invalid email format';
  }
  return null;
}

export function validateHexColor(value: string): string | null {
  if (!value || value.trim().length === 0) {
    return 'Hex color is required';
  }
  const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
  if (!hexRegex.test(value)) {
    return 'Invalid hex color. Use format like #c6c6c7';
  }
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value || value.trim().length === 0) {
    return 'Password is required';
  }
  if (value.length < 8) {
    return 'Password must be at least 8 characters';
  }
  return null;
}
