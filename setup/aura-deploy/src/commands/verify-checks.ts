import { request, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import * as dns from 'node:dns';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = resolve(__dirname, '../..');
const OUTPUT_DIR = resolve(PACKAGE_ROOT, 'output');

export interface BrandConfig {
  brand: {
    name: string;
    nameShort: string;
    tagline: string;
    domain: string;
  };
  theme?: {
    colors?: {
      primary?: string;
    };
  };
}

export interface CheckResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  detail: string;
}

export type HttpGetter = (url: string) => Promise<{ status: number; body: string }>;

export function loadBrandConfig(customBrandPath?: string): BrandConfig | null {
  const brandPath = customBrandPath || resolve(OUTPUT_DIR, 'brand.json');
  if (!existsSync(brandPath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(brandPath, 'utf-8')) as BrandConfig;
  } catch {
    return null;
  }
}

export function getHttp(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolvePromise, reject) => {
    const lib = url.startsWith('https') ? httpsRequest : request;
    const req = lib(url, { method: 'GET', timeout: 10_000 }, (res: IncomingMessage) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        resolvePromise({
          status: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString('utf-8'),
        });
      });
    });
    req.on('error', (err: Error) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.end();
  });
}

export async function checkDns(hostname: string): Promise<CheckResult> {
  return new Promise((resolvePromise) => {
    dns.resolve4(hostname, (err: NodeJS.ErrnoException | null) => {
      if (err) {
        resolvePromise({
          name: 'DNS Resolution',
          status: 'FAIL',
          detail: `Failed to resolve ${hostname}: ${err.message}`,
        });
      } else {
        resolvePromise({
          name: 'DNS Resolution',
          status: 'PASS',
          detail: `${hostname} resolves correctly`,
        });
      }
    });
  });
}

export async function checkHttps(hostname: string, httpGet: HttpGetter = getHttp): Promise<CheckResult> {
  try {
    const res = await httpGet(`https://${hostname}`);
    if (res.status >= 200 && res.status < 400) {
      return {
        name: 'HTTPS Certificate',
        status: 'PASS',
        detail: `HTTPS OK (HTTP ${res.status})`,
      };
    }
    return {
      name: 'HTTPS Certificate',
      status: 'FAIL',
      detail: `Unexpected HTTP status: ${res.status}`,
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      name: 'HTTPS Certificate',
      status: 'FAIL',
      detail: `HTTPS error: ${error.message}`,
    };
  }
}

export async function checkApiHealth(hostname: string, httpGet: HttpGetter = getHttp): Promise<CheckResult> {
  try {
    const res = await httpGet(`https://${hostname}/api/health`);
    if (res.status !== 200) {
      return {
        name: 'API Health',
        status: 'FAIL',
        detail: `/api/health returned HTTP ${res.status} (expected 200)`,
      };
    }
    const trimmed = res.body.trim();
    if (!trimmed || trimmed.startsWith('<')) {
      return {
        name: 'API Health',
        status: 'FAIL',
        detail: '/api/health returned HTML fallback instead of JSON health payload',
      };
    }
    const parsed = JSON.parse(trimmed) as { status?: string; d1?: string };
    if (parsed.status === 'ok' || parsed.status === 'healthy') {
      return {
        name: 'API Health',
        status: 'PASS',
        detail: `/api/health returned HTTP 200 (status: ${parsed.status})`,
      };
    }
    return {
      name: 'API Health',
      status: 'FAIL',
      detail: `/api/health reported status "${parsed.status ?? 'unknown'}"`,
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      name: 'API Health',
      status: 'FAIL',
      detail: `API health check error: ${error.message}`,
    };
  }
}

export async function checkVersionParity(
  hostname: string,
  expectedSha?: string,
  httpGet: HttpGetter = getHttp,
): Promise<CheckResult> {
  try {
    const [pagesRes, workerRes] = await Promise.all([
      httpGet(`https://${hostname}/version.json`),
      httpGet(`https://${hostname}/api/version`),
    ]);
    if (pagesRes.status !== 200 || workerRes.status !== 200) {
      return {
        name: 'Version SHA Parity',
        status: 'FAIL',
        detail: `Version endpoints returned /version.json=${pagesRes.status}, /api/version=${workerRes.status}`,
      };
    }
    const pagesJson = JSON.parse(pagesRes.body) as { sha?: string; shortSha?: string };
    const workerJson = JSON.parse(workerRes.body) as { fullSha?: string; sha?: string; shortSha?: string };
    const pagesSha = String(pagesJson.shortSha || pagesJson.sha?.slice(0, 8) || '').trim().toLowerCase();
    const workerSha = String(workerJson.shortSha || (workerJson.fullSha || workerJson.sha || '').slice(0, 8)).trim().toLowerCase();

    if (!pagesSha || pagesSha === 'unknown' || !workerSha || workerSha === 'unknown') {
      return {
        name: 'Version SHA Parity',
        status: 'FAIL',
        detail: `Invalid SHA reported (pages=${pagesSha || 'empty'}, worker=${workerSha || 'empty'})`,
      };
    }
    if (pagesSha !== workerSha) {
      return {
        name: 'Version SHA Parity',
        status: 'FAIL',
        detail: `Pages/Worker SHA mismatch (pages=${pagesSha}, worker=${workerSha})`,
      };
    }
    if (expectedSha) {
      const expectedShort = expectedSha.trim().toLowerCase().slice(0, 8);
      if (pagesSha !== expectedShort) {
        return {
          name: 'Version SHA Parity',
          status: 'FAIL',
          detail: `Deployed SHA (${pagesSha}) does not match expected SHA (${expectedShort})`,
        };
      }
    }
    return {
      name: 'Version SHA Parity',
      status: 'PASS',
      detail: `Pages and Worker match SHA ${pagesSha}`,
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      name: 'Version SHA Parity',
      status: 'FAIL',
      detail: `Version parity check error: ${error.message}`,
    };
  }
}

export async function checkBranding(
  hostname: string,
  brandName: string,
  httpGet: HttpGetter = getHttp,
): Promise<CheckResult> {
  try {
    const res = await httpGet(`https://${hostname}`);
    if (res.status !== 200) {
      return {
        name: 'Branding Check',
        status: 'FAIL',
        detail: `Main page returned HTTP ${res.status} (expected 200)`,
      };
    }
    const brandLower = brandName.toLowerCase();
    const bodyLower = res.body.toLowerCase();
    if (bodyLower.includes(brandLower) || bodyLower.includes(brandName)) {
      return {
        name: 'Branding Check',
        status: 'PASS',
        detail: `Page loads and contains brand name "${brandName}"`,
      };
    }
    return {
      name: 'Branding Check',
      status: 'FAIL',
      detail: `Page loads but brand name "${brandName}" not found in content`,
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      name: 'Branding Check',
      status: 'FAIL',
      detail: `Branding check error: ${error.message}`,
    };
  }
}
