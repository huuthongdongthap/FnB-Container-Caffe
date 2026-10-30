import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { validateWizardAnswers } from '../wizard/validators.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Root of the package (two levels up from src/template/)
const PACKAGE_ROOT = resolve(__dirname, '../..');
const CONFIG_DIR = resolve(PACKAGE_ROOT, 'config');
const OUTPUT_DIR = resolve(PACKAGE_ROOT, 'output');

export interface WizardAnswers {
  cafeName: string;
  domainSlug: string;
  primaryColor: string;
  tagline: string;
  adminEmail: string;
  adminPassword: string;
}

export interface GeneratedPaths {
  brandJson: string;
  envFile: string;
  wranglerToml: string;
}

/**
 * Escape string values interpolated inside JSON / TOML double-quoted literals
 * or .env files so quotes, backslashes, and control newlines cannot corrupt syntax.
 */
function escapeTemplateValue(raw: string): string {
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

/**
 * Read a template file and substitute {{PLACEHOLDER}} tokens with answer values.
 */
function substitute(template: string, answers: WizardAnswers): string {
  const shortName = answers.cafeName.trim().split(/\s+/)[0] || answers.cafeName;
  const tokens: Record<string, string> = {
    CAFE_NAME: escapeTemplateValue(answers.cafeName),
    CAFE_NAME_SHORT: escapeTemplateValue(shortName),
    DOMAIN_SLUG: escapeTemplateValue(answers.domainSlug),
    PRIMARY_COLOR: escapeTemplateValue(answers.primaryColor),
    TAGLINE: escapeTemplateValue(answers.tagline || ''),
    ADMIN_EMAIL: escapeTemplateValue(answers.adminEmail),
    ADMIN_PASSWORD: escapeTemplateValue(answers.adminPassword),
  };

  let result = template;
  for (const [key, value] of Object.entries(tokens)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

/**
 * Generate deployment configuration files from wizard answers.
 *
 * 1. Reads template files from config/
 * 2. Substitutes values from wizard answers
 * 3. Writes output files to output/ (or custom outputDir)
 * 4. Returns paths to the generated files
 */
export async function generateConfig(
  answers: WizardAnswers,
  outputDir: string = OUTPUT_DIR,
): Promise<GeneratedPaths> {
  const validationErrors = validateWizardAnswers(answers as unknown as Partial<Record<string, string>>);
  const errorKeys = Object.keys(validationErrors);
  if (errorKeys.length > 0) {
    const details = errorKeys.map((k) => `${k}: ${validationErrors[k]}`).join('; ');
    throw new Error(`Invalid wizard answers for config generation — ${details}`);
  }

  // Ensure output directory exists
  mkdirSync(outputDir, { recursive: true });

  // --- brand.json ---
  const brandTemplate = readFileSync(resolve(CONFIG_DIR, 'brand.json'), 'utf-8');
  const brandContent = substitute(brandTemplate, answers);
  const brandJsonPath = resolve(outputDir, 'brand.json');
  writeFileSync(brandJsonPath, brandContent, 'utf-8');

  // --- .env ---
  const envTemplate = readFileSync(resolve(CONFIG_DIR, '.env.template'), 'utf-8');
  const envContent = substitute(envTemplate, answers);
  const envFilePath = resolve(outputDir, '.env');
  writeFileSync(envFilePath, envContent, 'utf-8');

  // --- wrangler.toml ---
  const wranglerTemplate = readFileSync(resolve(CONFIG_DIR, 'wrangler.toml'), 'utf-8');
  const wranglerContent = substitute(wranglerTemplate, answers);
  const wranglerTomlPath = resolve(outputDir, 'wrangler.toml');
  writeFileSync(wranglerTomlPath, wranglerContent, 'utf-8');

  return {
    brandJson: brandJsonPath,
    envFile: envFilePath,
    wranglerToml: wranglerTomlPath,
  };
}
