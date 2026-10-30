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

export function toDomainSlug(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/g, '');
}

export function isValidDomainSlug(value: string): boolean {
  return (
    typeof value === 'string' &&
    value.length >= 3 &&
    value.length <= 30 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

export function validateDomainSlug(value: string): string | null {
  if (!value || value.trim().length === 0) {
    return 'Domain slug is required';
  }
  if (value.length < 3) {
    return 'Slug must be at least 3 characters';
  }
  if (value.length > 30) {
    return 'Slug must be 30 characters or fewer';
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    return 'Only lowercase alphanumeric characters and single internal hyphens allowed';
  }
  return null;
}

export function validateWizardAnswers(
  answers: Partial<Record<string, string>>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  const cafeErr = validateRequired(answers.cafeName ?? '');
  if (cafeErr) errors.cafeName = cafeErr;

  const slugErr = validateDomainSlug(answers.domainSlug ?? '');
  if (slugErr) errors.domainSlug = slugErr;

  const colorErr = validateHexColor(answers.primaryColor ?? '');
  if (colorErr) errors.primaryColor = colorErr;

  const tagline = answers.tagline ?? '';
  if (tagline.length > 100) {
    errors.tagline = 'Tagline must be 100 characters or fewer';
  }

  const emailErr = validateEmail(answers.adminEmail ?? '');
  if (emailErr) errors.adminEmail = emailErr;

  const passwordErr = validatePassword(answers.adminPassword ?? '');
  if (passwordErr) errors.adminPassword = passwordErr;

  return errors;
}

export function validateDeployTarget(
  domainSlug: string,
  projectName: string,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isValidDomainSlug(domainSlug)) {
    errors.push(
      `Invalid domainSlug "${domainSlug}" (expected 3-30 lowercase alphanumeric chars or single internal hyphens)`,
    );
  }
  if (
    !projectName ||
    projectName.length < 3 ||
    projectName.length > 63 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectName)
  ) {
    errors.push(
      `Invalid Cloudflare Pages projectName "${projectName}" (expected 3-63 lowercase alphanumeric chars or single internal hyphens)`,
    );
  }
  return { valid: errors.length === 0, errors };
}
