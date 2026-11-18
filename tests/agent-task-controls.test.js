import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost as cancelTask } from "../functions/api/agent-tasks/[id]/cancel.js";
import { onRequestPost as retryTask } from "../functions/api/agent-tasks/[id]/retry.js";
const id="00000000-0000-4000-8000-000000000000";
function makeDb({taskStatus="queued",changes=1,attemptCount=0,maxAttempts=3}={}) {
 const statements=[];
 return {
  statements,
  prepare(sql){return {sql,args:[],bind(...args){this.args=args;return this;},async first(){
   statements.push({sql,args:this.args,kind:"first"});
   if(sql.includes("FROM sessions JOIN users"))return {id:"user-1",email:"user@example.com"};
   if(sql.includes("INSERT INTO api_rate_limits"))return {request_count:1};
   if(sql.includes("SELECT status,attempt_count,max_attempts"))return {status:taskStatus,attempt_count:attemptCount,max_attempts:maxAttempts};
   if(sql.includes("SELECT status FROM agent_tasks"))return {status:taskStatus};
   return null;
  },async run(){statements.push({sql,args:this.args,kind:"run"});return {meta:{changes:sql.startsWith("UPDATE agent_tasks")?changes:1}};}};}
 };
}
function request(action){return new Request("https://houshyar.example/api/agent-tasks/"+id+"/"+action,{method:"POST",headers:{Origin:"https://houshyar.example",Cookie:"houshyar_session=valid-session"}});}
test("task cancellation is owner-scoped and clears active leases",async()=>{
 const DB=makeDb({taskStatus:"in_progress"});
 const response=await cancelTask({request:request("cancel"),env:{DB},params:{id}});
 assert.equal(response.status,200);
 assert.equal((await response.json()).task.status,"cancelled");
 const update=DB.statements.find(x=>x.sql.startsWith("UPDATE agent_tasks"));
 assert.match(update.sql,/user_id=\?/);
 assert.match(update.sql,/lease_owner=NULL/);
 assert.deepEqual(update.args.slice(1,3),[id,"user-1"]);
});
test("retry only requeues failed tasks below the attempt cap",async()=>{
 const DB=makeDb({taskStatus:"failed",attemptCount:1,maxAttempts:3});
 const response=await retryTask({request:request("retry"),env:{DB},params:{id}});
 assert.equal(response.status,200);
 assert.equal((await response.json()).task.status,"queued");
 const update=DB.statements.find(x=>x.sql.startsWith("UPDATE agent_tasks"));
 assert.match(update.sql,/status='failed'/);
 assert.match(update.sql,/attempt_count<max_attempts/);
 assert.equal(update.args[1],id);
 assert.equal(update.args[2],"user-1");
});
test("retry refuses exhausted tasks without changing state",async()=>{
 const DB=makeDb({taskStatus:"failed",changes:0,attemptCount:3,maxAttempts:3});
 const response=await retryTask({request:request("retry"),env:{DB},params:{id}});
 assert.equal(response.status,409);
 assert.equal((await response.json()).error,"TASK_ATTEMPTS_EXHAUSTED");
 assert.equal(DB.statements.filter(x=>x.sql.startsWith("UPDATE agent_tasks")).length,1);
});
test("cancellation rejects cross-origin requests",async()=>{
 const response=await cancelTask({request:new Request("https://houshyar.example/api/agent-tasks/"+id+"/cancel",{method:"POST"}),env:{},params:{id}});
 assert.equal(response.status,403);
});
