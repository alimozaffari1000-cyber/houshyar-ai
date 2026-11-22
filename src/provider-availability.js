const UNAVAILABLE_SUFFIX = " — راه‌اندازی نشده";

export function applyProviderAvailability(select, providers) {
  if (!select || !Array.isArray(providers)) return;
  const availability = new Map(
    providers
      .filter(item => item && typeof item.id === "string")
      .map(item => [item.id, item.available === true])
  );

  for (const option of select.options || []) {
    if (option.value === "auto") {
      option.disabled = false;
      continue;
    }
    if (!availability.has(option.value)) continue;
    const available = availability.get(option.value);
    option.disabled = !available;
    const baseLabel = option.dataset?.baseLabel || option.textContent.replace(UNAVAILABLE_SUFFIX, "");
    if (option.dataset) option.dataset.baseLabel = baseLabel;
    option.textContent = available ? baseLabel : baseLabel + UNAVAILABLE_SUFFIX;
  }
}

export async function loadProviderAvailability(select, fetcher = fetch) {
  try {
    const response = await fetcher("/api/chat", {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store"
    });
    if (!response.ok) return false;
    const data = await response.json();
    applyProviderAvailability(select, data.providers);
    return true;
  } catch {
    // Keep provider choices usable if the status endpoint is temporarily unreachable.
    return false;
  }
}
