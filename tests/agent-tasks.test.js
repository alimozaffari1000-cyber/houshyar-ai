import test from "node:test";
import assert from "node:assert/strict";
import { validateAgentTask, taskPublicView } from "../functions/api/_lib/agent-tasks.js";

test("task is routed to a specialist when no agent is specified",()=>{
 const r=validateAgentTask({input:"ترجمه این متن به انگلیسی"});
 assert.equal(r.ok,true); assert.equal(r.task.agentId,"translator");
});
test("explicit known agent can be selected",()=>{
 const r=validateAgentTask({input:"کار را بررسی کن",agentId:"research"});
 assert.equal(r.task.agentId,"research");
});
test("unknown agent falls back to deterministic routing",()=>{
 const r=validateAgentTask({input:"برنامه‌ریزی برای هفته",agentId:"root"});
 assert.equal(r.task.agentId,"planner");
});
test("empty and oversized input are rejected",()=>{
 assert.equal(validateAgentTask({input:" "}).error,"INPUT_REQUIRED");
 assert.equal(validateAgentTask({input:"x".repeat(6001)}).error,"INPUT_TOO_LONG");
});
test("priority is clamped and title is bounded",()=>{
 const r=validateAgentTask({input:"این یک وظیفه است",priority:99});
 assert.equal(r.task.priority,5);
 assert.equal(validateAgentTask({input:"x",title:"a"}).error,"INVALID_TITLE");
});
test("public view never exposes user id or internal database row",()=>{
 const v=taskPublicView({id:"t1",user_id:"secret",title:"Test",input_text:"do",agent_id:"planner",status:"queued",priority:3,created_at:1,updated_at:2});
 assert.equal(v.id,"t1"); assert.equal("user_id" in v,false); assert.equal("userId" in v,false);
});
