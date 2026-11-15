const REQUIRED_TABLES = [
  "users",
  "sessions",
  "usage_events",
  "api_rate_limits",
  "audit_events",
  "daily_usage",
  "email_verification_tokens",
  "password_reset_tokens",
  "merchant_stores",
  "products"
];

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }
});

// Public, non-sensitive readiness signal for deployment checks.
// Never return SQL errors, table names, database IDs, or stored records.
export async function onRequestGet({ env = {} } = {}) {
  if (!env.DB) {
    return json({
      status: "database_not_configured",
      databaseConfigured: false,
      databaseReachable: false,
      schemaReady: false
    }, 503);
  }

  try {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table'"
    ).all();
    const existing = new Set((result?.results || []).map(row => row.name));
    const schemaReady = REQUIRED_TABLES.every(name => existing.has(name));

    return json({
      status: schemaReady ? "ready" : "schema_pending",
      databaseConfigured: true,
      databaseReachable: true,
      schemaReady
    }, schemaReady ? 200 : 503);
  } catch {
    return json({
      status: "database_unavailable",
      databaseConfigured: true,
      databaseReachable: false,
      schemaReady: false
    }, 503);
  }
}
