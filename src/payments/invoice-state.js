const TRANSITIONS = Object.freeze({
  pending: new Set(["confirming", "paid", "underpaid", "overpaid", "expired", "failed", "manual_review"]),
  confirming: new Set(["paid", "underpaid", "overpaid", "expired", "failed", "manual_review"]),
  underpaid: new Set(["confirming", "paid", "refunded", "manual_review"]),
  overpaid: new Set(["paid", "refunded", "manual_review"]),
  manual_review: new Set(["paid", "refunded", "failed"]),
  paid: new Set(["refunded"]),
  expired: new Set(),
  failed: new Set(),
  refunded: new Set()
});

export function canTransitionInvoice(from, to) {
  return Boolean(TRANSITIONS[from]?.has(to));
}

export function transitionInvoice(invoice, nextStatus) {
  if (!invoice || typeof invoice !== "object" || !canTransitionInvoice(invoice.status, nextStatus)) {
    throw new Error("INVALID_INVOICE_STATE_TRANSITION");
  }
  return { ...invoice, status: nextStatus };
}

export function canGrantEntitlement(status, alreadyGranted) {
  return status === "paid" && alreadyGranted !== true;
}
