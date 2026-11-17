// Supported ISO 4217 currencies for the first marketplace rollout.
// Amounts are stored as integer minor units; IRR has exponent 0 (no fractional rial).
export const CURRENCY_DEFINITIONS = Object.freeze({
  IRR: Object.freeze({ code: "IRR", exponent: 0, label: "ریال ایران" }),
  USD: Object.freeze({ code: "USD", exponent: 2, label: "US dollar" }),
  EUR: Object.freeze({ code: "EUR", exponent: 2, label: "Euro" }),
  AED: Object.freeze({ code: "AED", exponent: 2, label: "UAE dirham" }),
  TRY: Object.freeze({ code: "TRY", exponent: 2, label: "Turkish lira" }),
  GBP: Object.freeze({ code: "GBP", exponent: 2, label: "Pound sterling" }),
  CAD: Object.freeze({ code: "CAD", exponent: 2, label: "Canadian dollar" }),
  AUD: Object.freeze({ code: "AUD", exponent: 2, label: "Australian dollar" }),
  JPY: Object.freeze({ code: "JPY", exponent: 0, label: "Japanese yen" }),
  CNY: Object.freeze({ code: "CNY", exponent: 2, label: "Chinese yuan" }),
  INR: Object.freeze({ code: "INR", exponent: 2, label: "Indian rupee" }),
  RUB: Object.freeze({ code: "RUB", exponent: 2, label: "Russian ruble" }),
  CHF: Object.freeze({ code: "CHF", exponent: 2, label: "Swiss franc" }),
  SAR: Object.freeze({ code: "SAR", exponent: 2, label: "Saudi riyal" }),
  AZN: Object.freeze({ code: "AZN", exponent: 2, label: "Azerbaijani manat" }),
  GEL: Object.freeze({ code: "GEL", exponent: 2, label: "Georgian lari" }),
  KWD: Object.freeze({ code: "KWD", exponent: 3, label: "Kuwaiti dinar" }),
  BHD: Object.freeze({ code: "BHD", exponent: 3, label: "Bahraini dinar" })
});

export function getCurrencyDefinition(code) {
  return typeof code === "string" ? CURRENCY_DEFINITIONS[code.trim().toUpperCase()] ?? null : null;
}

// Convert a decimal major-unit string to an exact integer minor-unit amount.
// Deliberately rejects floating-point numbers and excess fractional precision.
export function parseMajorAmount(value, currencyCode) {
  const currency = getCurrencyDefinition(currencyCode);
  if (!currency || typeof value !== "string") return null;
  const input = value.trim();
  const match = /^(0|[1-9]\\d*)(?:\\.(\\d+))?$/.exec(input);
  if (!match) return null;
  const fraction = match[2] ?? "";
  if (fraction.length > currency.exponent) return null;
  const scale = 10 ** currency.exponent;
  const whole = Number(match[1]);
  const fractional = currency.exponent ? Number((fraction + "0".repeat(currency.exponent)).slice(0, currency.exponent) || "0") : 0;
  const amount = whole * scale + fractional;
  return Number.isSafeInteger(amount) ? amount : null;
}

export function formatMinorAmount(amount, currencyCode) {
  const currency = getCurrencyDefinition(currencyCode);
  if (!currency || !Number.isSafeInteger(amount) || amount < 0) return null;
  const scale = 10 ** currency.exponent;
  const whole = Math.floor(amount / scale);
  if (currency.exponent === 0) return String(whole);
  return String(whole) + "." + String(amount % scale).padStart(currency.exponent, "0");
}
