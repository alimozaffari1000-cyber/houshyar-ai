const encoder = new TextEncoder();
function toHex(bytes) {
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join("");
}
export async function hashAuthToken(token) {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(token)));
}
export function createAuthToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
export function authEmailConfig(env) {
  if (!env.EMAIL_API_URL || !env.EMAIL_API_KEY || !env.EMAIL_FROM || !env.APP_BASE_URL) return null;
  let base;
  let endpoint;
  try {
    base = new URL(env.APP_BASE_URL);
    endpoint = new URL(env.EMAIL_API_URL);
  } catch { return null; }
  if (base.protocol !== "https:" || endpoint.protocol !== "https:" || base.username || base.password || endpoint.username || endpoint.password) return null;
  return { baseUrl: base.origin, endpoint: endpoint.toString(), from: String(env.EMAIL_FROM).slice(0, 254) };
}
export async function sendAuthEmail(env, { to, subject, text }) {
  const config = authEmailConfig(env);
  if (!config) throw new Error("AUTH_EMAIL_NOT_CONFIGURED");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let response;
  try {
    response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env.EMAIL_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ from: config.from, to, subject, text }),
      signal: controller.signal
    });
  } finally { clearTimeout(timeout); }
  if (!response.ok) throw new Error("AUTH_EMAIL_DELIVERY_FAILED");
}
export function authEmailLink(env, queryName, token) {
  const config = authEmailConfig(env);
  if (!config) throw new Error("AUTH_EMAIL_NOT_CONFIGURED");
  const url = new URL(config.baseUrl);
  url.hash = new URLSearchParams({ [queryName]: token }).toString();
  return url.toString();
}
