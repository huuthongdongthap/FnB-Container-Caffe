-- The applying manager's note, kept apart from the description the recorder wrote.
-- Applying a sanction used to overwrite the description, which destroyed the
-- original account of the conduct — the part an owner needs when an appeal arrives.
ALTER TABLE sop_violations ADD COLUMN sanction_note TEXT;
