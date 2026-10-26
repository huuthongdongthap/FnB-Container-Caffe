#!/usr/bin/env node
/**
 * Pre-Release & Staging Gate Verifier for AURA OS.
 * Evaluates local build/migration/rollback gates and checks staging credential presence
 * without exposing secret values or touching production infrastructure.
 *
 * Usage:
 *   node scripts/verify-staging-gates.mjs [--require-staging] [--target=<target-id>]
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintMigrationsDirectory } from './lint-d1-migrations.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');

export const REQUIRED_STAGING_CREDENTIALS = [
  'CLOUDFLARE_API_TOKEN_STAGING',
  'AURA_DB_STAGING',
  'PAYOS_CLIENT_ID_STAGING',
  'PAYOS_API_KEY_STAGING',
  'PAYOS_CHECKSUM_KEY_STAGING',
  'JWT_SECRET_STAGING',
];

export const DEPLOYMENT_MIGRATION_TARGETS = [
  {
    id: 'primary-worker-d1',
    target: 'deploy-cloudflare.sh & worker/scripts/apply-migrations.sh',
    directory: 'worker/db/migrations',
    required: true,
    activationStatus: 'active',
  },
  {
    id: 'branded-instance-d1',
    target: 'scripts/deploy-branded.sh & scripts/deploy-demo.sh',
    directory: 'scripts/migrations',
    required: false,
    activationStatus: 'conditional',
  },
  {
    id: 'operator-runbook-d1',
    target: 'docs/deployment-guide.md & docs/deployment.md',
    directory: 'db/migrations',
    required: false,
    activationStatus: 'unknown',
  },
  {
    id: 'legacy-bootstrap-d1',
    target: 'worker/db/migrations/README.md & docs/runbook-d1-backup-restore.md',
    directory: 'worker/migrations',
    required: false,
    activationStatus: 'unknown',
  },
];

const NON_ROLLBACK_COMMANDS = new Set([
  'echo',
  'printf',
  'logger',
  'cat',
  'head',
  'tail',
  'grep',
  'sed',
  'awk',
  'curl',
  'sleep',
  'true',
  'false',
  ':',
  'test',
  '[',
  '[[',
  'which',
  'type',
  'whereis',
  'hash',
  'read',
  'cd',
  'pwd',
  'mkdir',
  'rm',
  'cp',
  'mv',
  'chmod',
  'chown',
  'touch',
  'date',
  'export',
  'local',
  'readonly',
  'unset',
  'set',
  'shift',
  'exit',
  'return',
]);

const WRANGLER_VALUE_FLAGS = new Set([
  '--config',
  '-c',
  '--env',
  '-e',
  '--cwd',
  '--env-file',
]);

function stripInlineShellComment(line) {
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && !inSingle) {
      escaped = true;
      continue;
    }
    if (ch === '\'' && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && ch === '#') {
      if (i === 0 || /[\s;&|()]/.test(line[i - 1])) {
        return line.slice(0, i);
      }
    }
  }
  return line;
}

function preprocessShellLines(rawContent) {
  const rawLines = rawContent.split(/\r?\n/);
  const logicalLines = [];
  let pendingHeredoc = null;
  let accumulator = '';

  for (const rawLine of rawLines) {
    if (pendingHeredoc) {
      const checkLine = pendingHeredoc.stripTabs ? rawLine.replace(/^\t+/, '') : rawLine;
      if (checkLine.trim() === pendingHeredoc.delimiter) {
        pendingHeredoc = null;
      }
      continue;
    }

    const uncommented = stripInlineShellComment(rawLine);
    const trimmedRight = uncommented.replace(/\s+$/, '');
    if (trimmedRight.endsWith('\\') && !trimmedRight.endsWith('\\\\')) {
      accumulator += `${trimmedRight.slice(0, -1)} `;
      continue;
    }

    let fullLine = `${accumulator}${uncommented}`.trim();
    accumulator = '';
    if (!fullLine) {continue;}

    const heredocMatch = fullLine.match(/<<(-?)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2/);
    if (heredocMatch) {
      pendingHeredoc = {
        stripTabs: heredocMatch[1] === '-',
        delimiter: heredocMatch[3],
      };
      fullLine = fullLine.slice(0, heredocMatch.index).trim();
    }

    if (fullLine) {
      logicalLines.push(fullLine);
    }
  }

  if (accumulator.trim()) {
    logicalLines.push(accumulator.trim());
  }

  return logicalLines;
}

function splitShellClauses(logicalLines) {
  const clauses = [];
  for (const line of logicalLines) {
    let inSingle = false;
    let inDouble = false;
    let escaped = false;
    let start = 0;
    let prevOp = 'none';

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\' && !inSingle) {
        escaped = true;
        continue;
      }
      if (ch === '\'' && !inDouble) {
        inSingle = !inSingle;
        continue;
      }
      if (ch === '"' && !inSingle) {
        inDouble = !inDouble;
        continue;
      }
      if (!inSingle && !inDouble) {
        if (ch === ';') {
          const text = line.slice(start, i).trim();
          if (text) {clauses.push({ text, prevOp });}
          prevOp = ';';
          start = i + 1;
        } else if (
          (ch === '&' && line[i + 1] === '&') ||
          (ch === '|' && line[i + 1] === '|')
        ) {
          const op = `${ch}${line[i + 1]}`;
          const text = line.slice(start, i).trim();
          if (text) {clauses.push({ text, prevOp });}
          prevOp = op;
          i++;
          start = i + 1;
        }
      }
    }

    const tail = line.slice(start).trim();
    if (tail) {
      clauses.push({ text: tail, prevOp });
    }
  }
  return clauses;
}

function tokenizeShellWords(clauseText) {
  // Strip redirections like 2>/dev/null, >/dev/null, 2>&1, &>/dev/null
  const cleaned = clauseText.replace(/(?:^|\s)(?:\d*>>?\s*\S+|\d*>&\d+|&>>?\s*\S+)/g, ' ');
  const words = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\' && !inSingle) {
      escaped = true;
      continue;
    }
    if (ch === '\'' && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && /\s/.test(ch)) {
      if (current.length > 0) {
        words.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (current.length > 0) {
    words.push(current);
  }
  return words;
}

function expandShellVariables(text, vars, positionalArgs = []) {
  return text
    .replace(/"\$@"\s*|\$@\s*|\$\*\s*/g, `${positionalArgs.join(' ')} `)
    .replace(/\$\{([A-Za-z_][A-Za-z0-9_]*):-([^}]*)\}/g, (_, name, fallback) => {
      const val = vars.get(name);
      return val !== undefined && val !== '' ? val : fallback;
    })
    .replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (full, braced, bare) => {
      const name = braced || bare;
      return vars.has(name) ? vars.get(name) : full;
    })
    .replace(/\$([1-9])/g, (full, idxStr) => {
      const idx = Number(idxStr) - 1;
      return positionalArgs[idx] !== undefined ? positionalArgs[idx] : full;
    });
}

function evaluateStaticShellCondition(condText, vars) {
  const expanded = expandShellVariables(condText.trim(), vars);
  if (/^\(\(\s*0\s*\)\)$/.test(expanded)) {return 'false';}
  if (/^\(\(\s*[1-9]\d*\s*\)\)$/.test(expanded)) {return 'true';}

  const words = tokenizeShellWords(expanded);
  if (words.length === 0) {return 'unknown';}

  if (words.length === 1) {
    if (words[0] === 'false') {return 'false';}
    if (words[0] === 'true' || words[0] === ':') {return 'true';}
  }
  if (words.length === 2 && words[0] === '!') {
    if (words[1] === 'true') {return 'false';}
    if (words[1] === 'false') {return 'true';}
  }

  let testWords = null;
  if (words[0] === 'test') {
    testWords = words.slice(1);
  } else if (
    (words[0] === '[' && words[words.length - 1] === ']') ||
    (words[0] === '[[' && words[words.length - 1] === ']]')
  ) {
    testWords = words.slice(1, -1);
  }

  if (testWords) {
    if (testWords.some((w) => w.includes('$'))) {
      return 'unknown';
    }
    if (testWords.length === 1) {
      return testWords[0].length > 0 ? 'true' : 'false';
    }
    if (testWords.length === 2) {
      if (testWords[0] === '-z') {return testWords[1].length === 0 ? 'true' : 'false';}
      if (testWords[0] === '-n') {return testWords[1].length > 0 ? 'true' : 'false';}
    }
    if (testWords.length === 3) {
      const [left, op, right] = testWords;
      if (op === '=' || op === '==') {return left === right ? 'true' : 'false';}
      if (op === '!=') {return left !== right ? 'true' : 'false';}
      if (op === '-eq') {return Number(left) === Number(right) ? 'true' : 'false';}
      if (op === '-ne') {return Number(left) !== Number(right) ? 'true' : 'false';}
    }
  }

  return 'unknown';
}

function classifyWranglerCommandWords(words) {
  let idx = 0;
  // Strip leading KEY=VALUE env assignments
  while (idx < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[idx])) {
    idx++;
  }
  // Strip leading shell prefixes
  while (idx < words.length && ['env', 'exec', 'nohup', 'time', 'command'].includes(words[idx])) {
    if (words[idx] === 'command' && (words[idx + 1] === '-v' || words[idx + 1] === '-V')) {
      return null;
    }
    idx++;
    while (idx < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[idx])) {
      idx++;
    }
  }

  if (idx >= words.length) {return null;}
  const cmd = words[idx];
  if (cmd === 'curl') {
    const args = words.slice(idx + 1);
    const methodIndex = args.findIndex((arg) => arg === '-X' || arg === '--request');
    const method = methodIndex >= 0 ? args[methodIndex + 1] : undefined;
    const pagesRollbackUrl = args.some((arg) => /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/[^/]+\/pages\/projects\/[^/]+\/deployments\/[^/]+\/rollback$/.test(arg));
    return method === 'POST' && pagesRollbackUrl ? 'pages' : null;
  }
  if (NON_ROLLBACK_COMMANDS.has(cmd)) {return null;}

  // Strip package runner wrappers (npx, bunx, pnpm dlx/exec, yarn dlx, npm exec)
  if (cmd === 'npx' || cmd === 'bunx') {
    idx++;
    while (idx < words.length && words[idx].startsWith('-')) {
      if ((words[idx] === '-p' || words[idx] === '--package') && idx + 1 < words.length) {
        idx += 2;
      } else {
        idx++;
      }
    }
  } else if ((cmd === 'pnpm' || cmd === 'yarn') && (words[idx + 1] === 'dlx' || words[idx + 1] === 'exec')) {
    idx += 2;
  } else if (cmd === 'npm' && words[idx + 1] === 'exec') {
    idx += 2;
    if (words[idx] === '--') {idx++;}
  }

  if (idx >= words.length) {return null;}
  const targetBin = words[idx];
  if (targetBin !== 'wrangler' && !targetBin.endsWith('/wrangler')) {
    return null;
  }
  idx++;

  const subcommands = [];
  const remainingArgs = words.slice(idx);
  for (let i = 0; i < remainingArgs.length; i++) {
    const token = remainingArgs[i];
    if (WRANGLER_VALUE_FLAGS.has(token)) {
      i++; // skip flag value
      continue;
    }
    if (token.startsWith('-')) {
      continue;
    }
    subcommands.push(token);
  }

  if (subcommands[0] === 'rollback') {
    return 'worker';
  }
  if (
    subcommands[0] === 'd1' &&
    subcommands[1] === 'time-travel' &&
    subcommands[2] === 'restore'
  ) {
    return 'd1';
  }
  if (subcommands[0] === 'd1' && subcommands[1] === 'execute') {
    const joinedArgs = remainingArgs.join(' ');
    const referencesDownSql =
      /\.down\.sql\b/i.test(joinedArgs) ||
      /(?:--file|-f)(?:=|\s+)\S*(?:down|rollback)\S*/i.test(joinedArgs);
    if (referencesDownSql) {
      return 'd1';
    }
  }

  return null;
}

export function inspectRollbackCapabilities(rollbackScriptPath) {
  if (!existsSync(rollbackScriptPath)) {
    return {
      scriptExists: false,
      evidenceLevel: 'static_script_inspection',
      runtimeVerified: false,
      pages: 'script_missing',
      worker: 'script_missing',
      d1: 'script_missing',
      allStaticCommandsPresent: false,
    };
  }

  const rawContent = readFileSync(rollbackScriptPath, 'utf8');
  const logicalLines = preprocessShellLines(rawContent);
  const clauses = splitShellClauses(logicalLines);

  const vars = new Map();
  const functions = new Map();
  const detected = {
    pages: false,
    worker: false,
    d1: false,
  };

  function evaluateClauses(clauseList, positionalArgs = [], callDepth = 0) {
    if (callDepth > 6) {return;}
    const stack = [];
    let topTerminated = false;
    let collectingFnName = null;
    let collectingFnDepth = 0;
    let collectingFnBody = [];

    function isCurrentlyReachable() {
      if (topTerminated) {return false;}
      for (const frame of stack) {
        if (!frame.branchReachable || frame.branchTerminated) {return false;}
      }
      return true;
    }

    function markCurrentBranchTerminated() {
      if (stack.length === 0) {
        topTerminated = true;
      } else {
        stack[stack.length - 1].branchTerminated = true;
      }
    }

    function processSimpleClause(text, prevOp) {
      const trimmed = text.trim();
      if (!trimmed) {return;}

      if (trimmed.startsWith('if ')) {
        const cond = trimmed.slice(3).trim();
        const condStatus = evaluateStaticShellCondition(cond, vars);
        stack.push({
          type: 'if',
          parentReachable: isCurrentlyReachable(),
          condStatus,
          branchReachable: false,
          anyBranchStaticallyTrue: condStatus === 'true',
          branchTerminated: false,
          staticallyTrueBranchTerminated: false,
        });
        return;
      }

      if (trimmed === 'then' || trimmed.startsWith('then ')) {
        const top = stack[stack.length - 1];
        if (top && top.type === 'if') {
          top.branchReachable = top.parentReachable && top.condStatus !== 'false';
          top.branchTerminated = false;
        }
        const rest = trimmed.slice(4).trim();
        if (rest) {processSimpleClause(rest, 'none');}
        return;
      }

      if (trimmed.startsWith('elif ')) {
        const top = stack[stack.length - 1];
        if (top && top.type === 'if') {
          if (top.condStatus === 'true' && top.branchTerminated) {
            top.staticallyTrueBranchTerminated = true;
          }
          const cond = trimmed.slice(5).trim();
          const rawStatus = evaluateStaticShellCondition(cond, vars);
          const condStatus = top.anyBranchStaticallyTrue ? 'false' : rawStatus;
          if (condStatus === 'true') {top.anyBranchStaticallyTrue = true;}
          top.condStatus = condStatus;
          top.branchReachable = false;
          top.branchTerminated = false;
        }
        return;
      }

      if (trimmed === 'else' || trimmed.startsWith('else ')) {
        const top = stack[stack.length - 1];
        if (top && top.type === 'if') {
          if (top.condStatus === 'true' && top.branchTerminated) {
            top.staticallyTrueBranchTerminated = true;
          }
          top.condStatus = top.anyBranchStaticallyTrue ? 'false' : 'true';
          top.branchReachable = top.parentReachable && !top.anyBranchStaticallyTrue;
          top.branchTerminated = false;
        }
        const rest = trimmed.slice(4).trim();
        if (rest) {processSimpleClause(rest, 'none');}
        return;
      }

      if (trimmed === 'fi' || trimmed.startsWith('fi ')) {
        const top = stack.pop();
        if (top && top.type === 'if') {
          if (top.condStatus === 'true' && top.branchTerminated) {
            top.staticallyTrueBranchTerminated = true;
          }
          if (top.staticallyTrueBranchTerminated) {
            markCurrentBranchTerminated();
          }
        }
        return;
      }

      if (trimmed.startsWith('while ')) {
        const cond = trimmed.slice(6).trim();
        const condStatus = evaluateStaticShellCondition(cond, vars);
        stack.push({
          type: 'loop',
          parentReachable: isCurrentlyReachable(),
          condStatus,
          branchReachable: false,
          branchTerminated: false,
        });
        return;
      }

      if (trimmed.startsWith('for ')) {
        stack.push({
          type: 'loop',
          parentReachable: isCurrentlyReachable(),
          condStatus: 'unknown',
          branchReachable: false,
          branchTerminated: false,
        });
        return;
      }

      if (trimmed === 'do' || trimmed.startsWith('do ')) {
        const top = stack[stack.length - 1];
        if (top && top.type === 'loop') {
          top.branchReachable = top.parentReachable && top.condStatus !== 'false';
          top.branchTerminated = false;
        }
        const rest = trimmed.slice(2).trim();
        if (rest) {processSimpleClause(rest, 'none');}
        return;
      }

      if (trimmed === 'done' || trimmed.startsWith('done ')) {
        stack.pop();
        return;
      }

      if (!isCurrentlyReachable()) {
        return;
      }

      // Check for unconditional exit / return
      if (/^(?:exit|return)(?:\s+\d+)?$/.test(trimmed)) {
        if (prevOp !== '||') {
          markCurrentBranchTerminated();
        }
        return;
      }

      // Check for shell variable assignment: [export|local] VAR=VALUE
      const assignMatch = trimmed.match(
        /^(?:export\s+|local\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/
      );
      if (assignMatch) {
        const varName = assignMatch[1];
        const rawVal = assignMatch[2].trim().replace(/^['"]|['"]$/g, '');
        vars.set(varName, expandShellVariables(rawVal, vars, positionalArgs));
        return;
      }

      const expanded = expandShellVariables(trimmed, vars, positionalArgs);
      const words = tokenizeShellWords(expanded);
      if (words.length === 0) {return;}

      if (functions.has(words[0])) {
        const fnBody = functions.get(words[0]);
        evaluateClauses(fnBody, words.slice(1), callDepth + 1);
        return;
      }

      const layer = classifyWranglerCommandWords(words);
      if (layer) {
        detected[layer] = true;
      }
    }

    for (const clause of clauseList) {
      const trimmed = clause.text.trim();
      if (!trimmed) {continue;}

      if (collectingFnName) {
        const opens = (trimmed.match(/\{/g) || []).length;
        const closes = (trimmed.match(/\}/g) || []).length;
        collectingFnDepth += opens - closes;
        if (collectingFnDepth <= 0) {
          const beforeClose = trimmed.replace(/\}\s*$/, '').trim();
          if (beforeClose) {
            collectingFnBody.push({ text: beforeClose, prevOp: clause.prevOp });
          }
          functions.set(collectingFnName, collectingFnBody);
          collectingFnName = null;
          collectingFnBody = [];
          collectingFnDepth = 0;
        } else {
          collectingFnBody.push(clause);
        }
        continue;
      }

      const fnMatch = trimmed.match(
        /^(?:function\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(\s*\))?\s*\{(.*)$/
      );
      if (fnMatch) {
        const fnName = fnMatch[1];
        const afterOpen = fnMatch[2].trim();
        if (afterOpen.endsWith('}')) {
          const inner = afterOpen.slice(0, -1).trim();
          functions.set(fnName, inner ? [{ text: inner, prevOp: 'none' }] : []);
        } else {
          collectingFnName = fnName;
          collectingFnDepth = 1;
          collectingFnBody = afterOpen ? [{ text: afterOpen, prevOp: 'none' }] : [];
        }
        continue;
      }

      processSimpleClause(trimmed, clause.prevOp);
    }
  }

  evaluateClauses(clauses, ['<deployment-id>'], 0);

  const pages = detected.pages ? 'static_command_detected' : 'unreferenced';
  const worker = detected.worker ? 'static_command_detected' : 'unreferenced';
  const d1 = detected.d1 ? 'static_command_detected' : 'unreferenced';

  return {
    scriptExists: true,
    evidenceLevel: 'static_script_inspection',
    runtimeVerified: false,
    pages,
    worker,
    d1,
    allStaticCommandsPresent:
      pages === 'static_command_detected' &&
      worker === 'static_command_detected' &&
      d1 === 'static_command_detected',
  };
}

export const BUILD_INPUT_PATHS = [
  'src',
  'public',
  'packages',
  'assets',
  'index.html',
  '_redirects',
  '_headers',
  'package.json',
  'package-lock.json',
  'vite.config.js',
  'tsconfig.json',
];

function getLatestMtimeMs(targetPath) {
  if (!existsSync(targetPath)) {return 0;}
  const stat = statSync(targetPath);
  if (!stat.isDirectory()) {
    return stat.mtimeMs;
  }
  let latest = 0;
  for (const entry of readdirSync(targetPath, { withFileTypes: true })) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '.git' ||
      entry.name === 'dist' ||
      entry.name === 'coverage'
    ) {
      continue;
    }
    const childPath = resolve(targetPath, entry.name);
    if (entry.isDirectory()) {
      const childLatest = getLatestMtimeMs(childPath);
      if (childLatest > latest) {latest = childLatest;}
    } else if (entry.isFile()) {
      const childMtime = statSync(childPath).mtimeMs;
      if (childMtime > latest) {latest = childMtime;}
    }
  }
  return latest;
}

export function evaluateGoLiveGates(env = process.env, rootDir = ROOT_DIR, options = {}) {
  const distIndex = resolve(rootDir, 'dist/index.html');
  const distAssets = resolve(rootDir, 'dist/assets');
  const rollbackScript = resolve(rootDir, 'scripts/deploy-rollback.sh');

  // Determine which deployment target(s) are selected/blocking for this evaluation.
  // Optional targets (required: false) do NOT become blocking just because their directory exists on disk.
  const explicitTargets =
    options.targetIds ??
    (typeof env.AURA_DEPLOY_TARGET === 'string' && env.AURA_DEPLOY_TARGET.trim().length > 0
      ? env.AURA_DEPLOY_TARGET.split(',').map((s) => s.trim()).filter(Boolean)
      : null);
  const selectedTargetIdSet = new Set(
    explicitTargets && explicitTargets.length > 0
      ? explicitTargets
      : DEPLOYMENT_MIGRATION_TARGETS.filter((t) => t.required).map((t) => t.id)
  );

  // Always inventory all present or selected migration directories, while separating blocking vs non-blocking targets
  const evaluatedMigrationTargets = DEPLOYMENT_MIGRATION_TARGETS.filter(
    (t) => selectedTargetIdSet.has(t.id) || existsSync(resolve(rootDir, t.directory))
  );
  const rollbackCoverageByTarget = evaluatedMigrationTargets.map((t) => {
    const dirPath = resolve(rootDir, t.directory);
    const present = existsSync(dirPath);
    const selected = selectedTargetIdSet.has(t.id);
    const blocking = selected;
    const lint = lintMigrationsDirectory(dirPath);
    const missingDownCount = Math.max(0, lint.forwardCount - lint.downCount);
    const safeReversibleCount = lint.safeReversibleCount ?? 0;
    const unsafeDownCount = lint.unsafeDownCount ?? 0;
    const reversibilityHazards = lint.reversibilityHazards ?? [];
    const fileCoverageComplete =
      lint.valid && lint.forwardCount > 0 && lint.downCount === lint.forwardCount;
    const safeReversibilityComplete =
      fileCoverageComplete && safeReversibleCount === lint.forwardCount && unsafeDownCount === 0;
    return {
      targetId: t.id,
      target: t.target,
      directory: t.directory,
      required: t.required,
      selected,
      blocking,
      activationStatus: t.activationStatus,
      present,
      valid: lint.valid,
      forwardCount: lint.forwardCount,
      downCount: lint.downCount,
      missingDownCount,
      safeReversibleCount,
      unsafeDownCount,
      unpairedForwardMigrations: lint.unpairedForwardMigrations ?? [],
      reversibilityHazards,
      errors: lint.errors,
      fileCoverageComplete,
      safeReversibilityComplete,
      complete: safeReversibilityComplete,
    };
  });

  const blockingTargets = rollbackCoverageByTarget.filter((t) => t.blocking);
  const nonBlockingTargets = rollbackCoverageByTarget.filter((t) => !t.blocking);

  const blockingForwardCount = blockingTargets.reduce((acc, t) => acc + t.forwardCount, 0);
  const blockingDownCount = blockingTargets.reduce((acc, t) => acc + t.downCount, 0);
  const blockingMissingDownCount = blockingTargets.reduce(
    (acc, t) => acc + t.missingDownCount,
    0
  );
  const blockingSafeReversibleCount = blockingTargets.reduce(
    (acc, t) => acc + t.safeReversibleCount,
    0
  );
  const blockingUnsafeDownCount = blockingTargets.reduce(
    (acc, t) => acc + t.unsafeDownCount,
    0
  );

  const totalForwardCount = rollbackCoverageByTarget.reduce((acc, t) => acc + t.forwardCount, 0);
  const totalDownCount = rollbackCoverageByTarget.reduce((acc, t) => acc + t.downCount, 0);
  const totalMissingDownCount = rollbackCoverageByTarget.reduce(
    (acc, t) => acc + t.missingDownCount,
    0
  );
  const totalSafeReversibleCount = rollbackCoverageByTarget.reduce(
    (acc, t) => acc + t.safeReversibleCount,
    0
  );
  const totalUnsafeDownCount = rollbackCoverageByTarget.reduce(
    (acc, t) => acc + t.unsafeDownCount,
    0
  );

  // Gate 1: Migration Lint Gate across evaluated directories (blocking targets must exist and have >0 forward migrations)
  const gate1Errors = rollbackCoverageByTarget.flatMap((t) =>
    t.errors.map((err) => `[${t.directory}] ${err}`)
  );
  const gate1Passed =
    blockingTargets.length > 0 &&
    blockingTargets.every((t) => t.valid && t.forwardCount > 0) &&
    nonBlockingTargets.every((t) => t.valid);
  const gate1Detail = gate1Passed
    ? rollbackCoverageByTarget.length === 1
      ? `${totalForwardCount} forward, ${totalDownCount} down migrations valid (${rollbackCoverageByTarget[0].directory})`
      : `${totalForwardCount} forward, ${totalDownCount} down migrations valid across ${rollbackCoverageByTarget.length} directories (${rollbackCoverageByTarget.map((t) => `${t.directory} [${t.blocking ? 'blocking' : `optional/${t.activationStatus}`}]: ${t.forwardCount} up/${t.downCount} down`).join('; ')})`
    : gate1Errors.join('; ') || 'No valid forward migrations found for selected target';

  // Gate 2: Production Bundle Build Gate (existence + freshness against all build inputs including public/)
  const hasDistIndex = existsSync(distIndex);
  const jsAssets = existsSync(distAssets)
    ? readdirSync(distAssets).filter((f) => f.endsWith('.js'))
    : [];
  const hasDistAssets = jsAssets.length > 0;

  let isBuildFresh = false;
  const staleInputs = [];
  if (hasDistIndex && hasDistAssets) {
    const distIndexMtimeMs = statSync(distIndex).mtimeMs;
    const newestAssetMtimeMs = Math.max(
      ...jsAssets.map((f) => statSync(resolve(distAssets, f)).mtimeMs)
    );
    const buildMtimeMs = Math.min(distIndexMtimeMs, newestAssetMtimeMs);
    let latestSourceMtimeMs = 0;
    for (const relInput of BUILD_INPUT_PATHS) {
      const inputMtimeMs = getLatestMtimeMs(resolve(rootDir, relInput));
      if (inputMtimeMs > latestSourceMtimeMs) {
        latestSourceMtimeMs = inputMtimeMs;
      }
      if (inputMtimeMs > buildMtimeMs) {
        staleInputs.push(relInput);
      }
    }
    isBuildFresh = latestSourceMtimeMs === 0 || staleInputs.length === 0;
  }
  const gate2Passed = hasDistIndex && hasDistAssets && isBuildFresh;
  const gate2Detail = !hasDistIndex || !hasDistAssets
    ? 'Missing dist/ build artifacts (run npm run build)'
    : !isBuildFresh
      ? `Stale dist/ build artifacts: build inputs (${staleInputs.join(', ')}) modified after last build (run npm run build)`
      : 'dist/index.html and JS bundle assets verified and fresh';

  // Gate 3: Rollback Verification Gate
  // Separates:
  //   (a) Static command detection in scripts/deploy-rollback.sh across Pages, Worker, and D1 (vs runtime verification)
  //   (b) .down.sql file presence coverage on selected target(s)
  //   (c) Safe content reversibility (.down.sql free of unmitigated DROP TABLE / DROP COLUMN data loss or unreversed ALTER TABLE ADD COLUMN)
  const rollbackCapabilities = inspectRollbackCapabilities(rollbackScript);
  const fileCoveragePassed =
    blockingTargets.length > 0 &&
    blockingForwardCount > 0 &&
    blockingTargets.every((t) => t.fileCoverageComplete && t.activationStatus !== 'unknown');
  const safeReversibilityPassed =
    fileCoveragePassed && blockingTargets.every((t) => t.safeReversibilityComplete);
  const migrationRollbackPassed = fileCoveragePassed && safeReversibilityPassed;

  const migrationRollbackCoverage = {
    selectedTargetIds: Array.from(selectedTargetIdSet),
    fileCoveragePassed,
    safeReversibilityPassed,
    passed: migrationRollbackPassed,
    blockingForwardCount,
    blockingDownCount,
    blockingMissingDownCount,
    blockingSafeReversibleCount,
    blockingUnsafeDownCount,
    totalForwardCount,
    totalDownCount,
    totalMissingDownCount,
    totalSafeReversibleCount,
    totalUnsafeDownCount,
  };

  const gate3Passed = rollbackCapabilities.allStaticCommandsPresent && migrationRollbackPassed;

  const blockingBreakdown = blockingTargets
    .map(
      (t) =>
        `${t.directory} [${t.targetId}, blocking/${t.activationStatus}]: ${t.downCount}/${t.forwardCount} .down.sql files (${t.safeReversibleCount}/${t.forwardCount} safely reversible, ${t.unsafeDownCount} with hazards, ${t.missingDownCount} missing)`
    )
    .join('; ');
  const nonBlockingBreakdown = nonBlockingTargets
    .map(
      (t) =>
        `${t.directory} [${t.targetId}, optional/${t.activationStatus}]: ${t.downCount}/${t.forwardCount} .down.sql files (${t.safeReversibleCount}/${t.forwardCount} safely reversible, ${t.missingDownCount} missing)`
    )
    .join('; ');
  const capabilitySummary = `pages=${rollbackCapabilities.pages}, worker=${rollbackCapabilities.worker}, d1=${rollbackCapabilities.d1}`;
  const evidenceBadge = `evidence=${rollbackCapabilities.evidenceLevel}, runtimeVerified=${rollbackCapabilities.runtimeVerified}`;

  const gate3FailureReasons = [];
  if (!rollbackCapabilities.scriptExists) {
    gate3FailureReasons.push(
      `Missing rollback script (scripts/deploy-rollback.sh) [${evidenceBadge}; ${capabilitySummary}]`
    );
  } else if (!rollbackCapabilities.allStaticCommandsPresent) {
    const unreferencedLayers = ['pages', 'worker', 'd1'].filter(
      (layer) => rollbackCapabilities[layer] !== 'static_command_detected'
    );
    gate3FailureReasons.push(
      `Incomplete static rollback script coverage (${unreferencedLayers.join(', ')} rollback command unreferenced in scripts/deploy-rollback.sh; ${evidenceBadge}; ${capabilitySummary})`
    );
  } else {
    gate3FailureReasons.push(
      `Static rollback commands detected (${capabilitySummary}; ${evidenceBadge})`
    );
  }

  if (blockingForwardCount === 0) {
    gate3FailureReasons.push('No forward migrations found for selected deployment target');
  } else {
    const unknownBlocking = blockingTargets.filter((t) => t.activationStatus === 'unknown');
    if (unknownBlocking.length > 0) {
      gate3FailureReasons.push(
        `Selected target activation status is Unknown (${unknownBlocking.map((t) => t.directory).join(', ')})`
      );
    }
    if (blockingMissingDownCount > 0 || blockingUnsafeDownCount > 0) {
      const hazardSummary = blockingTargets
        .flatMap((t) =>
          t.reversibilityHazards.map((h) => `${h.downFile} [${h.hazards.join(', ')}]`)
        )
        .join(', ');
      gate3FailureReasons.push(
        `Incomplete migration rollback readiness on selected target(s): ${blockingDownCount}/${blockingForwardCount} .down.sql files present (${blockingMissingDownCount} missing), ${blockingSafeReversibleCount}/${blockingForwardCount} safely reversible without data-loss/schema-drift hazards (${blockingUnsafeDownCount} existing .down.sql flagged${hazardSummary ? `: ${hazardSummary}` : ''}) — ${blockingBreakdown}`
      );
    } else {
      gate3FailureReasons.push(
        `Safe reversible migration files ready on selected target(s): ${blockingSafeReversibleCount}/${blockingForwardCount} safely reversible (${blockingBreakdown})`
      );
    }
  }

  if (nonBlockingBreakdown) {
    gate3FailureReasons.push(`non-blocking directory inventory: ${nonBlockingBreakdown}`);
  }

  const gate3Detail = gate3Passed
    ? `Static rollback preflight passed (${evidenceBadge}: ${capabilitySummary}; runtime rollback execution not verified by static gate) + safe reversible .down.sql coverage complete on selected target(s) (${blockingSafeReversibleCount}/${blockingForwardCount} safe, ${blockingDownCount}/${blockingForwardCount} files: ${blockingBreakdown})${nonBlockingBreakdown ? ` | non-blocking inventory: ${nonBlockingBreakdown}` : ''}`
    : gate3FailureReasons.join(' | ');

  // Gate 4: Staging Credentials Inventory
  const presentCredentials = [];
  const missingCredentials = [];
  for (const key of REQUIRED_STAGING_CREDENTIALS) {
    const val = env[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      presentCredentials.push(key);
    } else {
      missingCredentials.push(key);
    }
  }
  const stagingCredsReady = missingCredentials.length === 0;

  const localGatesPassed = gate1Passed && gate2Passed && gate3Passed;

  return {
    localGatesPassed,
    stagingCredsReady,
    gates: [
      {
        id: 'GATE_1_MIGRATION_LINT',
        passed: gate1Passed,
        detail: gate1Detail,
      },
      {
        id: 'GATE_2_BUNDLE_BUILD',
        passed: gate2Passed,
        detail: gate2Detail,
      },
      {
        id: 'GATE_3_ROLLBACK_READINESS',
        passed: gate3Passed,
        detail: gate3Detail,
      },
      {
        id: 'GATE_4_STAGING_CREDENTIALS',
        passed: stagingCredsReady,
        detail: stagingCredsReady
          ? `All ${REQUIRED_STAGING_CREDENTIALS.length} staging credentials present`
          : `Missing ${missingCredentials.length}/${REQUIRED_STAGING_CREDENTIALS.length}: ${missingCredentials.join(', ')}`,
      },
    ],
    missingCredentials,
    presentCredentials,
    rollbackCapabilities,
    migrationRollbackCoverage,
    rollbackCoverageByTarget,
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const requireStaging = process.argv.includes('--require-staging');
  const targetArg = process.argv.find((arg) => arg.startsWith('--target='));
  const targetIds = targetArg
    ? targetArg
        .slice('--target='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;
  const report = evaluateGoLiveGates(process.env, ROOT_DIR, { targetIds });

  console.log('=== AURA OS Pre-Release & Staging Gate Verification ===');
  for (const g of report.gates) {
    const badge = g.passed ? 'PASS' : g.id === 'GATE_4_STAGING_CREDENTIALS' && !requireStaging ? 'PENDING' : 'FAIL';
    console.log(`[${badge}] ${g.id}: ${g.detail}`);
  }

  if (!report.localGatesPassed) {
    console.error('RESULT: LOCAL_GATES_FAILED');
    process.exit(1);
  }

  if (!report.stagingCredsReady) {
    console.log('RESULT: LOCAL_GATES_PASSED | STAGING_RUNTIME: PENDING_CREDENTIALS');
    if (requireStaging) {
      process.exit(1);
    }
    process.exit(0);
  }

  console.log('RESULT: ALL_PREFLIGHT_GATES_PASSED (Ready for 4-stage live staging smoke run)');
}
