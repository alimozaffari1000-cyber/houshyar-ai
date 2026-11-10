ALTER TABLE draw_results ADD COLUMN eligible_entry_count INTEGER NOT NULL DEFAULT 0 CHECK (eligible_entry_count >= 0);
ALTER TABLE draw_results ADD COLUMN eligible_entries_sha256 TEXT NOT NULL DEFAULT '';
