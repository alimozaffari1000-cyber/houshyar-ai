import { validateCrawlerTarget } from "./seo-crawl-policy.js";
import { createCrawlPolicy, isSameOriginCrawlTarget } from "./seo-crawl-limits.js";
import { isAllowedByRobots, parseRobotsTxt } from "./seo-robots.js";

/**
 * Create a bounded, in-memory URL queue for a future crawler.
 * This module never fetches URLs or robots.txt; callers must supply robots.txt.
 */
export function createCrawlQueue(seedUrl, options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("CRAWL_QUEUE_OPTIONS_INVALID");
  }
  const seed = validateCrawlerTarget(seedUrl);
  if (!seed.ok) throw new Error("CRAWL_SEED_REJECTED:" + seed.reason);

  const policy = createCrawlPolicy(options);
  const userAgent = String(options.userAgent || "HoushyarBot").trim();
  if (!userAgent || userAgent.length > 100) throw new Error("CRAWL_USER_AGENT_INVALID");

  const queue = [];
  const queued = new Set();
  const active = new Set();
  const completed = new Set();
  const failed = new Set();
  let robotsText = null;
  let robotsReady = false;
  let acceptedCount = 0;
  let rejectedCount = 0;
  let totalBytes = 0;

  function normalizeUrl(input) {
    const result = validateCrawlerTarget(input);
    return result.ok ? result.normalizedUrl : null;
  }

  function add(input) {
    if (!robotsReady) return { accepted: false, reason: "ROBOTS_NOT_SET" };
    const normalized = normalizeUrl(input);
    if (!normalized) {
      rejectedCount += 1;
      return { accepted: false, reason: "URL_REJECTED" };
    }
    if (!isSameOriginCrawlTarget(seed.normalizedUrl, normalized)) {
      rejectedCount += 1;
      return { accepted: false, reason: "CROSS_ORIGIN" };
    }
    if (queued.has(normalized) || active.has(normalized) || completed.has(normalized) || failed.has(normalized)) {
      return { accepted: false, reason: "DUPLICATE" };
    }
    if (acceptedCount >= policy.maxPages) {
      rejectedCount += 1;
      return { accepted: false, reason: "PAGE_BUDGET_EXHAUSTED" };
    }
    const permission = isAllowedByRobots(robotsText, normalized, userAgent);
    if (!permission.allowed) {
      rejectedCount += 1;
      return { accepted: false, reason: "ROBOTS_DISALLOWED", matchedRule: permission.matchedRule };
    }
    queue.push(normalized);
    queued.add(normalized);
    acceptedCount += 1;
    return { accepted: true, url: normalized };
  }

  function setRobotsTxt(input) {
    try {
      parseRobotsTxt(input);
    } catch (error) {
      robotsReady = false;
      robotsText = null;
      return { ready: false, reason: error.message || "ROBOTS_INVALID" };
    }
    robotsText = input;
    robotsReady = true;
    const seedResult = add(seed.normalizedUrl);
    return { ready: true, seed: seedResult };
  }

  function takeNext() {
    const url = queue.shift();
    if (!url) return null;
    queued.delete(url);
    active.add(url);
    return url;
  }

  function complete(input, responseBytes) {
    const normalized = normalizeUrl(input);
    if (!normalized || !active.has(normalized)) return { completed: false, reason: "URL_NOT_ACTIVE" };
    if (!Number.isSafeInteger(responseBytes) || responseBytes < 0) {
      return { completed: false, reason: "RESPONSE_SIZE_INVALID" };
    }
    if (responseBytes > policy.maxResponseBytes) {
      active.delete(normalized);
      failed.add(normalized);
      return { completed: false, reason: "RESPONSE_TOO_LARGE" };
    }
    active.delete(normalized);
    completed.add(normalized);
    totalBytes += responseBytes;
    return { completed: true, url: normalized };
  }

  function fail(input) {
    const normalized = normalizeUrl(input);
    if (!normalized || !active.has(normalized)) return false;
    active.delete(normalized);
    failed.add(normalized);
    return true;
  }

  function snapshot() {
    return Object.freeze({
      seedUrl: seed.normalizedUrl,
      robotsReady,
      queued: queue.length,
      active: active.size,
      completed: completed.size,
      failed: failed.size,
      accepted: acceptedCount,
      rejected: rejectedCount,
      totalBytes,
      maxPages: policy.maxPages,
      maxResponseBytes: policy.maxResponseBytes,
      concurrency: policy.concurrency,
      remainingPageBudget: Math.max(0, policy.maxPages - acceptedCount)
    });
  }

  return Object.freeze({ policy, setRobotsTxt, add, takeNext, complete, fail, snapshot });
}
