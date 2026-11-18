import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost as cancelTask } from "../functions/api/agent-tasks/[id]/cancel.js";
import { onRequestPost as retryTask } from "../functions/api/agent-tasks/[id]/retry.js";
const taskId="00000000-0000-4000-8000-000000000000";
test("cancel and retry reject cross-origin requests",async()=>{
 for(const handler of [cancelTask,retryTask]){
  const response=await handler({request:new Request("https://houshyar.example/api/agent-tasks/"+taskId+"/cancel",{method:"POST"}),env:{},params:{id:taskId}});
  assert.equal(response.status,403);
 }
});
test("cancel and retry reject malformed task identifiers",async()=>{
 for(const handler of [cancelTask,retryTask]){
  const response=await handler({request:new Request("https://houshyar.example/api/agent-tasks/not-a-uuid/cancel",{method:"POST",headers:{Origin:"https://houshyar.example"}}),env:{DB:{}},params:{id:"not-a-uuid"}});
  assert.equal(response.status,401); // no authenticated session is accepted before task lookup
 }
});
