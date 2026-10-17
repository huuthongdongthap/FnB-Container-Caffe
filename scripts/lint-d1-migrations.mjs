#!/usr/bin/env node
/**
 * Static Migration Linter for Cloudflare D1 SQL Migrations.
 * Enforces monotonic timestamp ordering, naming conventions, and idempotency guards.
 *
 * Usage: node scripts/lint-d1-migrations.mjs [migrations-dir]
 * Exit 0 = all valid, Exit 1 = validation errors found.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const defaultDir = resolve(ROOT_DIR, 'worker/db/migrations');

export const ACTIVE_MIGRATION_DIRECTORIES = [
  {
    name: 'worker/db/migrations',
    role: 'Canonical Worker D1 migrations (deploy-cloudflare.sh, worker/scripts/apply-migrations.sh)',
    pattern: /^(\d{8})_(\d{2})_([a-z0-9_]+?)(\.down)?\.sql$/,
    expectedFormat: 'YYYYMMDD_NN_slug.sql',
  },
  {
    name: 'db/migrations',
    role: 'Root D1 migrations referenced in operator docs (docs/deployment-guide.md, docs/deployment.md)',
    pattern: /^(\d{8})_(\d{2})_([a-z0-9_]+?)(\.down)?\.sql$/,
    expectedFormat: 'YYYYMMDD_NN_slug.sql',
  },
  {
    name: 'scripts/migrations',
    role: 'Branded deployment D1 migrations (scripts/deploy-branded.sh)',
    pattern: /^(\d{3})()-([a-z0-9_-]+?)(\.down)?\.sql$/,
    expectedFormat: 'NNN-slug.sql',
  },
  {
    name: 'worker/migrations',
    role: 'Legacy numbered Worker bootstrap migrations (worker/db/migrations/README.md, docs/runbook-d1-backup-restore.md)',
    pattern: /^(\d{3})()_([a-z0-9_]+?)(\.down)?\.sql$/,
    expectedFormat: 'NNN_slug.sql',
  },
];

const DEFAULT_MIGRATION_PATTERN = /^(\d{8})_(\d{2})_([a-z0-9_]+?)(\.down)?\.sql$/;

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/--.*$/, '').trim())
    .filter(Boolean)
    .join('\n');
}

function normalizeIdentifier(raw) {
  return String(raw || '')
    .replace(/^["'`[]+|["'`\]]+$/g, '')
    .toLowerCase();
}

function isTempGuardTable(tableName) {
  return tableName.startsWith('_skip_');
}

export function inspectMigrationReversibility(forwardSql, downSql) {
  const cleanForward = stripSqlComments(forwardSql);
  const cleanDown = stripSqlComments(downSql);
  const hazards = new Set();

  if (!cleanDown) {
    hazards.add('empty_down_sql');
  }

  const downLines = cleanDown.split('\n');
  for (const line of downLines) {
    if (
      /CREATE\s+TABLE\b/i.test(line) &&
      !/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/i.test(line)
    ) {
      hazards.add('unsafe_down_ddl_missing_if_exists');
    }
    if (
      /CREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(line) &&
      !/CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\b/i.test(line)
    ) {
      hazards.add('unsafe_down_ddl_missing_if_exists');
    }
    if (/DROP\s+TABLE\b/i.test(line) && !/DROP\s+TABLE\s+IF\s+EXISTS\b/i.test(line)) {
      hazards.add('unsafe_down_ddl_missing_if_exists');
    }
    if (/DROP\s+INDEX\b/i.test(line) && !/DROP\s+INDEX\s+IF\s+EXISTS\b/i.test(line)) {
      hazards.add('unsafe_down_ddl_missing_if_exists');
    }
  }

  const forwardCreatedTables = [];
  for (const m of cleanForward.matchAll(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(["'`[]?[a-zA-Z0-9_]+["'`\]]?)/gi
  )) {
    const tbl = normalizeIdentifier(m[1]);
    if (!isTempGuardTable(tbl)) forwardCreatedTables.push(tbl);
  }

  const forwardDroppedTables = [];
  for (const m of cleanForward.matchAll(
    /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(["'`[]?[a-zA-Z0-9_]+["'`\]]?)/gi
  )) {
    const tbl = normalizeIdentifier(m[1]);
    if (!isTempGuardTable(tbl)) forwardDroppedTables.push(tbl);
  }

  const forwardAddedColumns = [];
  for (const m of cleanForward.matchAll(
    /ALTER\s+TABLE\s+(["'`[]?[a-zA-Z0-9_]+["'`\]]?)\s+ADD\s+(?:COLUMN\s+)?(["'`[]?[a-zA-Z0-9_]+["'`\]]?)/gi
  )) {
    forwardAddedColumns.push({
      table: normalizeIdentifier(m[1]),
      column: normalizeIdentifier(m[2]),
    });
  }

  const forwardCreatedIndexes = [];
  for (const m of cleanForward.matchAll(
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(["'`[]?[a-zA-Z0-9_]+["'`\]]?)\s+ON\s+(["'`[]?[a-zA-Z0-9_]+["'`\]]?)/gi
  )) {
    forwardCreatedIndexes.push({
      index: normalizeIdentifier(m[1]),
      table: normalizeIdentifier(m[2]),
    });
  }

  const downDroppedTables = [];
  for (const m of cleanDown.matchAll(
    /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(["'`[]?[a-zA-Z0-9_]+["'`\]]?)/gi
  )) {
    const tbl = normalizeIdentifier(m[1]);
    if (!isTempGuardTable(tbl)) downDroppedTables.push(tbl);
  }

  const downDroppedColumns = [];
  for (const m of cleanDown.matchAll(
    /ALTER\s+TABLE\s+(["'`[]?[a-zA-Z0-9_]+["'`\]]?)\s+DROP\s+(?:COLUMN\s+)?(["'`[]?[a-zA-Z0-9_]+["'`\]]?)/gi
  )) {
    downDroppedColumns.push({
      table: normalizeIdentifier(m[1]),
      column: normalizeIdentifier(m[2]),
    });
  }

  const downDroppedIndexes = [];
  for (const m of cleanDown.matchAll(
    /DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?(["'`[]?[a-zA-Z0-9_]+["'`\]]?)/gi
  )) {
    downDroppedIndexes.push(normalizeIdentifier(m[1]));
  }

  for (const m of cleanDown.matchAll(
    /DELETE\s+FROM\s+(["'`[]?[a-zA-Z0-9_]+["'`\]]?)/gi
  )) {
    const tbl = normalizeIdentifier(m[1]);
    if (!isTempGuardTable(tbl)) hazards.add('down_deletes_or_truncates_data');
  }
  if (/\bTRUNCATE\b/i.test(cleanDown)) {
    hazards.add('down_deletes_or_truncates_data');
  }

  if (forwardDroppedTables.length > 0) {
    hazards.add('forward_drops_table_unrecoverable_data');
  }
  if (downDroppedTables.length > 0) {
    hazards.add('down_drops_table_data_loss_risk');
  }
  if (downDroppedColumns.length > 0) {
    hazards.add('down_drops_column_data_loss_risk');
  }

  for (const tbl of forwardCreatedTables) {
    if (!downDroppedTables.includes(tbl)) {
      hazards.add('incomplete_down_missing_table_reversal');
    }
  }

  for (const { table, column } of forwardAddedColumns) {
    const columnReversed = downDroppedColumns.some(
      (c) => c.table === table && c.column === column
    );
    if (!columnReversed && !downDroppedTables.includes(table)) {
      hazards.add('incomplete_down_missing_column_reversal');
    }
  }

  for (const { index, table } of forwardCreatedIndexes) {
    if (!downDroppedIndexes.includes(index) && !downDroppedTables.includes(table)) {
      hazards.add('incomplete_down_missing_index_reversal');
    }
  }

  const hazardList = Array.from(hazards);
  return {
    safeReversible: hazardList.length === 0,
    hazards: hazardList,
  };
}

function resolvePatternForDirectory(migrationsDir, customPattern) {
  if (customPattern) {
    return { pattern: customPattern, expectedFormat: 'YYYYMMDD_NN_slug.sql' };
  }
  const normalized = migrationsDir.replace(/\\/g, '/');
  for (const entry of ACTIVE_MIGRATION_DIRECTORIES) {
    if (normalized.endsWith(entry.name)) {
      return { pattern: entry.pattern, expectedFormat: entry.expectedFormat };
    }
  }
  return { pattern: DEFAULT_MIGRATION_PATTERN, expectedFormat: 'YYYYMMDD_NN_slug.sql' };
}

export function lintMigrationsDirectory(migrationsDir, options = {}) {
  if (!existsSync(migrationsDir)) {
    return {
      valid: false,
      forwardCount: 0,
      downCount: 0,
      missingDownCount: 0,
      safeReversibleCount: 0,
      unsafeDownCount: 0,
      unpairedForwardMigrations: [],
      reversibilityHazards: [],
      errors: [`Migrations directory does not exist: ${migrationsDir}`],
    };
  }

  const { pattern, expectedFormat } = resolvePatternForDirectory(migrationsDir, options.pattern);
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const errors = [];
  const unpairedForwardMigrations = [];
  const reversibilityHazards = [];
  let lastVersion = '';
  let forwardCount = 0;
  let downCount = 0;
  let safeReversibleCount = 0;
  let unsafeDownCount = 0;

  for (const file of files) {
    const match = file.match(pattern);
    if (!match) {
      errors.push(
        `Invalid migration filename convention: "${file}". Expected ${expectedFormat}`
      );
      continue;
    }

    const [, dateOrNum, seq, slug, isDown] = match;
    const version = seq ? `${dateOrNum}_${seq}` : dateOrNum;
    const separator = file.includes('-') && !seq ? '-' : '_';
    const basePrefix = seq ? `${dateOrNum}_${seq}_${slug}` : `${dateOrNum}${separator}${slug}`;

    if (isDown) {
      downCount++;
      const companion = `${basePrefix}.sql`;
      if (!files.includes(companion)) {
        errors.push(`Orphan down-migration "${file}" missing forward migration "${companion}"`);
      }
      continue;
    }

    forwardCount++;
    const fullPath = resolve(migrationsDir, file);
    const content = readFileSync(fullPath, 'utf8');
    const companionDown = `${basePrefix}.down.sql`;
    if (!files.includes(companionDown)) {
      unpairedForwardMigrations.push(file);
    } else {
      const downContent = readFileSync(resolve(migrationsDir, companionDown), 'utf8');
      const rev = inspectMigrationReversibility(content, downContent);
      if (rev.safeReversible) {
        safeReversibleCount++;
      } else {
        unsafeDownCount++;
        reversibilityHazards.push({
          forwardFile: file,
          downFile: companionDown,
          hazards: rev.hazards,
        });
      }
    }

    if (lastVersion && version < lastVersion) {
      errors.push(
        `Migration out of chronological order: ${file} (version ${version} < ${lastVersion})`
      );
    }
    lastVersion = version;

    const lines = content.split('\n');
    let hasExecutableSql = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('--')) continue;
      hasExecutableSql = true;

      if (
        /CREATE\s+TABLE/i.test(line) &&
        !/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/i.test(line)
      ) {
        errors.push(
          `${file}:${i + 1}: CREATE TABLE statement missing IF NOT EXISTS guard`
        );
      }

      if (
        /CREATE\s+(?:UNIQUE\s+)?INDEX/i.test(line) &&
        !/CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS/i.test(line)
      ) {
        errors.push(
          `${file}:${i + 1}: CREATE INDEX statement missing IF NOT EXISTS guard`
        );
      }

      if (/DROP\s+TABLE/i.test(line) && !/DROP\s+TABLE\s+IF\s+EXISTS/i.test(line)) {
        errors.push(`${file}:${i + 1}: Unsafe DROP TABLE without IF EXISTS guard`);
      }

      if (/^\s*TRUNCATE\b/i.test(line)) {
        errors.push(`${file}:${i + 1}: Destructive TRUNCATE statement is prohibited`);
      }
    }

    if (!hasExecutableSql) {
      errors.push(`${file}: Migration file contains no executable SQL statements`);
    }
  }

  return {
    valid: errors.length === 0,
    forwardCount,
    downCount,
    missingDownCount: unpairedForwardMigrations.length,
    safeReversibleCount,
    unsafeDownCount,
    unpairedForwardMigrations,
    reversibilityHazards,
    errors,
  };
}

export function lintAllMigrationDirectories(rootDir = ROOT_DIR) {
  const directories = [];
  const errors = [];
  let totalForwardCount = 0;
  let totalDownCount = 0;

  for (const entry of ACTIVE_MIGRATION_DIRECTORIES) {
    const dirPath = resolve(rootDir, entry.name);
    const result = lintMigrationsDirectory(dirPath, { pattern: entry.pattern });
    totalForwardCount += result.forwardCount;
    totalDownCount += result.downCount;
    directories.push({
      name: entry.name,
      role: entry.role,
      ...result,
    });
    for (const err of result.errors) {
      errors.push(`[${entry.name}] ${err}`);
    }
  }

  return {
    valid: errors.length === 0,
    totalForwardCount,
    totalDownCount,
    directories,
    errors,
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv[2]) {
    const targetDir = resolve(process.cwd(), process.argv[2]);
    const result = lintMigrationsDirectory(targetDir);
    if (!result.valid) {
      console.error(`D1 migration lint failed (${result.errors.length} error(s)):`);
      for (const err of result.errors) {
        console.error(`  - ${err}`);
      }
      process.exit(1);
    }
    console.log(
      `D1 migration lint passed: ${result.forwardCount} forward, ${result.downCount} down migrations verified.`
    );
  } else {
    const multiResult = lintAllMigrationDirectories(ROOT_DIR);
    if (!multiResult.valid) {
      console.error(`D1 migration lint failed (${multiResult.errors.length} error(s)):`);
      for (const err of multiResult.errors) {
        console.error(`  - ${err}`);
      }
      process.exit(1);
    }
    for (const dir of multiResult.directories) {
      console.log(
        `  [OK] ${dir.name}: ${dir.forwardCount} forward, ${dir.downCount} down (${dir.missingDownCount} without .down.sql)`
      );
    }
    console.log(
      `D1 migration lint passed across ${multiResult.directories.length} directories: ${multiResult.totalForwardCount} forward, ${multiResult.totalDownCount} down migrations verified.`
    );
  }
}
