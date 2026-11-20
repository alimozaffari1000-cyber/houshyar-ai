import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/agent-tasks/health.js";
function makeDb(){
 const calls=[];
 return {calls,prepare(sql){return {sql,args:[],bind(...args){this.args=args;return this;},async first(){
  calls.push({sql,args:this.args});
  if(sql.includes("FROM sessions JOIN users"))return {id:"owner-42",email:"owner@example.com"};
  if(sql.includes("FROM agent_tasks WHERE user_id=?"))return {total:8,queued:2,running:1,failed:1,completed:3,cancelled:1,expiredLeases:0,lastUpdated:123};
  return null;
 }};}};
}
test("task health is scoped to the authenticated user's tasks",async()=>{
 const DB=makeDb();
 const request=new Request("https://houshyar.example/api/agent-tasks/health",{headers:{Cookie:"houshyar_session=valid-session"}});
 const response=await onRequestGet({request,env:{DB}});
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.scope,"current_user_only");
 assert.deepEqual(body.health,{total:8,queued:2,running:1,failed:1,completed:3,cancelled:1,expiredLeases:0});
 const query=DB.calls.find(x=>x.sql.includes("FROM agent_tasks WHERE user_id=?"));
 assert.ok(query);
 assert.equal(query.args[1],"owner-42");
});
test("task health requires an authenticated session",async()=>{
 const response=await onRequestGet({request:new Request("https://houshyar.example/api/agent-tasks/health"),env:{DB:makeDb()}});
 assert.equal(response.status,401);
});
