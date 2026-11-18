import { getSessionUser, originAllowed } from "../../_lib/auth.js";
import { checkAuthRateLimit } from "../../_lib/auth-rate-limit.js";
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
export async function onRequestPost({request,env,params}) {
 if(!originAllowed(request)) return json({error:"ORIGIN_NOT_ALLOWED"},403);
 if(!env?.DB) return json({error:"DATABASE_UNAVAILABLE"},503);
 let user;
 try { user=await getSessionUser(env.DB,request); } catch { return json({error:"AUTH_UNAVAILABLE"},503); }
 if(!user) return json({error:"AUTH_REQUIRED"},401);
 try {
  const rate=await checkAuthRateLimit({db:env.DB,action:"agent-task-control",email:user.email||user.id,clientIp:request.headers.get("cf-connecting-ip")||"unknown",limit:30});
  if(!rate.allowed) return json({error:"TASK_CONTROL_RATE_LIMITED"},429);
 } catch { return json({error:"TASK_CONTROL_RATE_LIMIT_UNAVAILABLE"},503); }
 const id=typeof params?.id==="string"?params.id:"";
 if(!/^[0-9a-f-]{36}$/i.test(id)) return json({error:"INVALID_TASK_ID"},400);
 const now=Math.floor(Date.now()/1000);
 let result;
 try {
  result=await env.DB.prepare("UPDATE agent_tasks SET status='queued',error_code=NULL,completed_at=NULL,started_at=NULL,lease_owner=NULL,lease_expires_at=NULL,updated_at=? WHERE id=? AND user_id=? AND status='failed' AND attempt_count<max_attempts")
   .bind(now,id,user.id).run();
 } catch { return json({error:"TASK_RETRY_FAILED"},503); }
 if(!result?.meta || result.meta.changes!==1) {
  const row=await env.DB.prepare("SELECT status,attempt_count,max_attempts FROM agent_tasks WHERE id=? AND user_id=? LIMIT 1").bind(id,user.id).first().catch(()=>null);
  if(!row) return json({error:"TASK_NOT_FOUND"},404);
  if(row.status!=="failed") return json({error:"TASK_NOT_RETRYABLE",status:row.status},409);
  return json({error:"TASK_ATTEMPTS_EXHAUSTED",attemptCount:row.attempt_count,maxAttempts:row.max_attempts},409);
 }
 try { await env.DB.prepare("INSERT INTO agent_task_events (id,task_id,actor_type,actor_id,event_type,from_status,to_status,detail_json,created_at) VALUES (?,?,'user',?,'retried','failed','queued','{}',?)").bind(crypto.randomUUID(),id,user.id,now).run(); } catch { /* retry state is authoritative */ }
 return json({task:{id,status:"queued"},retried:true});
}
