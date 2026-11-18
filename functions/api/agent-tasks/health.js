import { getSessionUser } from "../_lib/auth.js";
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
export async function onRequestGet({request,env}) {
 if(!env?.DB) return json({error:"DATABASE_UNAVAILABLE"},503);
 let user;
 try { user=await getSessionUser(env.DB,request); } catch { return json({error:"AUTH_UNAVAILABLE"},503); }
 if(!user) return json({error:"AUTH_REQUIRED"},401);
 const now=Math.floor(Date.now()/1000);
 try {
  const row=await env.DB.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN status='queued' THEN 1 ELSE 0 END) AS queued,SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) AS running,SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled,SUM(CASE WHEN status='in_progress' AND lease_expires_at IS NOT NULL AND lease_expires_at < ? THEN 1 ELSE 0 END) AS expiredLeases,MAX(updated_at) AS lastUpdated FROM agent_tasks WHERE user_id=?").bind(now,user.id).first();
  const counts={total:Number(row?.total||0),queued:Number(row?.queued||0),running:Number(row?.running||0),failed:Number(row?.failed||0),completed:Number(row?.completed||0),cancelled:Number(row?.cancelled||0),expiredLeases:Number(row?.expiredLeases||0)};
  return json({health:counts,checkedAt:now,lastUpdated:row?.lastUpdated||null,scope:"current_user_only",autonomousExecution:false});
 } catch { return json({error:"TASK_HEALTH_UNAVAILABLE"},503); }
}
