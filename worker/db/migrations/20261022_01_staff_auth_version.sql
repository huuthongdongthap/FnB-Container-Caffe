-- Staff session invalidation counter.
--
-- A signed JWT keeps verifying until it expires, so disabling an account or
-- rotating its role left already-issued tokens usable for the rest of their
-- lifetime. Bumping this column invalidates every token minted before the
-- bump: the claim carries the value it was signed with, so a mismatch is a
-- revoked session without needing a token blacklist to be consistent.
--
-- Existing rows default to 1 rather than requiring a backfill — a token issued
-- before this column existed carries no version claim and is treated as
-- already superseded (see worker/src/lib/staff-session.ts), so the default
-- only describes the current state of the account, not the token history.
--
-- Additive and idempotent: D1 has no ADD COLUMN IF EXISTS, so the guard relies
-- on the apply runner's explicit-file contract rather than re-running this file
-- against a database that already has the column.
ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_users_auth_version ON users(auth_version);
