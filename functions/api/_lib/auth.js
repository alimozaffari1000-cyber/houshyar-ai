const ITERATIONS = 100000;
const MIN_PEPPER_BYTES = 32;
function requireAuthPepper(pepper) {
  if (typeof pepper !== "string" || new TextEncoder().encode(pepper).byteLength < MIN_PEPPER_BYTES) {
    throw new Error("AUTH_PEPPER_MISSING_OR_WEAK");
  }
  return pepper;
}
const SESSION_SECONDS = 60 * 60 * 24 * 30;
function bytesToHex(bytes) { return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join(""); }
function base64Url(bytes) { let binary = ""; for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
async function digest(value) { return bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))); }
async function derivePassword(password, saltHex, iterations = ITERATIONS, pepper) {
  const secret = requireAuthPepper(pepper);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > ITERATIONS) throw new Error("INVALID_PBKDF2_ITERATIONS");
  const encoder = new TextEncoder();
  const pepperKey = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const pepperedPassword = await crypto.subtle.sign("HMAC", pepperKey, encoder.encode(password));
  const salt = Uint8Array.from(saltHex.match(/.{2}/g), pair => parseInt(pair, 16));
  const key = await crypto.subtle.importKey("raw", pepperedPassword, "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return bytesToHex(bits);
}
function randomHex(length = 16) { return bytesToHex(crypto.getRandomValues(new Uint8Array(length))); }
export function normalizeEmail(value) { return typeof value === "string" ? value.trim().toLowerCase() : ""; }
export function validEmail(value) { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export function parseCookie(request, name) { const cookie = request.headers.get("cookie") || ""; const entry = cookie.split(";").map(part => part.trim()).find(part => part.startsWith(name + "=")); return entry ? entry.slice(name.length + 1) : ""; }
export function sessionCookie(token, maxAge = SESSION_SECONDS) { return "houshyar_session=" + token + "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=" + maxAge; }
export async function createPasswordRecord(password, pepper) { const salt = randomHex(16); return { salt, hash: await derivePassword(password, salt, ITERATIONS, pepper), iterations: ITERATIONS }; }
export async function verifyPassword(password, salt, expectedHash, iterations = ITERATIONS, pepper) { const actual = await derivePassword(password, salt, iterations, pepper); if (typeof expectedHash !== "string" || actual.length !== expectedHash.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  return difference === 0; }
export async function createSession(db, userId, now = Math.floor(Date.now() / 1000)) {
  const token = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await digest(token);
  const sessionId = crypto.randomUUID();
  const expiresAt = now + SESSION_SECONDS;
  await db.prepare("INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)").bind(sessionId, userId, tokenHash, now, expiresAt, now).run();
  return { token, expiresAt };
}
export async function getSessionUser(db, request, now = Math.floor(Date.now() / 1000)) {
  const token = parseCookie(request, "houshyar_session");
  if (!token || token.length > 128) return null;
  const tokenHash = await digest(token);
  return db.prepare("SELECT users.id, users.email_normalized AS email, users.role FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.revoked_at IS NULL AND sessions.expires_at > ? AND users.status = 'active' LIMIT 1").bind(tokenHash, now).first();
}
export function originAllowed(request) { const origin = request.headers.get("origin"); if (!origin) return false; try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; } }
export const SESSION_MAX_AGE = SESSION_SECONDS;