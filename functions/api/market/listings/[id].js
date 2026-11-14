import { marketJson, validCountry } from "../../_lib/marketplace.js";
export async function onRequestGet({ request, env, params }) {
 if (!env.DB) return marketJson({error:"DATABASE_NOT_CONFIGURED"},503);
 const id=typeof params.id==="string"?params.id:"", country=(new URL(request.url).searchParams.get("country")||"").toUpperCase();
 if (!/^[0-9a-f-]{36}$/i.test(id)||!validCountry(country)) return marketJson({error:"INVALID_LISTING"},400);
 try {
  const listing=await env.DB.prepare("SELECT l.id,l.country_code,l.category,l.title,l.description,l.city,l.price_amount,l.currency_code,l.created_at,s.name AS store_name,s.slug AS store_slug FROM marketplace_listings l JOIN marketplace_stores s ON s.id=l.store_id WHERE l.id=? AND l.country_code=? AND l.status='published' AND s.status='active' LIMIT 1").bind(id,country).first();
  if (!listing) return marketJson({error:"LISTING_NOT_FOUND"},404);
  const result=await env.DB.prepare("SELECT i.id FROM marketplace_listing_images li JOIN marketplace_images i ON i.id=li.image_id WHERE li.listing_id=? AND i.status='ready' ORDER BY li.sort_order LIMIT 6").bind(id).all();
  return marketJson({listing:{...listing,images:(result.results||[]).map(x=>x.id)}});
 } catch { return marketJson({error:"LISTING_READ_FAILED"},503); }
}
