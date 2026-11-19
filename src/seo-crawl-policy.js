/**
 * Preflight policy for a future SEO crawler.
 *
 * IMPORTANT: This is not an SSRF boundary. A hostname can resolve to a private
 * address or change its DNS answer (DNS rebinding). Callers MUST NOT fetch a
 * user-supplied URL until an egress layer validates every resolved destination
 * IP and every redirect hop. This module intentionally performs no networking.
 */
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".test", ".invalid"];
const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal"]);

function isIpLiteral(hostname) {
  const host = hostname.replace(/^\[|\]$/g, "");
  // Reject all IPv4/IPv6 literals. The egress layer must inspect resolved IPs.
  return host.includes(":") || /^\d+(?:\.\d+){3}$/.test(host) ||
    /^0x[\da-f]+$/i.test(host) || /^0\d+$/.test(host);
}

function isValidDnsName(hostname) {
  if (!hostname || hostname.length > 253 || hostname.endsWith(".")) return false;
  const labels = hostname.split(".");
  if (labels.length < 2) return false;
  return labels.every(label =>
    label.length > 0 &&
    label.length <= 63 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
  );
}

/**
 * Validate URL syntax and obvious unsafe destinations before a crawler queue.
 * This does NOT prove that DNS resolves to a public IP.
 *
 * @returns {{ok: boolean, normalizedUrl?: string, reason?: string}}
 */
export function validateCrawlerTarget(input) {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, reason: "URL_REQUIRED" };
  }

  let url;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "URL_INVALID" };
  }

  if (url.protocol !== "https:") return { ok: false, reason: "HTTPS_REQUIRED" };
  if (url.username || url.password) return { ok: false, reason: "URL_CREDENTIALS_FORBIDDEN" };
  if (url.port && url.port !== "443") return { ok: false, reason: "PORT_FORBIDDEN" };

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.has(hostname) || BLOCKED_SUFFIXES.some(suffix => hostname.endsWith(suffix))) {
    return { ok: false, reason: "PRIVATE_OR_RESERVED_HOSTNAME" };
  }
  if (isIpLiteral(url.hostname)) return { ok: false, reason: "IP_LITERAL_FORBIDDEN" };
  if (!isValidDnsName(hostname)) return { ok: false, reason: "HOSTNAME_INVALID_OR_NON_PUBLIC" };

  url.hash = "";
  return { ok: true, normalizedUrl: url.toString() };
}

export const CRAWLER_PREFLIGHT_LIMITATIONS = Object.freeze([
  "This is syntax and hostname preflight only; it does not resolve DNS.",
  "A public-looking hostname can resolve to private, loopback, link-local, reserved, or metadata IP ranges.",
  "DNS rebinding and redirects can change the destination after validation.",
  "Do not enable network fetching until an egress gateway validates resolved IPs and every redirect hop."
]);
