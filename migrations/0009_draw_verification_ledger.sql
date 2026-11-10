CREATE TABLE IF NOT EXISTS draw_result_verifications (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES draw_campaigns(id) ON DELETE RESTRICT,
  result_id TEXT NOT NULL REFERENCES draw_results(id) ON DELETE RESTRICT,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('verified', 'failed')),
  checked_by TEXT NOT NULL,
  verification_details_json TEXT NOT NULL DEFAULT '{}',
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (result_id, id)
);
CREATE INDEX IF NOT EXISTS idx_draw_verifications_result
  ON draw_result_verifications(result_id, checked_at DESC);
CREATE TRIGGER IF NOT EXISTS trg_draw_verifications_no_update
BEFORE UPDATE ON draw_result_verifications
BEGIN
  SELECT RAISE(ABORT, 'DRAW_VERIFICATION_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS trg_draw_verifications_no_delete
BEFORE DELETE ON draw_result_verifications
BEGIN
  SELECT RAISE(ABORT, 'DRAW_VERIFICATION_IMMUTABLE');
END;
