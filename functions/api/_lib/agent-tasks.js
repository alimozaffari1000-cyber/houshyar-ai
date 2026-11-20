import { routeAgentRequest } from "./agent-router.js";

const ALLOWED_AGENTS = new Set(["general","research","analyst","content","translator","planner","developer"]);

export function validateAgentTask(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok:false, error:"INVALID_BODY" };
  const text = typeof input.input === "string" ? input.input.trim() : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!text) return { ok:false, error:"INPUT_REQUIRED" };
  if (text.length > 6000) return { ok:false, error:"INPUT_TOO_LONG" };
  if (title && (title.length < 2 || title.length > 120)) return { ok:false, error:"INVALID_TITLE" };
  const routed = routeAgentRequest(text);
  const agentId = ALLOWED_AGENTS.has(input.agentId) ? input.agentId : routed.id;
  return { ok:true, task:{ title:title || (text.slice(0, 100).length >= 2 ? text.slice(0, 100) : "Task: " + text), input:text, agentId, priority:Number.isInteger(input.priority) ? Math.min(5,Math.max(1,input.priority)) : 3 } };
}

export function taskPublicView(row) {
  return {
    id:row.id, title:row.title, input:row.input_text, agentId:row.agent_id,
    status:row.status, priority:row.priority, result:row.result_text || null,
    errorCode:row.error_code || null, createdAt:row.created_at,
    updatedAt:row.updated_at, startedAt:row.started_at || null,
    completedAt:row.completed_at || null
  };
}
