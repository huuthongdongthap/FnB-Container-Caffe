import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Loads the real SOP migrations into the in-memory sqlite test DB.
 *
 * The migration files are the source of truth: duplicating the DDL in the test
 * would let the test pass against a table shape the production D1 never got.
 * Statements are split on `;` at end-of-line and comment lines stripped, which
 * is safe here because no string literal in these files contains a semicolon.
 */

/** In declared order, so a later migration may depend on an earlier table. */
const MIGRATION_PATHS = [
  '../../../db/migrations/20261024_01_sop_checklists.sql',
  '../../../db/migrations/20261025_01_sop_violation_sanction_note.sql',
  '../../../db/migrations/20261027_01_sop_reminders.sql',
].map((relative) => fileURLToPath(new URL(relative, import.meta.url)));

const statements = MIGRATION_PATHS.flatMap((path) =>
  readFileSync(path, 'utf8')
    .split(/;\s*\n/)
    .map((block) => block
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .trim())
    .filter((block) => block.length > 0)
);

/** Minimal surface the migration exec needs from the sqlite handle. */
interface ExecableSqlite {
  exec(sql: string): void;
}

export function applySopMigrations(sqlite: ExecableSqlite): void {
  for (const statement of statements) {
    sqlite.exec(statement);
  }
}
