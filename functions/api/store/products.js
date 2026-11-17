import { getSessionUser, originAllowed } from "../_lib/auth.js";
import { authJson, readAuthBody, enforceAuthRateLimit } from "../_lib/auth-flow.js";
import { getCurrencyDefinition } from "../../../src/payments/money.js";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export async function onRequestGet({ request, env }) {
  if (!env.DB) return authJson({ error: "CATALOG_UNAVAILABLE" }, 503);
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim().slice(0, 80);
  const category = (url.searchParams.get("category") || "").trim().toLowerCase();
  const limit = clamp(Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20, 1, 50);
  const offset = clamp(Number.parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0, 10000);
  if (category && !slugPattern.test(category)) return authJson({ error: "INVALID_CATEGORY" }, 400);
  const conditions = ["p.status = 'published'", "s.status = 'active'"];
  const bindings = [];
  if (query) {
    conditions.push("(p.title LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\')");
    const safeQuery = query.replace(/[\\%_]/g, "\\$&");
    bindings.push("%" + safeQuery + "%", "%" + safeQuery + "%");
  }
  if (category) { conditions.push("p.category = ?"); bindings.push(category); }
  bindings.push(limit + 1, offset);
  try {
    const result = await env.DB.prepare(
      "SELECT p.id, p.title, p.slug, p.description, p.category, p.price_minor AS priceMinor, p.currency_code AS currency, p.stock_count AS stockCount, p.created_at AS createdAt, s.name AS storeName, s.slug AS storeSlug " +
      "FROM products p JOIN merchant_stores s ON s.id = p.store_id WHERE " + conditions.join(" AND ") +
      " ORDER BY p.created_at DESC LIMIT ? OFFSET ?"
    ).bind(...bindings).all();
    const rows = Array.isArray(result.results) ? result.results : [];
    return authJson({ products: rows.slice(0, limit), hasMore: rows.length > limit, limit, offset });
  } catch {
    return authJson({ error: "CATALOG_UNAVAILABLE" }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  if (!originAllowed(request)) return authJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  const limited = await enforceAuthRateLimit({ env, request, action: "product-create", email: user.email, limit: 30 });
  if (limited) return limited;
  const parsed = await readAuthBody(request);
  if (parsed.error) return authJson({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const slug = typeof body.slug === "string" && body.slug.trim() ? body.slug.trim().toLowerCase() : crypto.randomUUID();
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim().toLowerCase() : "";
  const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "IRR";
  const priceMinor = Number(body.priceMinor);
  const stockCount = body.stockCount === undefined ? 0 : Number(body.stockCount);
  if (title.length < 2 || title.length > 160) return authJson({ error: "INVALID_PRODUCT_TITLE" }, 400);
  if (!slugPattern.test(slug) || slug.length > 100) return authJson({ error: "INVALID_PRODUCT_SLUG" }, 400);
  if (description.length > 5000) return authJson({ error: "DESCRIPTION_TOO_LONG" }, 400);
  if (!slugPattern.test(category) || category.length > 60) return authJson({ error: "INVALID_CATEGORY" }, 400);
  if (!Number.isSafeInteger(priceMinor) || priceMinor <= 0) return authJson({ error: "INVALID_PRICE" }, 400);
  if (!Number.isSafeInteger(stockCount) || stockCount < 0 || stockCount > 1000000) return authJson({ error: "INVALID_STOCK" }, 400);
  const currencyDefinition = getCurrencyDefinition(currency);
  if (!currencyDefinition) return authJson({ error: "UNSUPPORTED_CURRENCY" }, 400);
  try {
    const store = await env.DB.prepare("SELECT id, status FROM merchant_stores WHERE user_id = ? LIMIT 1").bind(user.id).first();
    if (!store) return authJson({ error: "STORE_NOT_FOUND" }, 404);
    if (store.status !== "active") return authJson({ error: "STORE_NOT_APPROVED" }, 403);
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      "INSERT INTO products (id, store_id, title, slug, description, category, price_minor, currency_code, stock_count, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)"
    ).bind(id, store.id, title, slug, description, category, priceMinor, currency, stockCount, now, now).run();
    return authJson({ created: true, product: { id, title, slug, category, priceMinor, currency, currencyExponent: currencyDefinition.exponent, stockCount, status: "draft" } }, 201);
  } catch {
    return authJson({ error: "PRODUCT_CREATE_CONFLICT" }, 409);
  }
}
