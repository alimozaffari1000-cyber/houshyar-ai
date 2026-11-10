-- Public ad slots and server-reviewed event state.
-- No campaign is served unless its slot is enabled and all global flags are explicitly enabled.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ad_slots (
  slot_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  max_items INTEGER NOT NULL DEFAULT 1 CHECK (max_items BETWEEN 1 AND 5),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO ad_slots (slot_key, label, enabled, max_items, created_at, updated_at)
VALUES
  ('home_below_welcome', 'صفحه اصلی؛ زیر معرفی', 0, 1, 0, 0),
  ('account_dashboard', 'پنل حساب کاربری', 0, 2, 0, 0);

ALTER TABLE ad_events ADD COLUMN slot_key TEXT;
ALTER TABLE ad_events ADD COLUMN validated_by TEXT REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE ad_events ADD COLUMN validation_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_ad_events_validation_time ON ad_events(validation_status, occurred_at);
