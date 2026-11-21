#!/usr/bin/env node
// Run locally, or add --live <origin> to verify the deployed files match this checkout.
import { readFile, stat } from 'node:fs/promises';

const CANONICAL = 'https://auraspace.cafe';
const AI_AGENTS = ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot'];
const PRIVATE_PATHS = [
  '/admin/', '/kds', '/kds/', '/kitchen-display/', '/auth/', '/portal/',
  '/dashboard/', '/checkout', '/success/', '/failure/', '/mobile/',
];
const assets = new Map();
let passed = 0;
let failed = 0;

function check(ok, label) {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
}

async function loadAsset(path) {
  if (assets.has(path)) return assets.get(path);
  const url = new URL(`../public${path}`, import.meta.url);
  try {
    if (!(await stat(url)).isFile()) throw new Error('Not a file');
    const bytes = await readFile(url);
    if (!bytes.toString('utf8').trim()) throw new Error('Empty file');
    assets.set(path, bytes);
    return bytes;
  } catch (error) {
    check(false, `public${path}: ${error.message}`);
    return null;
  }
}

function parseDisallows(text) {
  const groups = new Map();
  let agents = [];
  let hasRule = false;
  for (const raw of text.split(/\r?\n/)) {
    const [, directive, value] = raw.replace(/#.*$/, '').trim().match(/^([\w-]+)\s*:\s*(.*)$/) ?? [];
    const field = directive?.toLowerCase();
    if (field === 'user-agent') {
      if (hasRule) agents = [];
      hasRule = false;
      const agent = value.toLowerCase();
      agents.push(agent);
      if (!groups.has(agent)) groups.set(agent, new Set());
    } else if (field === 'allow' || field === 'disallow') {
      hasRule = true;
      if (field === 'disallow' && value) {
        for (const agent of agents) groups.get(agent).add(value);
      }
    }
  }
  return groups;
}

async function checkRobots() {
  const robots = await loadAsset('/robots.txt');
  if (!robots) return;
  const root = await readFile(new URL('../robots.txt', import.meta.url)).catch(() => null);
  check(root?.equals(robots), 'public/robots.txt and root robots.txt are byte-identical');
  const text = robots.toString('utf8');
  const groups = parseDisallows(text);
  const wildcard = groups.get('*') ?? new Set();
  const missing = PRIVATE_PATHS.filter((path) => !wildcard.has(path));
  check(!missing.length, missing.length ? `Wildcard missing: ${missing.join(', ')}` : 'Wildcard contains all private Disallow rules');
  for (const agent of AI_AGENTS) {
    const rules = groups.get(agent.toLowerCase());
    const absent = [...wildcard].filter((path) => !rules?.has(path));
    check(rules && !absent.length, !rules ? `Missing ${agent} group` : absent.length
      ? `${agent} missing: ${absent.join(', ')}` : `${agent} mirrors wildcard Disallow rules`);
  }
  check(text.split(/\r?\n/).some((line) => {
    const match = line.match(/^\s*Sitemap:\s*(\S+)\s*$/i);
    return match?.[1] === `${CANONICAL}/sitemap.xml`;
  }), 'robots.txt declares the canonical sitemap');
}

async function checkSitemap() {
  const sitemap = await loadAsset('/sitemap.xml');
  if (!sitemap) return;
  const locs = [...sitemap.toString('utf8').matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1].trim());
  const canonical = locs.every((loc) => URL.canParse(loc) && loc.startsWith(`${CANONICAL}/`) && new URL(loc).origin === CANONICAL);
  check(locs.length > 0 && canonical && new Set(locs).size === locs.length,
    `Sitemap: ${locs.length} entries (must be non-empty, canonical HTTPS, and unique)`);
}

async function checkTextFiles() {
  const llms = await loadAsset('/llms.txt');
  if (llms) check(true, 'llms.txt is non-empty');
  if (await loadAsset('/llms-full.txt')) check(true, 'llms-full.txt is non-empty');
  if (!llms) return;
  const links = new Set([...llms.toString('utf8').matchAll(
    /\]\(https:\/\/auraspace\.cafe(\/(?:[a-z0-9_-]+\/)*[a-z0-9._-]+\.(?:md|txt))\)/gi,
  )].map((match) => match[1]));
  const files = await Promise.all([...links].map(loadAsset));
  check(files.length > 0 && files.every(Boolean), `${files.filter(Boolean).length}/${links.size} linked markdown/text files present`);
}

async function checkLive(origin) {
  await Promise.all([...assets].map(async ([path, expected]) => {
    const url = new URL(path, origin);
    try {
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10_000) });
      if (response.status !== 200) {
        check(false, `${url} returned HTTP ${response.status}`);
        return;
      }
      const actual = Buffer.from(await response.arrayBuffer());
      const matches = expected.equals(actual);
      check(matches, `${url} ${matches ? 'matches checkout' : 'differs from checkout'}`);
    } catch (error) {
      check(false, `${url}: ${error.message}`);
    }
  }));
}

const args = process.argv.slice(2);
const origin = args[0] === '--live' && args.length === 2 && URL.canParse(args[1]) ? new URL(args[1]) : null;
if (args.length && (!origin || !['https:', 'http:'].includes(origin.protocol) ||
  origin.username || origin.password || origin.href !== `${origin.origin}/`)) {
  console.error('Usage: node scripts/check-discovery-surfaces.mjs [--live <http-or-https-origin>]');
  process.exitCode = 1;
} else {
  await checkRobots();
  await checkSitemap();
  await checkTextFiles();
  if (origin && !failed) await checkLive(origin);
  console.log(`Discovery surfaces: ${passed} passed, ${failed} failed.`);
  if (failed) process.exitCode = 1;
}
