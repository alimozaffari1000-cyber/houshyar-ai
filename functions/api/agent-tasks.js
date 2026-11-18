import { getSessionUser, originAllowed } from "./_lib/auth.js";
import { validateAgentTask, taskPublicView } from "./_lib/agent-tasks.js";

const json = (body,status=200) => new Response(JSON.stringify(body), {
  status, headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
});

async function authenticatedUser(request,env) {
  if (!env?.DB) return { error:json({error:"DATABASE_UNAVAILABLE"},503) };
  try {
    const user=await getSessionUser(env.DB,request);
    if (!user) return { error:json({error:"AUTH_REQUIRED",message:"برای مدیریت وظایف وارد حساب کاربری شوید."},401) };
    return { user };
  } catch { return { error:json({error:"AUTH_UNAVAILABLE"},503) }; }
}

export async function onRequestGet({request,env}) {
  const auth=await authenticatedUser(request,env);
  if (auth.error) return auth.error;
  const url=new URL(request.url);
  const raw=Number(url.searchParams.get("limit") || 20);
  const limit=Number.isFinite(raw) ? Math.min(50,Math.max(1,Math.floor(raw))) : 20;
  try {
    const result=await env.DB.prepare(
      "SELECT id,title,input_text,agent_id,status,priority,result_text,error_code,created_at,updated_at,started_at,completed_at FROM agent_tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
    ).bind(auth.user.id,limit).all();
    return json({tasks:(result.results || []).map(taskPublicView), execution:"queued_only", autonomousExecution:false});
  } catch { return json({error:"TASKS_UNAVAILABLE"},503); }
}

export async function onRequestPost({request,env}) {
  if (!originAllowed(request)) return json({error:"ORIGIN_NOT_ALLOWED"},403);
  if ((request.headers.get("content-type") || "").split(";",1)[0].trim().toLowerCase() !== "application/json") return json({error:"UNSUPPORTED_MEDIA_TYPE"},415);
  const length=Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length>12000) return json({error:"BODY_TOO_LARGE"},413);
  const auth=await authenticatedUser(request,env);
  if (auth.error) return auth.error;
  let body;
  try { body=await request.json(); } catch { return json({error:"INVALID_JSON"},400); }
  const validated=validateAgentTask(body);
  if (!validated.ok) return json({error:validated.error},400);
  const task=validated.task, now=Math.floor(Date.now()/1000), id=crypto.randomUUID();
  try {
    await env.DB.prepare(
      "INSERT INTO agent_tasks (id,user_id,title,input_text,agent_id,status,priority,created_at,updated_at) VALUES (?,?,?,?,?,'queued',?,?,?)"
    ).bind(id,auth.user.id,task.title,task.input,task.agentId,task.priority,now,now).run();
    return json({task:{id,...task,status:"queued",createdAt:now,updatedAt:now},execution:"queued_only",autonomousExecution:false},201);
  } catch { return json({error:"TASK_CREATE_FAILED"},503); }
}
