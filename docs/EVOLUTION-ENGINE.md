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

 
### Innovation discovery — read-only radar

The workflow `.github/workflows/innovation-radar.yml` runs weekly and on demand. It checks the latest public releases for the OpenAI, Google Gen AI, Anthropic, Groq, and LangChain SDK repositories and publishes a 30-day report artifact.

This is a discovery mechanism, not an automatic upgrade system. Release metadata is only a candidate signal: each proposed SDK/provider change must be checked for compatibility, security, licensing, privacy, availability, cost, and measurable benefit, then tested in an isolated pull request. The radar does not change dependencies, switch providers, access vendor-private roadmaps, or deploy code.

 
### Developer Scout — deterministic backlog signals

The workflow `.github/workflows/developer-scout.yml` runs weekly and on demand. It inventories source files, counts source lines, detects TODO/FIXME/HACK markers, and verifies that standard project checks are declared. It publishes a Markdown artifact for maintainer triage.

This is intentionally a read-only engineering scout, not an LLM coding agent. It does not infer runtime defects, modify files, create pull requests, access secrets, or deploy. A future LLM-assisted developer must receive narrowly scoped permissions, work in isolated branches, add regression tests, pass all checks, and require human review.
