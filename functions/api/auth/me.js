import { getSessionUser } from "../_lib/auth.js";
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
export async function onRequestGet({ request, env }) {
  if (env.AUTH_ENABLED !== "true" || !env.DB) return json({ error: "AUTH_NOT_CONFIGURED" }, 503);
  const user = await getSessionUser(env.DB, request);
  return user ? json({ authenticated: true, user }) : json({ authenticated: false }, 200);
}