-- Routine cleanup for expired authentication material.
-- Safe to run repeatedly. Usage and audit records are intentionally retained.
DELETE FROM email_verification_tokens
WHERE expires_at <= unixepoch() OR consumed_at IS NOT NULL;

DELETE FROM password_reset_tokens
WHERE expires_at <= unixepoch() OR consumed_at IS NOT NULL;

DELETE FROM sessions
WHERE expires_at <= unixepoch() OR revoked_at IS NOT NULL;

DELETE FROM api_rate_limits
WHERE expires_at <= unixepoch();
