import { marketJson, validCountry } from "../../_lib/marketplace.js";
export async function onRequestGet({ request, env }) {
 if (!env.DB) return marketJson({error:"DATABASE_NOT_CONFIGURED"},503);
 const url=new URL(request.url), country=(url.searchParams.get("country")||"").toUpperCase(), slug=url.searchParams.get("slug")||"";
 if (!validCountry(country) || !/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(slug)) return marketJson({error:"INVALID_STORE"},400);
 try {
  const store=await env.DB.prepare("SELECT id,country_code,name,slug,description,city,created_at FROM marketplace_stores WHERE country_code=? AND slug=? AND status='active' LIMIT 1").bind(country,slug).first();
  if (!store) return marketJson({error:"STORE_NOT_FOUND"},404);
  const result=await env.DB.prepare("SELECT l.id,l.category,l.title,l.description,l.city,l.price_amount,l.currency_code,l.created_at,group_concat(i.id, ',') AS image_ids FROM marketplace_listings l LEFT JOIN marketplace_listing_images li ON li.listing_id=l.id LEFT JOIN marketplace_images i ON i.id=li.image_id AND i.status='ready' WHERE l.store_id=? AND l.country_code=? AND l.status='published' GROUP BY l.id ORDER BY l.created_at DESC LIMIT 50").bind(store.id,country).all();
  const listings=(result.results||[]).map(item=>{const images=item.image_ids?item.image_ids.split(",").slice(0,6):[];const {image_ids,...listing}=item;return {...listing,images};});
  return marketJson({store,listings});
 } catch { return marketJson({error:"STORE_READ_FAILED"},503); }
}
