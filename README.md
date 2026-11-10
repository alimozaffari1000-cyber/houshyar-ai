# Houshyar AI

Houshyar is a Persian-first, right-to-left multi-purpose AI assistant built with Vite and Cloudflare Pages Functions.

## Current implementation

- Responsive Persian RTL chat interface.
- Server-side Groq chat integration at `/api/chat`.
- Conversation history filtering and length limits.
- Request-body cap and upstream timeout (see the API implementation).
- Automated Node.js tests, build checks, security checks, and quality checks.

## Requirements

- Node.js 20 or newer.
- A Groq API key configured only as a server-side Cloudflare secret named `GROQ_API_KEY`.

## Local development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run qa
npm run agent:check
npm run security:scan
npm run build
npm run quality:check
```

## Deployment

See [Cloudflare setup instructions in Persian](CLOUDFLARE-SETUP-FA.md). Configure the Pages build command as `npm run build` and the output directory as `dist`. Never place provider credentials in browser-visible `VITE_*` variables or commit secrets.

## Production readiness

This repository is an early-stage prototype, not a fully production-hardened public service. The chat endpoint currently has no user authentication or per-user quota/rate limit. Before opening it to the public, configure server-side abuse prevention, request rate limiting, cost controls, monitoring, and an appropriate privacy policy. Authentication, billing, user accounts, persistent chat history, and database isolation are not implemented.

The automated checks are not a penetration test and do not certify the deployed Cloudflare environment.
