-- Staff password changes and session invalidation must commit in one D1 update.
-- Existing KV credentials are imported only after a successful password login.
ALTER TABLE users ADD COLUMN password_hash TEXT;
CREATE TABLE IF NOT EXISTS staff_login_identities (
  email TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL UNIQUE REFERENCES users(id)
);
