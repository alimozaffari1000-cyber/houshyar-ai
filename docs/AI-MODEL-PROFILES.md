# Houshyar AI response profiles

The chat interface offers four response profiles:

- `fast`: uses `GROQ_MODEL_FAST`
- `balanced`: uses `GROQ_MODEL`
- `deep`: uses `GROQ_MODEL_DEEP`
- `creative`: uses `GROQ_MODEL_CREATIVE`

## Cloudflare configuration

In the Pages project's production environment variables, set the model identifiers supported by the connected Groq account. Keep `GROQ_API_KEY` as a secret; model identifiers are configuration values, not credentials.

If a profile-specific variable is unset, Houshyar safely falls back to `GROQ_MODEL`. If that is also unset, the existing default `llama-3.3-70b-versatile` is used. This means the four choices can initially use the same model until distinct profile variables are configured.

The API accepts only the four known profile names. It never accepts an arbitrary model identifier from the browser. Provider usage counts are returned when Groq includes them; they are not yet persisted as account billing records.

After changing Cloudflare variables, deploy a new Pages build and verify `/api/chat` with a test message. GitHub Actions success alone does not confirm a Cloudflare deployment.
