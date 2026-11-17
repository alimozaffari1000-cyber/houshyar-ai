const REQUIRED_TABLES = [
  "users", "sessions", "usage_events", "api_rate_limits", "audit_events",
  "daily_usage", "email_verification_tokens", "password_reset_tokens",
  "merchant_stores", "products"
];

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }
});

async function databaseStatus(db) {
  if (!db) return { status: "not_configured", ready: false };
  try {
    const result = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table'"
    ).all();
    const names = new Set((result?.results || []).map(row => row.name));
    const ready = REQUIRED_TABLES.every(name => names.has(name));
    return { status: ready ? "ready" : "schema_pending", ready };
  } catch {
    return { status: "unavailable", ready: false };
  }
}

export async function onRequestGet({ env = {} } = {}) {
  const [database] = await Promise.all([databaseStatus(env.DB)]);
  const providers = {
    groq: Boolean(env.GROQ_API_KEY),
    anthropic: Boolean(env.CLAUDE_API_KEY),
    google: Boolean(env.GEMINI_API_KEY)
  };
  const aiReady = Object.values(providers).some(Boolean);
  const overallReady = aiReady && database.ready;
  const body = {
    status: overallReady ? "ready" : "degraded",
    service: "houshyar-ai",
    checks: {
      api: { status: "ready" },
      ai: { status: aiReady ? "configured" : "not_configured", providers },
      database
    },
    timestamp: new Date().toISOString()
  };
  return json(body, overallReady ? 200 : 503);
}
