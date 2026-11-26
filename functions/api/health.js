import { HOUSHYAR_CORE_VERSION } from "./_lib/houshyar-core.js";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff"
};

/**
 * Minimal public liveness endpoint.
 * Deliberately exposes no provider names, secret/configuration state, bindings,
 * account data, or internal infrastructure details.
 */
export async function onRequestGet() {
  return new Response(JSON.stringify({
    ok: true,
    service: "houshyar-ai",
    coreVersion: HOUSHYAR_CORE_VERSION
  }), { status: 200, headers });
}
