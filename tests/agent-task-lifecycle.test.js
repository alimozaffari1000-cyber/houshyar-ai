import test from "node:test";
import assert from "node:assert/strict";
import { canTransitionTask, validateTaskTransition } from "../functions/api/_lib/agent-task-lifecycle.js";

test("only valid task lifecycle transitions are allowed",()=>{
 assert.equal(canTransitionTask("queued","in_progress"),true);
 assert.equal(canTransitionTask("queued","completed"),false);
 assert.equal(canTransitionTask("completed","queued"),false);
 assert.equal(canTransitionTask("failed","queued"),true);
});
test("approval pause requires an agent or worker actor",()=>{
 assert.deepEqual(validateTaskTransition({from:"in_progress",to:"awaiting_approval",actorType:"user"}),{allowed:false,reason:"INVALID_APPROVAL_REQUESTOR"});
});
test("resuming approval-gated work requires explicit human approval",()=>{
 assert.equal(validateTaskTransition({from:"awaiting_approval",to:"in_progress"}).reason,"HUMAN_APPROVAL_REQUIRED");
 assert.equal(validateTaskTransition({from:"awaiting_approval",to:"in_progress",humanApproved:true}).allowed,true);
});
test("retry from failed state is restricted to user or system",()=>{
 assert.equal(validateTaskTransition({from:"failed",to:"queued",actorType:"agent"}).allowed,false);
 assert.equal(validateTaskTransition({from:"failed",to:"queued",actorType:"user"}).allowed,true);
});
test("terminal cancellation cannot be reopened",()=>{
 assert.equal(validateTaskTransition({from:"cancelled",to:"queued"}).allowed,false);
});
