import { getSessionUser, originAllowed } from "../../_lib/auth.js";
import { checkAuthRateLimit } from "../../_lib/auth-rate-limit.js";
import { buildAgentPrompt, extractAgentOutput, AGENT_EXECUTION_LIMITS } from "../../_lib/agent-executor.js";

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});

export async function onRequestPost({request,env,params}) {
 if(!originAllowed(request)) return json({error:"ORIGIN_NOT_ALLOWED"},403);
 if(!env?.DB) return json({error:"DATABASE_UNAVAILABLE"},503);
 const apiKey=env.OPENAI_API_KEY;
 if(typeof apiKey!=="string" || !apiKey.trim()) return json({error:"AGENT_MODEL_NOT_CONFIGURED",message:"اجرای عامل هنوز پیکربندی نشده است."},503);
 let user;
 try { user=await getSessionUser(env.DB,request); } catch { return json({error:"AUTH_UNAVAILABLE"},503); }
 if(!user) return json({error:"AUTH_REQUIRED"},401);
 try {
  const rate=await checkAuthRateLimit({db:env.DB,action:"agent-run",email:user.email||user.id,clientIp:request.headers.get("cf-connecting-ip")||"unknown",limit:5});
  if(!rate.allowed) return json({error:"AGENT_RUN_RATE_LIMITED",retryAfter:rate.retryAfter},429);
 } catch { return json({error:"AGENT_RUN_RATE_LIMIT_UNAVAILABLE"},503); }
 const taskId=typeof params?.id==="string"?params.id:"";
 if(!/^[0-9a-f-]{36}$/i.test(taskId)) return json({error:"INVALID_TASK_ID"},400);
 const leaseOwner=crypto.randomUUID(), now=Math.floor(Date.now()/1000), leaseExpires=now+60;
 let task;
 try {
  task=await env.DB.prepare("SELECT id,title,input_text,agent_id,status,attempt_count,max_attempts FROM agent_tasks WHERE id=? AND user_id=? LIMIT 1").bind(taskId,user.id).first();
 } catch { return json({error:"TASK_LOOKUP_FAILED"},503); }
 if(!task) return json({error:"TASK_NOT_FOUND"},404);
 if(task.status!=="queued") return json({error:"TASK_NOT_RUNNABLE",status:task.status},409);
 if((task.attempt_count||0)>=(task.max_attempts||3)) return json({error:"TASK_ATTEMPTS_EXHAUSTED"},409);
 let prompt;
 try { prompt=buildAgentPrompt({agentId:task.agent_id,input:task.input_text}); } catch { return json({error:"TASK_AGENT_INVALID"},400); }
 try {
  const claim=await env.DB.prepare("UPDATE agent_tasks SET status='in_progress',attempt_count=attempt_count+1,lease_owner=?,lease_expires_at=?,started_at=?,updated_at=? WHERE id=? AND user_id=? AND status='queued' AND attempt_count<max_attempts")
   .bind(leaseOwner,leaseExpires,now,now,taskId,user.id).run();
  if(!claim?.meta || claim.meta.changes!==1) return json({error:"TASK_ALREADY_CLAIMED"},409);
  await env.DB.prepare("INSERT INTO agent_task_events (id,task_id,actor_type,actor_id,event_type,from_status,to_status,detail_json,created_at) VALUES (?,?,'user',?,'claimed','queued','in_progress','{}',?)")
   .bind(crypto.randomUUID(),taskId,user.id,now).run();
 } catch {
  try { await env.DB.prepare("UPDATE agent_tasks SET status='queued',attempt_count=CASE WHEN attempt_count>0 THEN attempt_count-1 ELSE 0 END,lease_owner=NULL,lease_expires_at=NULL,started_at=NULL,updated_at=? WHERE id=? AND user_id=? AND lease_owner=? AND status='in_progress'").bind(Math.floor(Date.now()/1000),taskId,user.id,leaseOwner).run(); } catch { /* lease expires as a final recovery boundary */ }
  return json({error:"TASK_CLAIM_FAILED"},503);
 }
 const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),AGENT_EXECUTION_LIMITS.timeoutMs);
 try {
  const response=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+apiKey},signal:controller.signal,body:JSON.stringify({model:env.HOUSHYAR_AGENT_MODEL||"gpt-4.1-mini",temperature:0.2,max_tokens:AGENT_EXECUTION_LIMITS.maxOutputTokens,messages:[{role:"system",content:prompt.system},{role:"user",content:prompt.user}]})});
  if(!response.ok) throw new Error("MODEL_HTTP_"+response.status);
  const output=extractAgentOutput(await response.json()), finished=Math.floor(Date.now()/1000);
  const update=await env.DB.prepare("UPDATE agent_tasks SET status='completed',result_text=?,error_code=NULL,completed_at=?,updated_at=?,lease_owner=NULL,lease_expires_at=NULL WHERE id=? AND user_id=? AND lease_owner=? AND status='in_progress'")
   .bind(output,finished,finished,taskId,user.id,leaseOwner).run();
  if(!update?.meta || update.meta.changes!==1) return json({error:"TASK_LEASE_LOST"},409);
  try {
   await env.DB.prepare("INSERT INTO agent_task_events (id,task_id,actor_type,actor_id,event_type,from_status,to_status,detail_json,created_at) VALUES (?,?,'agent',?,'completed','in_progress','completed','{}',?)")
    .bind(crypto.randomUUID(),taskId,task.agent_id,finished).run();
  } catch { /* task result is committed; audit event failure must not mark it failed */ }
  return json({task:{id:taskId,status:"completed",result:output},execution:"user_triggered_model",autonomousExecution:false});
 } catch(error) {
  const failed=Math.floor(Date.now()/1000), code=error?.name==="AbortError"?"MODEL_TIMEOUT":"MODEL_EXECUTION_FAILED";
  try {
   await env.DB.batch([
    env.DB.prepare("UPDATE agent_tasks SET status='failed',error_code=?,updated_at=?,completed_at=?,lease_owner=NULL,lease_expires_at=NULL WHERE id=? AND user_id=? AND lease_owner=? AND status='in_progress'").bind(code,failed,failed,taskId,user.id,leaseOwner),
    env.DB.prepare("INSERT INTO agent_task_events (id,task_id,actor_type,actor_id,event_type,from_status,to_status,detail_json,created_at) VALUES (?,?,'system',?,'failed','in_progress','failed',?,?)").bind(crypto.randomUUID(),taskId,"model",JSON.stringify({code}),failed)
   ]);
  } catch { /* retain generic failure response; never expose provider details */ }
  return json({error:code,message:"اجرای عامل انجام نشد؛ وظیفه در وضعیت ناموفق ثبت شد."},502);
 } finally { clearTimeout(timer); }
}
