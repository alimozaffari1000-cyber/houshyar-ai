import { marketJson } from "../../../_lib/marketplace.js";
export async function onRequestGet({ params, env }) {
 const id = typeof params.id === "string" ? params.id : "";
 if (!/^[0-9a-f-]{36}$/i.test(id)) return marketJson({error:"IMAGE_NOT_FOUND"},404);
 if (!env.DB || !env.R2_BUCKET) return marketJson({error:"IMAGE_STORAGE_NOT_CONFIGURED"},503);
 try {
  const row = await env.DB.prepare("SELECT i.object_key, i.content_type, i.byte_size FROM marketplace_images i JOIN marketplace_listing_images li ON li.image_id=i.id JOIN marketplace_listings l ON l.id=li.listing_id JOIN marketplace_stores s ON s.id=l.store_id WHERE i.id=? AND i.status='ready' AND l.status='published' AND s.status='active' AND i.store_id=l.store_id AND i.country_code=l.country_code AND s.country_code=l.country_code LIMIT 1").bind(id).first();
  if (!row) return marketJson({error:"IMAGE_NOT_FOUND"},404);
  const object=await env.R2_BUCKET.get(row.object_key);
  if (!object) return marketJson({error:"IMAGE_NOT_FOUND"},404);
  const headers=new Headers(); object.writeHttpMetadata(headers);
  headers.set("Content-Type",row.content_type); headers.set("Content-Length",String(row.byte_size));
  headers.set("Cache-Control","public, max-age=300, s-maxage=3600"); headers.set("X-Content-Type-Options","nosniff");
  headers.set("Content-Security-Policy","default-src 'none'; sandbox");
  return new Response(object.body,{headers});
 } catch { return marketJson({error:"IMAGE_READ_FAILED"},503); }
}
