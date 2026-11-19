import { validateCrawlerTarget } from "./seo-crawl-policy.js";

export const CRAWL_HARD_LIMITS = Object.freeze({
  maxPages: 50,
  maxResponseBytes: 1_000_000,
  timeoutMs: 10_000,
  concurrency: 2,
  maxRedirects: 3
});

export const CRAWL_DEFAULTS = Object.freeze({
  maxPages: 20,
  maxResponseBytes: 500_000,
  timeoutMs: 8_000,
  concurrency: 1,
  maxRedirects: 2,
  sameOriginOnly: true,
  requireRobotsTxt: true
});

const LIMIT_KEYS = Object.keys(CRAWL_HARD_LIMITS);

/**
 * Build a conservative crawl budget. Callers may tighten limits but cannot
 * raise them above hard ceilings. This function performs no network requests.
 */
export function createCrawlPolicy(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("CRAWL_OPTIONS_INVALID");
  }

  const policy = { ...CRAWL_DEFAULTS };
  for (const key of LIMIT_KEYS) {
    if (options[key] === undefined) continue;
    const value = options[key];
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RangeError("CRAWL_LIMIT_INVALID:" + key);
    }
    policy[key] = Math.min(value, CRAWL_HARD_LIMITS[key]);
  }

  if (options.sameOriginOnly !== undefined) {
    if (options.sameOriginOnly !== true) {
      throw new Error("CRAWL_CROSS_ORIGIN_DISABLED");
    }
    policy.sameOriginOnly = true;
  }
  if (options.requireRobotsTxt !== undefined) {
    if (options.requireRobotsTxt !== true) {
      throw new Error("CRAWL_ROBOTS_REQUIRED");
    }
    policy.requireRobotsTxt = true;
  }

  return Object.freeze(policy);
}

/**
 * Permit only validated HTTPS URLs on the exact same origin as the seed.
 * DNS/IP safety must still be enforced by a trusted egress gateway.
 */
export function isSameOriginCrawlTarget(seedUrl, candidateUrl) {
  const seed = validateCrawlerTarget(seedUrl);
  const candidate = validateCrawlerTarget(candidateUrl);
  if (!seed.ok || !candidate.ok) return false;

  try {
    return new URL(seed.normalizedUrl).origin === new URL(candidate.normalizedUrl).origin;
  } catch {
    return false;
  }
}

export const CRAWL_RUNTIME_REQUIREMENTS = Object.freeze([
  "Fetches must be routed through an egress gateway that checks resolved IP addresses.",
  "Validate every redirect destination again and enforce the configured redirect ceiling.",
  "Fetch and obey robots.txt before crawling pages; fail closed if robots policy cannot be obtained.",
  "Enforce timeout and response byte limits while streaming, not only from Content-Length.",
  "Keep concurrency and total page count within the immutable hard ceilings.",
  "Do not enable arbitrary public URL crawling until DNS rebinding and private-address access are blocked at egress."
]);
