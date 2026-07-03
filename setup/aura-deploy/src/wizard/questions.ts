import { validateRequired, validateEmail, validateHexColor, validatePassword } from './validators.js';

export interface Question {
  name: string;
  message: string;
  default?: string;
  validate: (value: string) => string | null;
  /** Optional transform applied before validation (e.g. auto-suggestion for domainSlug). */
  transform?: (value: string, answers: Record<string, string>) => string;
}

export function getQuestions(): Question[] {
  return [
    {
      name: 'cafeName',
      message: 'Cafe name (Ten quan ca phe)',
      validate: validateRequired,
    },
    {
      name: 'domainSlug',
      message: 'Domain slug (auto-suggested from cafe name)',
      transform(value: string, answers: Record<string, string>): string {
        if (!value || value.trim().length === 0) {
          return (answers.cafeName || '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
        }
        return value.toLowerCase().replace(/[^a-z0-9]/g, '');
      },
      validate(value: string): string | null {
        if (!value || value.trim().length === 0) {
          return 'Domain slug is required';
        }
        if (!/^[a-z0-9]+$/.test(value)) {
          return 'Only lowercase alphanumeric characters allowed';
        }
        return null;
      },
    },
    {
      name: 'primaryColor',
      message: 'Primary color (hex)',
      default: '#c6c6c7',
      validate: validateHexColor,
    },
    {
      name: 'tagline',
      message: 'Tagline (optional, max 100 chars)',
      default: '',
      validate(value: string): string | null {
        if (value && value.length > 100) {
          return 'Tagline must be 100 characters or fewer';
        }
        return null;
      },
    },
    {
      name: 'adminEmail',
      message: 'Admin email',
      validate: validateEmail,
    },
    {
      name: 'adminPassword',
      message: 'Admin password (min 8 chars)',
      validate: validatePassword,
    },
  ];
}
