const UINT32_RANGE = 0x100000000;

export function normalizeEligibleEntries(entries) {
  if (!Array.isArray(entries)) throw new TypeError("INVALID_DRAW_ENTRIES");
  const seen = new Set();
  const eligible = [];
  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string" || !entry.id.trim()) continue;
    if (entry.entry_status && entry.entry_status !== "eligible") continue;
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    eligible.push({ id: entry.id, ticketCode: String(entry.ticket_code || "") });
  }
  eligible.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return eligible;
}

// randomUint32 must be backed by a cryptographically secure RNG at the server boundary.
export function selectDrawWinner(entries, randomUint32) {
  if (typeof randomUint32 !== "function") throw new TypeError("SECURE_RANDOM_SOURCE_REQUIRED");
  const eligible = normalizeEligibleEntries(entries);
  if (eligible.length === 0) throw new Error("NO_ELIGIBLE_ENTRIES");
  const range = Math.floor(UINT32_RANGE / eligible.length) * eligible.length;
  let value;
  for (let attempt = 0; attempt < 128; attempt += 1) {
    value = randomUint32();
    if (!Number.isInteger(value) || value < 0 || value >= UINT32_RANGE) {
      throw new TypeError("INVALID_RANDOM_UINT32");
    }
    if (value < range) return eligible[value % eligible.length];
  }
  throw new Error("RANDOM_SOURCE_REJECTION_LIMIT");
}

export function summarizeDraw(entries) {
  const eligible = normalizeEligibleEntries(entries);
  const total = Array.isArray(entries) ? entries.length : 0;
  return {
    totalEntries: total,
    eligibleEntries: eligible.length,
    uniqueEligibleParticipants: eligible.length
  };
}
