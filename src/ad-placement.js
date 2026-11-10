const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

export async function initAdPlacement(container, slot = "home_below_welcome") {
  if (!container) return;
  try {
    const response = await fetch("/api/ads/placements?slot=" + encodeURIComponent(slot), { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    if (!Array.isArray(data.ads) || !data.ads.length) return;
    const section = document.createElement("section");
    section.className = "public-ad-placement";
    section.setAttribute("aria-label", "تبلیغات");
    section.innerHTML = '<p class="public-ad-label">تبلیغات</p>' + data.ads.map(ad => `
      <article class="public-ad-card">
        <div><small class="public-ad-kind">${escape(ad.label || "تبلیغ")}</small><strong>${escape(ad.title)}</strong><p>${escape(ad.description)}</p></div>
        <a href="${escape(ad.destinationUrl)}" target="_blank" rel="noopener noreferrer sponsored">مشاهده</a>
      </article>`).join("");
    container.append(section);
  } catch { /* Ad delivery is optional and must never break the chat UI. */ }
}
