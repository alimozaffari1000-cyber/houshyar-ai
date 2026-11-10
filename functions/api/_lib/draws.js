import { getSessionUser, originAllowed } from "../_lib/auth.js";
import { checkAdsRateLimit, adJson, readAdsJson } from "../_lib/ads.js";

export async function requireDrawUser({ request, env, write = false }) {
  if (env.DRAW_MODULE_ENABLED !== "true") {
    return { response: adJson({ error: "DRAWS_NOT_CONFIGURED", message: "سامانه قرعه‌کشی هنوز فعال نشده است." }, 503) };
  }
  if (env.AUTH_ENABLED !== "true" || !env.DB) {
    return { response: adJson({ error: "DRAW_AUTH_NOT_CONFIGURED" }, 503) };
  }
  if (write && !originAllowed(request)) return { response: adJson({ error: "ORIGIN_NOT_ALLOWED" }, 403) };
  let user;
  try { user = await getSessionUser(env.DB, request); }
  catch { return { response: adJson({ error: "AUTH_UNAVAILABLE" }, 503) }; }
  if (!user) return { response: adJson({ error: "AUTH_REQUIRED" }, 401) };
  return { user };
}

export async function checkDrawRate({ db, request, action, limit }) {
  try {
    const result = await checkAdsRateLimit({ db, request, action: "draw-" + action, limit });
    if (!result.allowed) return { response: adJson({ error: "RATE_LIMITED" }, 429, { "Retry-After": String(result.retryAfter) }) };
    return {};
  } catch {
    return { response: adJson({ error: "RATE_LIMIT_UNAVAILABLE" }, 503) };
  }
}

export { adJson, readAdsJson };
