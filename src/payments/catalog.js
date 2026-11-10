// Public, non-secret payment-method catalogue. No payment processor is enabled here.
export const PAYMENT_METHODS = Object.freeze([
  { id: "ltc", asset: "LTC", network: "Litecoin", label: "Litecoin (LTC)", phase: "pilot_candidate", custody: "non_custodial", issuerFreeze: false, enabled: false, note: "Native coin; community-maintained processor integration must be validated." },
  { id: "xrp", asset: "XRP", network: "XRP Ledger", label: "XRP (XRP Ledger)", phase: "planned", custody: "non_custodial", issuerFreeze: false, enabled: false, note: "Native XRP only; destination tag may be required by recipient wallets." },
  { id: "trx", asset: "TRX", network: "TRON", label: "TRON (TRX)", phase: "planned", custody: "non_custodial", issuerFreeze: false, enabled: false, note: "Native TRX only; distinct from USDT on TRON." },
  { id: "usdt-trc20", asset: "USDT", network: "TRON (TRC-20)", label: "Tether USD (TRC-20)", phase: "optional_centralized", custody: "token_issuer_controlled", issuerFreeze: true, enabled: false, note: "Issuer can blacklist/freeze addresses; never describe as freeze-proof." },
  { id: "btc-lightning", asset: "BTC", network: "Lightning Network", label: "Bitcoin (Lightning)", phase: "planned", custody: "non_custodial", issuerFreeze: false, enabled: false, note: "Requires a tested Lightning node/provider and inbound liquidity." },
  { id: "xmr", asset: "XMR", network: "Monero", label: "Monero (XMR)", phase: "restricted_review", custody: "non_custodial", issuerFreeze: false, enabled: false, note: "Privacy and jurisdictional restrictions require legal and operational review." }
]);

export function listPaymentMethods() {
  return PAYMENT_METHODS.map(({ id, asset, network, label, phase, custody, issuerFreeze, enabled, note }) =>
    ({ id, asset, network, label, phase, custody, issuerFreeze, enabled, note }));
}

export function getPaymentMethod(id) {
  return PAYMENT_METHODS.find(method => method.id === id) ?? null;
}
