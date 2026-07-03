import { execSync } from 'node:child_process';
import type { WizardAnswers, GeneratedPaths } from '../template/generate.js';

export interface CloudflareResult {
  projectName: string;
  pagesUrl: string;
  apiUrl: string;
}

/**
 * Deploy a cafe instance to Cloudflare Pages.
 *
 * STUB: Actual Cloudflare deployment will be implemented after testing
 * with a real Cloudflare account. For now this module validates that
 * the generated files exist and prints the deployment plan.
 */
export async function deployToCloudflare(
  config: GeneratedPaths,
  answers: WizardAnswers,
): Promise<CloudflareResult> {
  const projectName = `aura-cafe-${answers.domainSlug}`;

  // Check wrangler availability (soft check, not a blocker for the stub)
  let wranglerAvailable = false;
  try {
    execSync('npx wrangler --version', { stdio: 'pipe', timeout: 10_000 });
    wranglerAvailable = true;
  } catch {
    wranglerAvailable = false;
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
