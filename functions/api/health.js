const json = (body) => new Response(JSON.stringify(body), {
  status: 200,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }
});

export async function onRequestGet({ env }) {
  const rawVersion = typeof env?.CF_PAGES_COMMIT_SHA === "string"
    ? env.CF_PAGES_COMMIT_SHA
    : typeof env?.APP_VERSION === "string"
      ? env.APP_VERSION
      : "unknown";
  const version = /^[a-zA-Z0-9._-]{1,80}$/.test(rawVersion) ? rawVersion : "unknown";

  return json({
    status: "ok",
    service: "houshyar-ai",
    version,
    timestamp: new Date().toISOString()
  });
}
