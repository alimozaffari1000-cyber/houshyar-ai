# Houshyar Evolution Engine

## Purpose

Provide a controlled, recurring maintenance loop for Houshyar: inspect the repository, apply only explicitly allowlisted repairs, run quality/security/build checks, and propose changes for human review.

## Current automation

The GitHub Actions workflow `.github/workflows/evolution-engine.yml` runs daily at 03:17 UTC and can also be started manually.

Pipeline:

1. Install the declared Node dependencies.
2. Run `npm run agent:repair` (currently limited to safe local configuration repairs).
3. Run `npm run qa`.
4. Run `npm run agent:check`.
5. Run `npm run security:scan`.
6. Run `npm run build`.
7. Run `npm run quality:check`.
8. If all checks pass and the allowlisted repair changed files, open/update a **draft pull request**.

## Autonomy and safety boundaries

- The workflow does not push changes directly to `main`.
- It does not merge pull requests or deploy to production.
- It must never edit secrets, authentication/authorization rules, payment logic, database migrations, user data, or security policy automatically.
- New dependencies, model/provider changes, schema changes, and production configuration changes require review.
- A failed check blocks the repair pull request step.
- A static secret scan is not a complete security audit.

## Next evolution stages

### Stage 1 — Repository maintenance (this workflow)
Scheduled checks, safe allowlisted repair, reproducible verification, draft PR.

### Stage 2 — Runtime self-healing
Add health endpoints and synthetic checks for the deployed Pages app and API. Detect outage, latency, provider failures, and quota exhaustion. Alert first; permit only bounded recovery actions such as retry/backoff and circuit-breaker reset.

### Stage 3 — Observability and incident memory
Collect privacy-minimized metrics, structured error categories, deployment identifiers, and incident timelines. Do not store chat contents or secrets in telemetry.

### Stage 4 — AI-assisted engineering proposals
Use a separately permissioned development agent to inspect issues and propose code changes on isolated branches. Require tests, security checks, dependency review, and human approval before merge.

### Stage 5 — Progressive delivery
Deploy approved commits to preview/staging, run smoke and end-to-end tests, then promote with health checks and a documented rollback path. Production promotion remains gated until the deployment platform and rollback procedure are verified.

## Operational prerequisites

Before enabling unattended runs, confirm GitHub Actions is enabled and that the repository's Actions token is allowed to create pull requests. If the repository restricts workflow-created pull requests, enable that repository setting or use a narrowly scoped GitHub App. Never put long-lived credentials in workflow YAML.

 

### Runtime health endpoint — initial step

The Pages Function at `GET /api/health` returns a minimal service status, deployment version (when a safe version identifier is available), and timestamp. It uses `Cache-Control: no-store` and does not expose provider configuration, secrets, database state, user data, or chat content. Automated tests cover the response shape and secret isolation.

This endpoint confirms that the function can answer a request; it does **not** prove that D1, authentication, AI providers, marketplace operations, or the full user journey are healthy. External synthetic checks and alerting require a verified public Pages URL and are a separate rollout step.


### Synthetic runtime monitoring

The workflow `.github/workflows/runtime-health-monitor.yml` checks the deployed `/api/health` endpoint every 15 minutes once the repository variable `HOUSHYAR_PUBLIC_URL` is configured. It can also be run manually with a public HTTPS base URL. The checker uses a fixed health path, rejects non-HTTPS/local/IP-literal/credential-bearing targets, disallows redirects, applies an 8-second request timeout, and retries at most three times with bounded backoff.

To enable the scheduled check, add the repository Actions variable `HOUSHYAR_PUBLIC_URL` with the public base URL of the deployed Pages site (for example, the site's origin; do not include `/api/health`). No API key or other secret is required. If the variable is absent, scheduled runs are skipped. A failed check makes the workflow fail and is visible in GitHub Actions; notification routing is not configured by this workflow.

The monitor does not restart services, change Cloudflare settings, access user data, or trigger deployment/rollback. It measures only public endpoint reachability and response shape, not downstream D1 or AI-provider health.

### Innovation discovery — read-only radar

The workflow `.github/workflows/innovation-radar.yml` runs weekly and on demand. It checks the latest public releases for the OpenAI, Google Gen AI, Anthropic, Groq, and LangChain SDK repositories and publishes a 30-day report artifact.

This is a discovery mechanism, not an automatic upgrade system. Release metadata is only a candidate signal: each proposed SDK/provider change must be checked for compatibility, security, licensing, privacy, availability, cost, and measurable benefit, then tested in an isolated pull request. The radar does not change dependencies, switch providers, access vendor-private roadmaps, or deploy code.

 
### Developer Scout — deterministic backlog signals

The workflow `.github/workflows/developer-scout.yml` runs weekly and on demand. It inventories source files, counts source lines, detects TODO/FIXME/HACK markers, and verifies that standard project checks are declared. It publishes a Markdown artifact for maintainer triage.

This is intentionally a read-only engineering scout, not an LLM coding agent. It does not infer runtime defects, modify files, create pull requests, access secrets, or deploy. A future LLM-assisted developer must receive narrowly scoped permissions, work in isolated branches, add regression tests, pass all checks, and require human review.

### Admin-only runtime diagnostics

The endpoint `GET /api/admin/health` is protected by the active Houshyar session and the server-side `admin` role check. The frontend adds the diagnostics entry point only after `GET /api/auth/me` confirms an authenticated administrator; the endpoint independently enforces authorization on every request. The dashboard displays only aggregate readiness checks and a timestamp. It does not expose credentials, raw database errors, user records, or conversation content.

The admin dashboard is observational only. It does not restart services, mutate data, change provider configuration, or deploy. If authentication or the database is not configured, diagnostics remain unavailable rather than bypassing access control.

The synthetic monitor also opens or updates a deduplicated GitHub issue when a configured endpoint check fails, then closes that automation-labeled incident after a later successful check. This requires the repository Actions token to have issue write permission. No email, SMS, or external paging integration is configured. Manual runs without a target URL are skipped rather than generating a false outage alert.


### Privacy-minimized provider metrics

The migration `migrations/0008_operational_metrics.sql` adds an operational-only event table. It stores a random request identifier, allowlisted event/provider labels, HTTP status, bounded latency, and timestamp. It does not store prompts, messages, user IDs, IP addresses, credentials, or upstream response bodies.

Collection is **opt-in**. It requires the Pages D1 binding `DB`, the migration to be applied to the target database, and the Pages environment variable `OBSERVABILITY_ENABLED=true`. Without all three, chat continues without persistent metrics. D1 writes run through the request execution context in the background and do not block the model response. A 14-day retention cleanup runs when new metrics are written.

The admin-only endpoint `GET /api/admin/metrics` returns 24-hour aggregates after checking the same active session and server-side admin role. The admin dashboard displays provider request counts, failures, and average latency. Until the migration and opt-in setting are configured, it explicitly reports metrics as disabled; it never fabricates data. The endpoint does not return individual request rows.

Apply the migration to the configured D1 database using the project's Wrangler D1 migration process. Do not enable collection in production until the D1 binding, backup/restore process, retention policy, and administrator access have been reviewed.
