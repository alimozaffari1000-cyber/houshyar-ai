const SENSITIVE_ACTION = /پرداخت|خرید|فروش|انتقال وجه|برداشت|واریز|حذف|پاک کردن|انتشار|استقرار|deploy|publish|delete|transfer funds|withdraw|payment|purchase|sell|trade|send money/i;

export function requiresHumanApproval(goal) {
  return SENSITIVE_ACTION.test(typeof goal === "string" ? goal : "");
}
export function taskTitle(goal) {
  const normalized = String(goal || "").replace(/\s+/g, " ").trim();
  return normalized.length > 160 ? normalized.slice(0, 157) + "..." : normalized;
}
export function safeTaskRecord(row) {
  if (!row || typeof row !== "object") return null;
  let workflow = null;
  try { workflow = JSON.parse(row.workflow_json); } catch { workflow = null; }
  return {
    id: row.id, title: row.title, goal: row.goal, agentId: row.agent_id,
    workflow, status: row.status, approvalRequired: row.approval_required === 1,
    createdAt: row.created_at, updatedAt: row.updated_at, expiresAt: row.expires_at
  };
}
