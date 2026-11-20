import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/agent-tasks/[id]/run.js";
test("manual agent execution rejects requests without a same-origin header",async()=>{
 const response=await onRequestPost({request:new Request("https://houshyar.example/api/agent-tasks/00000000-0000-4000-8000-000000000000/run",{method:"POST"}),env:{},params:{id:"00000000-0000-4000-8000-000000000000"}});
 assert.equal(response.status,403);
 assert.equal((await response.json()).error,"ORIGIN_NOT_ALLOWED");
});
test("manual agent execution stays disabled without a server-side model secret",async()=>{
 const request=new Request("https://houshyar.example/api/agent-tasks/00000000-0000-4000-8000-000000000000/run",{method:"POST",headers:{Origin:"https://houshyar.example"}});
 const response=await onRequestPost({request,env:{DB:{}},params:{id:"00000000-0000-4000-8000-000000000000"}});
 assert.equal(response.status,503);
 assert.equal((await response.json()).error,"AGENT_MODEL_NOT_CONFIGURED");
});
