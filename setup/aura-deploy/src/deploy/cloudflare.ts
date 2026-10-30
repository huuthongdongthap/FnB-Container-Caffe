import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { validateWizardAnswers } from '../wizard/validators.js';
import type { WizardAnswers, GeneratedPaths } from '../template/generate.js';

export interface CloudflareResult {
  projectName: string;
  pagesUrl: string;
  apiUrl: string;
}

export interface ArtifactValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateGeneratedArtifacts(
  config: GeneratedPaths,
  answers: WizardAnswers,
): ArtifactValidationResult {
  const errors: string[] = [];

  const answerErrors = validateWizardAnswers(answers as unknown as Partial<Record<string, string>>);
  for (const [key, msg] of Object.entries(answerErrors)) {
    errors.push(`${key}: ${msg}`);
  }

  const requiredFiles: Array<[string, string]> = [
    ['brandJson', config.brandJson],
    ['envFile', config.envFile],
    ['wranglerToml', config.wranglerToml],
  ];

  for (const [label, filePath] of requiredFiles) {
    if (!filePath || !existsSync(filePath)) {
      errors.push(`${label} does not exist at ${filePath || '<empty>'}`);
      continue;
    }
    const content = readFileSync(filePath, 'utf-8').trim();
    if (!content) {
      errors.push(`${label} is empty at ${filePath}`);
      continue;
    }
    if (label === 'brandJson') {
      try {
        const parsed = JSON.parse(content) as {
          brand?: { name?: string; domain?: string };
        };
        const expectedDomain = `${answers.domainSlug}.pages.dev`;
        if (parsed.brand?.domain !== expectedDomain) {
          errors.push(
            `brandJson domain "${parsed.brand?.domain ?? ''}" does not match expected "${expectedDomain}"`,
          );
        }
      } catch {
        errors.push(`brandJson at ${filePath} is not valid JSON`);
      }
    }
    if (label === 'wranglerToml') {
      const expectedWorkerName = `name = "aura-cafe-${answers.domainSlug}"`;
      if (!content.includes(expectedWorkerName)) {
        errors.push(`wranglerToml does not contain expected ${expectedWorkerName}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Deploy a cafe instance to Cloudflare Pages.
 *
 * Validates that the generated files exist and match the wizard answers,
 * then prints the deployment plan.
 */
export async function deployToCloudflare(
  config: GeneratedPaths,
  answers: WizardAnswers,
  checkWranglerFn?: () => boolean,
): Promise<CloudflareResult> {
  const validation = validateGeneratedArtifacts(config, answers);
  if (!validation.valid) {
    throw new Error(`Cloudflare deployment artifact validation failed: ${validation.errors.join('; ')}`);
  }

  const projectName = `aura-cafe-${answers.domainSlug}`;

  // Check wrangler availability (soft check, not a blocker for the stub)
  let wranglerAvailable = false;
  if (checkWranglerFn) {
    wranglerAvailable = checkWranglerFn();
  } else {
    try {
      execSync('npx --no-install wrangler --version', { stdio: 'pipe', timeout: 10_000 });
      wranglerAvailable = true;
    } catch {
      wranglerAvailable = false;
    }
  }

  console.log('');
  console.log('  Deployment Plan');
  console.log('  --------------');
  console.log(`  Project name:   ${projectName}`);
  console.log(`  Brand config:   ${config.brandJson}`);
  console.log(`  Environment:    ${config.envFile}`);
  console.log(`  Wrangler conf:  ${config.wranglerToml}`);
  console.log(`  Wrangler CLI:   ${wranglerAvailable ? 'detected' : 'not detected (install with: npm i -g wrangler)'}`);
  console.log('');

  if (!wranglerAvailable) {
    console.log('  [STUB] To deploy when ready:');
    console.log('    1. Install Wrangler: npm i -g wrangler');
    console.log('    2. Run: wrangler pages project create ' + projectName);
    console.log('    3. Run: wrangler deploy');
    console.log('');
  }

  return {
    projectName,
    pagesUrl: `https://${answers.domainSlug}.pages.dev`,
    apiUrl: `https://${answers.domainSlug}.pages.dev/api`,
  };
}
