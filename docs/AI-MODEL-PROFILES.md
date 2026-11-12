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

## Optional model comparison

The chat screen also offers an opt-in comparison checkbox. To enable it, set two different model IDs supported by the connected Groq account:

- `GROQ_MODEL_COMPARE_A`
- `GROQ_MODEL_COMPARE_B`

Both calls run in parallel through the same Groq API key. This is not cross-provider comparison. It can approximately double model inference usage for that request, so it is off by default. If either model is missing or both are identical, the API rejects comparison instead of silently pretending to compare. Usage totals are combined when both provider responses include usage metadata. These totals are not yet saved to a billing ledger.
