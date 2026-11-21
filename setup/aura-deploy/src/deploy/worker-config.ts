import { statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

type Fields = Map<string, string>;

// Read the flat fields and tables emitted by the generator. Reject unsupported
// syntax instead of silently ignoring fields that might change Wrangler's target.
function readGeneratedTables(config: string): Map<string, Fields[]> {
  const top = new Map<string, string>();
  const tables = new Map<string, Fields[]>([['', [top]]]);
  const arrayTables = new Set(['d1_databases', 'kv_namespaces', 'durable_objects.bindings', 'migrations']);
  let fields = top;
  for (const line of config.split(/\r?\n/)) {
    if (/^\s*(?:#.*)?$/.test(line)) continue;
    const table = line.match(/^\s*(?:\[\[([\w.]+)\]\]|\[([\w.]+)\])\s*(?:#.*)?$/);
    if (table) {
      const key = table[1] ?? table[2];
      if ((arrayTables.has(key) && !table[1]) || (['triggers', 'vars'].includes(key) && table[1])) {
        throw new Error(`Invalid Worker table type for ${key}`);
      }
      const rows = tables.get(key) ?? [];
      if (rows.length && !table[1]) throw new Error(`Duplicate Worker table [${key}]`);
      fields = new Map();
      tables.set(key, [...rows, fields]);
      continue;
    }
    const field = line.match(/^\s*([\w-]+)\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*'|\[(?:[^\]"']|"(?:[^"\\]|\\.)*"|'[^']*')*\]|[\w.+-]+)\s*(?:#.*)?$/);
    if (!field) throw new Error('Unsupported syntax in generated Worker config; use the generated template format');
    const [, key, value] = field;
    if (fields.has(key)) throw new Error(`Duplicate Worker field ${key}`);
    fields.set(key, value);
  }
  return tables;
}

function stringValue(raw?: string): string | undefined {
  if (raw?.startsWith('"')) return JSON.parse(raw) as string;
  if (raw?.startsWith("'")) return raw.slice(1, -1);
  return undefined;
}

function containsString(raw: string | undefined, expected: string): boolean {
  if (!raw?.startsWith('[')) return false;
  const items = raw.slice(1, -1).trim();
  const strings = /^\s*("(?:[^"\\]|\\.)*"|'[^']*')\s*(,|$)/;
  let remaining = items;
  let found = false;
  while (remaining.trim()) {
    const match = remaining.match(strings);
    if (!match) return false;
    found ||= stringValue(match[1]) === expected;
    remaining = remaining.slice(match[0].length);
  }
  return found;
}

export function validateWorkerConfig(config: string, configPath: string, workerDir: string, workerName: string): void {
  const tables = readGeneratedTables(config);
  const top = tables.get('')?.[0];
  if (stringValue(top?.get('name')) !== workerName) throw new Error(`Expected top-level Worker name "${workerName}"`);
  if (top?.has('pages_build_output_dir')) throw new Error('Remove pages_build_output_dir from the Worker config');

  const main = stringValue(top?.get('main'));
  const expectedEntry = resolve(workerDir, 'src/index.ts');
  const entry = main && resolve(dirname(configPath), main);
  if (!entry || entry !== expectedEntry || !statSync(entry, { throwIfNoEntry: false })?.isFile()) {
    throw new Error('Worker main must point to the existing worker/src/index.ts relative to the generated config');
  }

  if (!containsString(tables.get('triggers')?.[0].get('crons'), '*/5 * * * *')) {
    throw new Error('Missing required five-minute Worker cron');
  }
  const broadcaster = tables.get('durable_objects.bindings')?.filter((row) => stringValue(row.get('name')) === 'ORDER_BROADCASTER');
  if (broadcaster?.length !== 1 || stringValue(broadcaster[0].get('class_name')) !== 'OrderBroadcaster' || broadcaster[0].has('script_name') || broadcaster[0].has('environment')) {
    throw new Error('ORDER_BROADCASTER must bind to the local OrderBroadcaster class');
  }
  if (!tables.get('migrations')?.some((row) => stringValue(row.get('tag')) === 'v1' && containsString(row.get('new_sqlite_classes'), 'OrderBroadcaster'))) {
    throw new Error('Missing v1 SQLite migration for OrderBroadcaster');
  }

  const database = tables.get('d1_databases')?.filter((row) => stringValue(row.get('binding')) === 'AURA_DB');
  if (database?.length !== 1 || !stringValue(database[0].get('database_name'))?.trim() || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(stringValue(database[0].get('database_id')) ?? '')) {
    throw new Error('Provision the client D1 database and set AURA_DB database_name and database_id in the generated config');
  }
  const kv = tables.get('kv_namespaces')?.filter((row) => stringValue(row.get('binding')) === 'AUTH_KV');
  if (kv?.length !== 1 || !/^[\da-f]{32}$/i.test(stringValue(kv[0].get('id')) ?? '')) {
    throw new Error('Provision the client KV namespace and set AUTH_KV id in the generated config');
  }
}
