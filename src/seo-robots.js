const DIRECTIVE_NAMES = new Set(["allow", "disallow", "crawl-delay"]);
const MAX_ROBOTS_BYTES = 512_000;

function normalizeAgent(value) {
  return String(value ?? "").trim().toLowerCase();
}

function ruleMatches(pattern, pathAndQuery) {
  if (!pattern) return false;
  const anchored = pattern.endsWith("$");
  const source = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = source
    .split("*")
    .map(part => part.replace(/[|\\{}()[\]^$+?.]/g, "\\$&"))
    .join(".*");
  const expression = new RegExp("^" + escaped + (anchored ? "$" : ".*"));
  return expression.test(pathAndQuery);
}

/**
 * Parse robots.txt without making a network request.
 * Returns groups and sitemap hints; it does not fetch sitemap URLs.
 */
export function parseRobotsTxt(input) {
  if (typeof input !== "string") throw new TypeError("ROBOTS_TEXT_INVALID");
  if (new TextEncoder().encode(input).byteLength > MAX_ROBOTS_BYTES) {
    throw new RangeError("ROBOTS_TEXT_TOO_LARGE");
  }

  const groups = [];
  const sitemaps = [];
  let current = null;
  let hasDirective = false;

  for (const rawLine of input.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0].trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 1) continue;

    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (name === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }

    if (name === "user-agent") {
      if (hasDirective || !current) {
        current = { userAgents: [], rules: [], crawlDelays: [] };
        groups.push(current);
        hasDirective = false;
      }
      if (value) current.userAgents.push(normalizeAgent(value));
      continue;
    }

    if (!DIRECTIVE_NAMES.has(name) || !current) continue;
    hasDirective = true;
    if (name === "allow" || name === "disallow") {
      // An empty Disallow means no restriction; empty Allow is also ignored.
      if (value) current.rules.push({ type: name, path: value });
    } else if (value && Number.isFinite(Number(value)) && Number(value) >= 0) {
      current.crawlDelays.push(Number(value));
    }
  }

  return {
    groups: groups.map(group => ({
      userAgents: [...group.userAgents],
      rules: [...group.rules],
      crawlDelays: [...group.crawlDelays]
    })),
    sitemaps: [...new Set(sitemaps)]
  };
}

/**
 * Evaluate one URL against the most-specific matching robots user-agent group.
 * Equal-specificity groups are combined. Longest matching rule wins; Allow
 * wins a tie. This is a local policy check only, not a network crawler.
 */
export function isAllowedByRobots(robotsText, targetUrl, userAgent = "*") {
  let parsed;
  try {
    parsed = parseRobotsTxt(robotsText);
  } catch {
    return { allowed: false, reason: "robots_unreadable", matchedRule: null, sitemaps: [] };
  }

  let target;
  try {
    target = new URL(targetUrl);
    if (!["http:", "https:"].includes(target.protocol) || target.username || target.password) {
      throw new Error("invalid");
    }
  } catch {
    return { allowed: false, reason: "invalid_target", matchedRule: null, sitemaps: parsed.sitemaps };
  }

  const requestedAgent = normalizeAgent(userAgent).split(/[\s/]/, 1)[0];
  if (!requestedAgent) {
    return { allowed: false, reason: "invalid_user_agent", matchedRule: null, sitemaps: parsed.sitemaps };
  }

  const matching = [];
  let bestSpecificity = -1;
  for (const group of parsed.groups) {
    const specificity = group.userAgents.reduce((best, token) => {
      if (token === "*") return Math.max(best, 0);
      return requestedAgent.includes(token) ? Math.max(best, token.length) : best;
    }, -1);
    if (specificity > bestSpecificity) {
      bestSpecificity = specificity;
      matching.length = 0;
      matching.push(group);
    } else if (specificity >= 0 && specificity === bestSpecificity) {
      matching.push(group);
    }
  }

  const rules = matching.flatMap(group => group.rules);
  const pathAndQuery = target.pathname + target.search;
  const matches = rules
    .filter(rule => ruleMatches(rule.path, pathAndQuery))
    .map(rule => ({ ...rule, specificity: rule.path.replace(/[*$]/g, "").length }))
    .sort((a, b) => b.specificity - a.specificity || (a.type === "allow" ? -1 : 1));

  const winner = matches[0] ?? null;
  return {
    allowed: winner ? winner.type === "allow" : true,
    reason: winner ? "matched_rule" : "no_matching_rule",
    matchedRule: winner ? { type: winner.type, path: winner.path } : null,
    crawlDelay: matching.flatMap(group => group.crawlDelays)[0] ?? null,
    sitemaps: parsed.sitemaps
  };
}

export const ROBOTS_POLICY_LIMITS = Object.freeze({
  maxBytes: MAX_ROBOTS_BYTES,
  networkAccess: false,
  followsSitemaps: false
});
