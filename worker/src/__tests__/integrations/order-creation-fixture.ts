import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMockEnv } from '../test-utils';

/** Executes the real bootstrap DDL and SQL, rather than pattern-matching security predicates. */
export function orderCreationFixture() {
  const sqlite = new DatabaseSync(':memory:');
  // Resolved from this file, not the process cwd: the suite already runs with
  // the worker directory as cwd, so a cwd-relative path doubled the segment and
  // looked for a schema under a directory that does not exist.
  const here = dirname(fileURLToPath(import.meta.url));
  sqlite.exec(readFileSync(resolve(here, '../../../schema.sql'), 'utf8'));
  sqlite.exec(`INSERT INTO categories (id,name,slug) VALUES ('coffee','Coffee','coffee');
    INSERT INTO products (id,category_id,name,price) VALUES ('coffee','coffee','Coffee',20000);
    INSERT INTO cafe_tables (id,table_number,capacity,zone,tenant_id) VALUES
      ('table-default','D1',4,'A','default'), ('table-a','A1',4,'A','cafe-a'), ('table-b','B1',4,'B','cafe-b');`);
  const db = {
    prepare(sql: string) {
      let binds: (string | number | null)[] = [];
      const statement = {
        bind(...values: (string | number | null | undefined)[]) { binds = values.map(v => v ?? null); return statement; },
        async first() { return sqlite.prepare(sql).get(...binds) || null; },
        async all() { return { results: sqlite.prepare(sql).all(...binds), success: true }; },
        async run() {
          const before = Number(sqlite.prepare('SELECT total_changes() changes').get()?.changes);
          const result = sqlite.prepare(sql).run(...binds);
          // D1 counts writes from triggers too; SQLite statement.changes alone does not.
          const changes = Number(sqlite.prepare('SELECT total_changes() changes').get()?.changes) - before;
          return { success: true, changes: Number(result.changes), meta: { changes } };
        },
      };
      return statement;
    },
    async batch(statements: { run(): Promise<unknown> }[]) {
      sqlite.exec('BEGIN');
      try { const results = await Promise.all(statements.map(s => s.run())); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  return { sqlite, env: createMockEnv({ AURA_DB: db }) as any };
}
