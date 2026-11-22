import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const approved = new Map([
  ['20261115_01_tenant_unique_constraints_and_indexes.sql', 'd516b03f7f9bee8717839ac8ac5bbb1d95f925fdad5d6dcfb54a81980c70e244'],
  ['20261118_01_orders_loyalty_points_redeemed.sql', '88c78d8c1b33b5d3b1e141b4365c34ea4ea915ffd10f92c27a6aa7a1105e0244'],
]);

function requireMatch(condition, message) {
  if (!condition) throw new Error(message);
}

function load(file) {
  const name = basename(file);
  requireMatch(approved.has(name), `Unsupported migration for --resume-existing: ${name}`);
  const bytes = readFileSync(file);
  requireMatch(createHash('sha256').update(bytes).digest('hex') === approved.get(name),
    `Unapproved SQL checksum: ${name}`);
  const source = bytes.toString('utf8');
  // Only the pinned files reach this matcher; their DDL starts at the beginning of a line.
  const statements = [...source.matchAll(/^(?:CREATE|ALTER) [^;]+;/gm)].map(match => {
    const sql = match[0];
    const create = /^(CREATE) (TABLE|(?:UNIQUE )?INDEX) IF NOT EXISTS (\w+)(?: ON (\w+))?/.exec(sql);
    if (create) return { sql, type: create[2].endsWith('INDEX') ? 'index' : 'table', name: create[3], table: create[4] };
    const add = /^ALTER TABLE (\w+) ADD COLUMN ((\w+) .+);$/.exec(sql);
    requireMatch(add, `Unrecognized approved DDL: ${sql}`);
    return { sql, type: 'column', table: add[1], name: add[3], declaration: add[2] };
  });
  const createdTables = new Set(statements.filter(s => s.type === 'table').map(s => s.name));
  const bases = [...new Set(statements.map(s => s.table).filter(t => t && !createdTables.has(t)))];
  const names = [...bases, ...statements.filter(s => s.type !== 'column').map(s => s.name)];
  return { source, statements, bases, names };
}

function query(names) {
  // One row for every requested name, including absent objects, so a truncated result cannot look like missing DDL.
  return `WITH requested(target) AS (VALUES ${names.map(name => `('${name}')`).join(', ')})
SELECT target, s.type, s.name, s.tbl_name, s.sql FROM requested
LEFT JOIN main.sqlite_schema s ON s.name = target COLLATE NOCASE AND s.type <> 'trigger'`;
}

function readSnapshot(file, names) {
  const response = JSON.parse(readFileSync(file, 'utf8'));
  requireMatch(Array.isArray(response) && response.length === 1 && response[0]?.success === true &&
    !response[0].error && Array.isArray(response[0].results), 'Unsuccessful or malformed D1 schema response');
  const rows = response[0].results;
  const objects = new Map();
  for (const row of rows) {
    requireMatch(row && names.includes(row.target) && !objects.has(row.target), 'Unexpected or duplicate D1 schema row');
    const absent = row.type === null && row.name === null && row.tbl_name === null && row.sql === null;
    requireMatch(absent || (['table', 'view', 'index'].includes(row.type) &&
      typeof row.name === 'string' && row.name.toLowerCase() === row.target &&
      typeof row.tbl_name === 'string' && typeof row.sql === 'string' && row.sql.length > 0),
    `Incomplete D1 schema row: ${row.target}`);
    objects.set(row.target, absent ? null : row);
  }
  requireMatch(objects.size === names.length, 'Incomplete D1 schema response: missing requested rows');
  return objects;
}

// Compare DDL tokens conservatively. Never normalize bytes inside quoted literals or identifiers.
function tokens(sql) {
  return (sql.match(/\s+|--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|[\w\u0080-\uffff]+|<>|!=|==|<=|>=|\|\||[^\s]/g) ?? [])
    .filter(token => !/^\s|^--|^\/\*/.test(token))
    .map(token => /^\w/.test(token) ? token.toLowerCase() : token);
}

function sameTokens(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

// SQLite supplies the CREATE TABLE text. Walk its top-level terms only; nested expressions
// and quoted commas are not delimiters. The leading token is the declared column name.
function columnTerm(ddl, name) {
  const terms = tokens(ddl);
  let depth = 1;
  let start = terms.indexOf('(') + 1;
  for (let i = start; i < terms.length; i++) {
    if (terms[i] === '(') depth++;
    if (terms[i] === ')') depth--;
    if (depth === 0 || (depth === 1 && terms[i] === ',')) {
      if (terms[start]?.replace(/^["'`\[]|["'`\]]$/g, '').toLowerCase() === name) {
        return [name, ...terms.slice(start + 1, i)];
      }
      start = i + 1;
    }
    if (depth === 0) break;
  }
}

function prepare(migration, snapshot, destination) {
  const { source, statements, bases, names } = migration;
  const objects = readSnapshot(snapshot, names);
  const local = new DatabaseSync(':memory:');
  const completed = new Set();
  const storedSql = local.prepare('SELECT sql FROM main.sqlite_schema WHERE name = ?');
  try {
    for (const table of bases) {
      const row = objects.get(table);
      requireMatch(row?.type === 'table' && row.tbl_name === row.name,
        `Missing or incompatible base table: ${table}`);
      const ddl = tokens(row.sql);
      requireMatch(ddl[0] === 'create' && ddl[1] === 'table' && !ddl.includes(';'),
        `Unsupported base table definition: ${table}`);
      local.prepare(row.sql).run();
      requireMatch(storedSql.get(row.name), `Invalid base table definition: ${table}`);
    }
    for (const statement of statements) {
      const { sql, type, name, table, declaration } = statement;
      if (type === 'column') {
        const exists = local.prepare('SELECT name FROM pragma_table_xinfo(?) WHERE name = ? COLLATE NOCASE').get(table, name);
        if (!exists) {
          local.exec(sql);
          continue;
        }
        const label = `${table}.${name}`;
        const ddl = storedSql.get(table)?.sql;
        requireMatch(ddl && sameTokens(columnTerm(ddl, name), tokens(declaration)), `Schema drift: column ${label}`);
        // SQLite refuses DROP COLUMN if a table-level constraint or generated column depends on it.
        // This probe runs only in memory and is rolled back even on failure.
        local.exec('SAVEPOINT verify_column');
        try {
          local.exec(`ALTER TABLE ${table} DROP COLUMN ${name}`);
        } catch (error) {
          throw new Error(`Schema drift: column ${label}: ${error.message}`);
        } finally {
          local.exec('ROLLBACK TO verify_column; RELEASE verify_column');
        }
      } else {
        local.exec(sql);
        const actual = objects.get(name);
        if (!actual) continue;
        const expected = storedSql.get(name)?.sql;
        requireMatch(actual.type === type && actual.tbl_name.toLowerCase() === (table ?? name) &&
          expected && sameTokens(tokens(actual.sql), tokens(expected)), `Schema drift: ${type} ${name}`);
      }
      completed.add(sql);
    }
    const residual = completed.size === statements.length ? '' :
      source.replace(/^(?:CREATE|ALTER) [^;]+;/gm, sql => completed.has(sql) ? '' : sql);
    writeFileSync(destination, residual, { mode: 0o600, flag: 'wx' });
  } finally {
    local.close();
  }
}

try {
  const [action, ...args] = process.argv.slice(2);
  if (action === '--check') args.forEach(load);
  else if (action === '--query') console.log(query(load(args[0]).names));
  else if (action === '--prepare') prepare(load(args[0]), args[1], args[2]);
  else throw new Error('Expected --check, --query, or --prepare');
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
