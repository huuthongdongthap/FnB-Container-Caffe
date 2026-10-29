-- Authentication identity resolution joins staff_login_identities on email, and
-- staff/auth handlers query users by email, but live users carries no email
-- column. Add it nullable and indexed without backfilling KV-held PII into D1.
ALTER TABLE users ADD COLUMN email TEXT;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
