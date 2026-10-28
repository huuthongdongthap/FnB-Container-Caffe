-- Destructive for migrated Staff credentials; restore only with an approved
-- credential recovery plan. Local presence does not prove safe reversibility.
ALTER TABLE users DROP COLUMN password_hash;
DROP TABLE IF EXISTS staff_login_identities;
