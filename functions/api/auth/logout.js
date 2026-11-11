import { parseCookie, sessionCookie, originAllowed } from "../_lib/auth.js";
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });
export async function onRequestPost({ request, env }) {
  if (!originAllowed(request)) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const token = parseCookie(request, "houshyar_session");
  if (token && env.DB) {
    const bytes = new TextEncoder().encode(token);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), value => value.toString(16).padStart(2, "0")).join("");
    await env.DB.prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL").bind(Math.floor(Date.now() / 1000), hash).run();
  }
  return json({ loggedOut: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
}