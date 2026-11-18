import { getSessionUser, originAllowed } from "./_lib/auth.js";
import { checkAuthRateLimit } from "./_lib/auth-rate-limit.js";
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
  try {
    const rate = await checkAuthRateLimit({
      db: env.DB,
      action: "agent-task",
      email: auth.user.email || auth.user.id,
      clientIp: request.headers.get("cf-connecting-ip") || "unknown",
      limit: Number(env.AGENT_TASK_RATE_LIMIT) || 30
    });
    if (!rate.allowed) return json({error:"TASK_RATE_LIMITED",message:"تعداد ثبت وظایف بیش از حد مجاز است."},429);
  } catch {
    return json({error:"TASK_RATE_LIMIT_UNAVAILABLE"},503);
  }
  let body;
  try {
    if (!request.body) return json({error:"INVALID_JSON"},400);
    const reader=request.body.getReader(), chunks=[];
    let total=0;
    while (true) {
      const {done,value}=await reader.read();
      if (done) break;
      total+=value.byteLength;
      if (total>12000) { await reader.cancel(); return json({error:"BODY_TOO_LARGE"},413); }
      chunks.push(value);
    }
    const bytes=new Uint8Array(total); let offset=0;
    for (const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.byteLength; }
    body=JSON.parse(new TextDecoder().decode(bytes));
  } catch { return json({error:"INVALID_JSON"},400); }
  const validated=validateAgentTask(body);
  if (!validated.ok) return json({error:validated.error},400);
  const task=validated.task, now=Math.floor(Date.now()/1000), id=crypto.randomUUID();
  const idempotencyKey=request.headers.get("idempotency-key");
  if (idempotencyKey && !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) return json({error:"INVALID_IDEMPOTENCY_KEY"},400);
  const replay=async () => {
    if (!idempotencyKey) return null;
    const row=await env.DB.prepare("SELECT id,title,input_text,agent_id,status,priority,created_at,updated_at FROM agent_tasks WHERE user_id = ? AND idempotency_key = ? LIMIT 1").bind(auth.user.id,idempotencyKey).first();
    return row ? {task:{id:row.id,title:row.title,input:row.input_text,agentId:row.agent_id,status:row.status,priority:row.priority,createdAt:row.created_at,updatedAt:row.updated_at},execution:"queued_only",autonomousExecution:false,idempotentReplay:true} : null;
  };
  try {
    const previous=await replay();
    if (previous) return json(previous);
    const eventId=crypto.randomUUID();
    const insertTask=env.DB.prepare(
      "INSERT INTO agent_tasks (id,user_id,title,input_text,agent_id,status,priority,created_at,updated_at,idempotency_key) VALUES (?,?,?,?,?,'queued',?,?,?,?)"
    ).bind(id,auth.user.id,task.title,task.input,task.agentId,task.priority,now,now,idempotencyKey || null);
    const insertEvent=env.DB.prepare(
      "INSERT INTO agent_task_events (id,task_id,actor_type,actor_id,event_type,from_status,to_status,detail_json,created_at) VALUES (?,?, 'user', ?, 'created', NULL, 'queued', '{}', ?)"
    ).bind(eventId,id,auth.user.id,now);
    await env.DB.batch([insertTask,insertEvent]);
    return json({task:{id,...task,status:"queued",createdAt:now,updatedAt:now},execution:"queued_only",autonomousExecution:false},201);
  } catch {
    try { const previous=await replay(); if (previous) return json(previous); } catch { /* generic failure response */ }
    return json({error:"TASK_CREATE_FAILED"},503);
  }
}
