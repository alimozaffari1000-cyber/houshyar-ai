import { originAllowed } from "../../_lib/auth.js";
import { marketJson, requireMarketUser } from "../../_lib/marketplace.js";
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

export async function onRequestDelete({ request, params, env }) {
 if (!originAllowed(request)) return marketJson({error:"ORIGIN_NOT_ALLOWED"},403);
 const auth=await requireMarketUser(request,env);if(auth.response)return auth.response;
 const id=typeof params.id==="string"?params.id:"";
 if (!/^[0-9a-f-]{36}$/i.test(id)) return marketJson({error:"IMAGE_NOT_FOUND"},404);
 if (!env.DB || !env.R2_BUCKET) return marketJson({error:"IMAGE_STORAGE_NOT_CONFIGURED"},503);
 try {
  const row=await env.DB.prepare("SELECT object_key FROM marketplace_images WHERE id=? AND owner_user_id=? AND status='ready' AND NOT EXISTS (SELECT 1 FROM marketplace_listing_images WHERE image_id=?) LIMIT 1").bind(id,auth.user.id,id).first();
  if (!row) return marketJson({error:"IMAGE_NOT_FOUND_OR_IN_USE"},404);
  const changed=await env.DB.prepare("UPDATE marketplace_images SET status='deleted' WHERE id=? AND owner_user_id=? AND status='ready' AND NOT EXISTS (SELECT 1 FROM marketplace_listing_images WHERE image_id=?)").bind(id,auth.user.id,id).run();
  if (!changed.meta?.changes) return marketJson({error:"IMAGE_NOT_FOUND_OR_IN_USE"},409);
  try { await env.R2_BUCKET.delete(row.object_key); }
  catch { return marketJson({error:"IMAGE_CLEANUP_PENDING"},503); }
  return marketJson({deleted:true});
 } catch { return marketJson({error:"IMAGE_DELETE_FAILED"},503); }
}
