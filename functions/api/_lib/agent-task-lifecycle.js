const TRANSITIONS = Object.freeze({
  queued: ["in_progress","cancelled"],
  in_progress: ["awaiting_approval","completed","failed","queued","cancelled"],
  awaiting_approval: ["in_progress","cancelled","failed"],
  completed: [],
  failed: ["queued"],
  cancelled: []
});

export function canTransitionTask(from, to) {
  return Boolean(TRANSITIONS[from]?.includes(to));
}

export function validateTaskTransition({from,to,actorType="system",humanApproved=false}={}) {
  if (!canTransitionTask(from,to)) return {allowed:false,reason:"INVALID_TRANSITION"};
  if (to==="awaiting_approval" && actorType!=="agent" && actorType!=="worker") return {allowed:false,reason:"INVALID_APPROVAL_REQUESTOR"};
  if (from==="awaiting_approval" && to==="in_progress" && humanApproved!==true) return {allowed:false,reason:"HUMAN_APPROVAL_REQUIRED"};
  if (from==="failed" && to==="queued" && actorType!=="user" && actorType!=="system") return {allowed:false,reason:"RETRY_NOT_AUTHORIZED"};
  return {allowed:true,reason:"TRANSITION_ALLOWED"};
}

export function makeTaskEvent({taskId,actorType="system",actorId=null,eventType,fromStatus=null,toStatus=null,detail={}}={}) {
  if (!taskId || !eventType) throw new TypeError("TASK_ID_AND_EVENT_TYPE_REQUIRED");
  return {
    id:crypto.randomUUID(), taskId, actorType, actorId, eventType,
    fromStatus, toStatus, detailJson:JSON.stringify(detail), createdAt:Math.floor(Date.now()/1000)
  };
}
