# Health endpoint

Houshyar exposes a minimal liveness endpoint at:

`GET /api/health`

A successful response returns HTTP 200 and a small JSON document:

```json
{
  "ok": true,
  "service": "houshyar-ai",
  "coreVersion": "1.0.0"
}
```

The endpoint is intended for uptime checks and deployment smoke tests. It uses
`Cache-Control: no-store, max-age=0` and `X-Content-Type-Options: nosniff`.

## Security boundary

This is a liveness check only. It does not prove that an AI provider is configured,
that a database is reachable, that authentication is enabled, or that chat requests
can complete. It deliberately does not return provider names, secret/configuration
state, Cloudflare bindings, account information, or internal infrastructure details.

Do not use this public endpoint as a readiness check for authenticated features.
Verify those capabilities separately with controlled end-to-end tests that do not
expose secrets or user data.

## Verification

After a Pages deployment, request `/api/health` and verify:

- HTTP status is `200`.
- The JSON contains `ok: true`, `service: "houshyar-ai"`, and `coreVersion`.
- The response has `Cache-Control: no-store, max-age=0` and
  `X-Content-Type-Options: nosniff`.
- No provider keys, binding names, or account data are returned.
