-- Recurring-duty reminder ledger.
--
-- `sop_runs` is a checklist work record: its only statuses are in_progress,
-- completed and abandoned, because a run is something staff execute. A reminder
-- is a different thing — it is an obligation raised against a duty that may not
-- have been started yet. Recording one in sop_runs meant inventing a status the
-- domain does not admit and writing rows every consumer of sop_runs would then
-- show as real work, so reminders get their own table.
--
-- Deduplication is by (tenant_id, template_id, kind, day_key, run-or-none): the
-- scheduled task runs every five minutes, and each pass must not append a second
-- copy of the same notice. template_id is in the key because deep-clean and
-- stocktake are both "upcoming" on the same day; COALESCE(run_id) is needed
-- because SQLite treats every NULL as distinct, which would let the run-less
-- kinds repeat. One row per duty per day is therefore the whole rule — a repeat
-- pass finds the existing row and writes nothing. With run_id in the key, two
-- runs overrunning on the same day each get their own overdue notice.
CREATE TABLE IF NOT EXISTS sop_reminders (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    -- The duty this reminder is about, independent of whether a run exists yet.
    template_id TEXT NOT NULL,
    -- upcoming: three days ahead. due_no_run: the duty's own day. overdue: the
    -- day the run overran.
    kind TEXT NOT NULL,
    day_key TEXT NOT NULL,
    -- Set only for overdue reminders, because those are about a specific run.
    -- Null for upcoming and due_no_run: those fire when no run exists.
    run_id TEXT,
    -- Who the obligation belongs to. Null for the store-wide monthly duties,
    -- which nobody has started yet and so have no staff member to name.
    staff_id TEXT,
    staff_name TEXT,
    sent_at TEXT NOT NULL,
    -- When someone acted on it. Not used to suppress writing — that is what
    -- day_key is for — it marks the notice as handled so it reads as closed.
    acknowledged_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sop_reminders_dedup ON sop_reminders(tenant_id, template_id, kind, day_key, COALESCE(run_id, ''));
CREATE INDEX IF NOT EXISTS idx_sop_reminders_run ON sop_reminders(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_sop_reminders_open ON sop_reminders(tenant_id, acknowledged_at, sent_at);
