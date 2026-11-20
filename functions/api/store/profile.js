import { getSessionUser, originAllowed } from "../_lib/auth.js";
import { authJson, readAuthBody, enforceAuthRateLimit } from "../_lib/auth-flow.js";

const textField = (body, key, current, max) => {
  if (body[key] === undefined) return current;
  if (typeof body[key] !== "string") return null;
  const value = body[key].trim();
  return value.length <= max ? value : null;
};

export async function onRequestPut({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  if (!originAllowed(request)) return authJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  const limited = await enforceAuthRateLimit({ env, request, action: "store-profile-update", email: user.email, limit: 20 });
  if (limited) return limited;
  const parsed = await readAuthBody(request);
  if (parsed.error) return authJson({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  try {
    const current = await env.DB.prepare(
      "SELECT id, city, region, public_address AS publicAddress, latitude, longitude, " +
      "offers_delivery AS offersDelivery, offers_pickup AS offersPickup, " +
      "contact_phone AS contactPhone, order_url AS orderUrl, country_code AS countryCode " +
      "FROM merchant_stores WHERE user_id = ? LIMIT 1"
    ).bind(user.id).first();
    if (!current) return authJson({ error: "STORE_NOT_FOUND" }, 404);

    const city = textField(body, "city", current.city, 80);
    const countryCode = body.countryCode === undefined ? current.countryCode :
      (body.countryCode === null || body.countryCode === "" ? null :
        (typeof body.countryCode === "string" ? body.countryCode.trim().toUpperCase() : ""));
    if (countryCode !== null && !/^[A-Z]{2}$/.test(countryCode)) return authJson({ error: "INVALID_COUNTRY_CODE" }, 400);
    const region = textField(body, "region", current.region, 80);
    const publicAddress = textField(body, "publicAddress", current.publicAddress, 240);
    const contactPhone = textField(body, "contactPhone", current.contactPhone, 30);
    const orderUrl = textField(body, "orderUrl", current.orderUrl, 500);
    if ([city, region, publicAddress, contactPhone, orderUrl].some((value) => value === null)) {
      return authJson({ error: "INVALID_STORE_PROFILE_FIELD" }, 400);
    }
    if (body.city !== undefined && city.length < 2) return authJson({ error: "INVALID_CITY" }, 400);
    if (orderUrl && !/^https:\/\//i.test(orderUrl)) return authJson({ error: "ORDER_URL_MUST_USE_HTTPS" }, 400);

    const latitude = body.latitude === undefined ? current.latitude :
      (body.latitude === null || body.latitude === "" ? null : Number(body.latitude));
    const longitude = body.longitude === undefined ? current.longitude :
      (body.longitude === null || body.longitude === "" ? null : Number(body.longitude));
    if ((latitude === null) !== (longitude === null) ||
        (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
         !Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
      return authJson({ error: "INVALID_STORE_COORDINATES" }, 400);
    }

    const offersDelivery = body.offersDelivery === undefined ? current.offersDelivery : body.offersDelivery;
    const offersPickup = body.offersPickup === undefined ? current.offersPickup : body.offersPickup;
    if (![0, 1, true, false].includes(offersDelivery) || ![0, 1, true, false].includes(offersPickup)) {
      return authJson({ error: "INVALID_FULFILLMENT_OPTIONS" }, 400);
    }
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      "UPDATE merchant_stores SET city = ?, region = ?, public_address = ?, latitude = ?, longitude = ?, " +
      "offers_delivery = ?, offers_pickup = ?, contact_phone = ?, order_url = ?, country_code = ?, updated_at = ? WHERE id = ? AND user_id = ?"
    ).bind(city, region, publicAddress, latitude, longitude, offersDelivery ? 1 : 0,
      offersPickup ? 1 : 0, contactPhone, orderUrl, countryCode, now, current.id, user.id).run();
    return authJson({ updated: true, store: {
      city, region, publicAddress, latitude, longitude,
      offersDelivery: offersDelivery ? 1 : 0, offersPickup: offersPickup ? 1 : 0,
      contactPhone, orderUrl, countryCode
    } });
  } catch {
    return authJson({ error: "STORE_PROFILE_UNAVAILABLE" }, 503);
  }
}
