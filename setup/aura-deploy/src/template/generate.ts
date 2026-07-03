import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

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
 * Read a template file and substitute {{PLACEHOLDER}} tokens with answer values.
 */
function substitute(template: string, answers: WizardAnswers): string {
  const tokens: Record<string, string> = {
    CAFE_NAME: answers.cafeName,
    CAFE_NAME_SHORT: answers.cafeName.split(' ')[0],
    DOMAIN_SLUG: answers.domainSlug,
    PRIMARY_COLOR: answers.primaryColor,
    TAGLINE: answers.tagline || '',
    ADMIN_EMAIL: answers.adminEmail,
    ADMIN_PASSWORD: answers.adminPassword,
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
 * 3. Writes output files to output/
 * 4. Returns paths to the generated files
 */
export async function generateConfig(answers: WizardAnswers): Promise<GeneratedPaths> {
  // Ensure output directory exists
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // --- brand.json ---
  const brandTemplate = readFileSync(resolve(CONFIG_DIR, 'brand.json'), 'utf-8');
  const brandContent = substitute(brandTemplate, answers);
  const brandJsonPath = resolve(OUTPUT_DIR, 'brand.json');
  writeFileSync(brandJsonPath, brandContent, 'utf-8');

  // --- .env ---
  const envTemplate = readFileSync(resolve(CONFIG_DIR, '.env.template'), 'utf-8');
  const envContent = substitute(envTemplate, answers);
  const envFilePath = resolve(OUTPUT_DIR, '.env');
  writeFileSync(envFilePath, envContent, 'utf-8');

  // --- wrangler.toml ---
  const wranglerTemplate = readFileSync(resolve(CONFIG_DIR, 'wrangler.toml'), 'utf-8');
  const wranglerContent = substitute(wranglerTemplate, answers);
  const wranglerTomlPath = resolve(OUTPUT_DIR, 'wrangler.toml');
  writeFileSync(wranglerTomlPath, wranglerContent, 'utf-8');

  return {
    brandJson: brandJsonPath,
    envFile: envFilePath,
    wranglerToml: wranglerTomlPath,
  };
}
