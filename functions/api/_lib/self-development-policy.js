const AUTONOMOUS_ACTIONS = new Set([
  "inspect_repository",
  "analyze_code",
  "research_public_sources",
  "create_development_plan",
  "create_work_branch",
  "write_branch_changes",
  "run_tests",
  "run_security_scan",
  "build_preview",
  "open_pull_request",
  "write_progress_report"
]);

const APPROVAL_ACTIONS = new Set([
  "merge_to_main",
  "deploy_production",
  "run_production_migration",
  "change_security_policy",
  "change_access_permissions",
  "read_or_export_private_user_data",
  "delete_user_data",
  "send_external_message",
  "publish_public_content",
  "create_or_move_payment",
  "accept_contract",
  "change_billing_or_secrets"
]);

const BLOCKED_ACTIONS = new Set([
  "execute_unrestricted_shell",
  "disable_security_checks",
  "hide_audit_events",
  "exfiltrate_secrets",
  "modify_audit_history"
]);

export function evaluateSelfDevelopmentAction(action, { humanApproved = false, environment = "development", branch = "agent/work" } = {}) {
  if (typeof action !== "string" || !action.trim()) {
    return { allowed: false, requiresApproval: false, reason: "INVALID_ACTION" };
  }
  if (BLOCKED_ACTIONS.has(action)) {
    return { allowed: false, requiresApproval: false, reason: "PROHIBITED_ACTION" };
  }
  if (APPROVAL_ACTIONS.has(action)) {
    if (humanApproved !== true) {
      return { allowed: false, requiresApproval: true, reason: "HUMAN_APPROVAL_REQUIRED" };
    }
    return { allowed: true, requiresApproval: true, reason: "EXPLICIT_APPROVAL_PRESENT" };
  }
  if (!AUTONOMOUS_ACTIONS.has(action)) {
    return { allowed: false, requiresApproval: true, reason: "UNKNOWN_ACTION_DENY_BY_DEFAULT" };
  }
  if (environment === "production") {
    return { allowed: false, requiresApproval: true, reason: "PRODUCTION_ENVIRONMENT_BLOCKED" };
  }
  if (action === "write_branch_changes" && (!/^agent\/[a-z0-9._-]{1,80}$/.test(branch) || branch === "agent/main")) {
    return { allowed: false, requiresApproval: false, reason: "UNSAFE_BRANCH" };
  }
  return { allowed: true, requiresApproval: false, reason: "ALLOWLISTED_DEVELOPMENT_ACTION" };
}

export function getSelfDevelopmentCapabilities() {
  return {
    autonomous: [...AUTONOMOUS_ACTIONS],
    approvalRequired: [...APPROVAL_ACTIONS],
    prohibited: [...BLOCKED_ACTIONS],
    productionWrites: false,
    directMainWrites: false,
    unrestrictedShell: false
  };
}
