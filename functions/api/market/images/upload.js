import { originAllowed } from "../../_lib/auth.js";
import { marketJson, validCountry, requireMarketUser, enforceMarketWriteLimit } from "../../_lib/marketplace.js";
const MAX_IMAGE_BYTES=5*1024*1024;
const IMAGE_TYPES={
 "image/jpeg":{extension:"jpg",signature:b=>b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255},
 "image/png":{extension:"png",signature:b=>b.length>=8&&b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71&&b[4]===13&&b[5]===10&&b[6]===26&&b[7]===10},
 "image/webp":{extension:"webp",signature:b=>b.length>=12&&String.fromCharCode(...b.slice(0,4))==="RIFF"&&String.fromCharCode(...b.slice(8,12))==="WEBP"}
};
export async function onRequestPost({request,env}){
 if(!originAllowed(request))return marketJson({error:"ORIGIN_NOT_ALLOWED"},403);
 if(!env.R2_BUCKET)return marketJson({error:"IMAGE_STORAGE_NOT_CONFIGURED"},503);
 const auth=await requireMarketUser(request,env);if(auth.response)return auth.response;
 if(Number(request.headers.get("content-length")||0)>MAX_IMAGE_BYTES+65536)return marketJson({error:"IMAGE_TOO_LARGE"},413);
 let form;try{form=await request.formData();}catch{return marketJson({error:"INVALID_MULTIPART_BODY"},400);}
 const file=form.get("image"),storeId=form.get("storeId"),country=typeof form.get("country")==="string"?form.get("country").toUpperCase():"";
 if(!validCountry(country)||typeof storeId!=="string"||!storeId||storeId.length>64)return marketJson({error:"INVALID_IMAGE_TARGET"},400);
 if(!file||typeof file.arrayBuffer!=="function"||typeof file.size!=="number")return marketJson({error:"IMAGE_REQUIRED"},400);
 if(file.size<1||file.size>MAX_IMAGE_BYTES)return marketJson({error:"IMAGE_TOO_LARGE_OR_EMPTY"},413);
 const mime=file.type?.toLowerCase()||"",type=IMAGE_TYPES[mime];if(!type)return marketJson({error:"UNSUPPORTED_IMAGE_TYPE"},415);
 try{
  const store=await env.DB.prepare("SELECT id FROM marketplace_stores WHERE id=? AND owner_user_id=? AND country_code=? AND status IN ('pending','active') LIMIT 1").bind(storeId,auth.user.id,country).first();
  if(!store)return marketJson({error:"STORE_NOT_FOUND_OR_NOT_OWNED"},404);
  if(await enforceMarketWriteLimit(env.DB,auth.user.id,"image-upload"))return marketJson({error:"RATE_LIMITED"},429);
  const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.byteLength!==file.size||!type.signature(bytes))return marketJson({error:"IMAGE_CONTENT_MISMATCH"},415);
  const id=crypto.randomUUID(),objectKey="marketplace/"+country.toLowerCase()+"/"+storeId+"/"+id+"."+type.extension;
  await env.R2_BUCKET.put(objectKey,bytes,{httpMetadata:{contentType:mime,cacheControl:"private, max-age=0, no-store"},customMetadata:{ownerUserId:auth.user.id,storeId,country,purpose:"marketplace-image"}});
  try{await env.DB.prepare("INSERT INTO marketplace_images (id,store_id,owner_user_id,country_code,object_key,content_type,byte_size,status,created_at) VALUES (?,?,?,?,?,?,?,'ready',?)").bind(id,storeId,auth.user.id,country,objectKey,mime,bytes.byteLength,Math.floor(Date.now()/1000)).run();}
  catch(error){await env.R2_BUCKET.delete(objectKey).catch(()=>{});throw error;}
  return marketJson({uploaded:true,imageId:id,contentType:mime,size:bytes.byteLength},201);
 }catch{return marketJson({error:"IMAGE_UPLOAD_FAILED"},503);}
}
