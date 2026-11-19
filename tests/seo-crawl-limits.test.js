import test from "node:test";
import assert from "node:assert/strict";
import {
  createCrawlPolicy,
  isSameOriginCrawlTarget,
  CRAWL_HARD_LIMITS,
  CRAWL_RUNTIME_REQUIREMENTS
} from "../src/seo-crawl-limits.js";

test("uses conservative defaults and freezes crawl policy", () => {
  const policy = createCrawlPolicy();
  assert.equal(policy.maxPages, 20);
  assert.equal(policy.maxResponseBytes, 500_000);
  assert.equal(policy.concurrency, 1);
  assert.equal(policy.sameOriginOnly, true);
  assert.equal(policy.requireRobotsTxt, true);
  assert.ok(Object.isFrozen(policy));
});

test("allows tighter limits and clamps requested limits to hard ceilings", () => {
  const policy = createCrawlPolicy({
    maxPages: 5,
    maxResponseBytes: 2_000_000,
    timeoutMs: 3_000,
    concurrency: 8,
    maxRedirects: 10
  });
  assert.equal(policy.maxPages, 5);
  assert.equal(policy.maxResponseBytes, CRAWL_HARD_LIMITS.maxResponseBytes);
  assert.equal(policy.timeoutMs, 3_000);
  assert.equal(policy.concurrency, CRAWL_HARD_LIMITS.concurrency);
  assert.equal(policy.maxRedirects, CRAWL_HARD_LIMITS.maxRedirects);
});

test("rejects malformed or non-positive crawl limits", () => {
  assert.throws(() => createCrawlPolicy(null), /CRAWL_OPTIONS_INVALID/);
  assert.throws(() => createCrawlPolicy({ maxPages: 0 }), /CRAWL_LIMIT_INVALID:maxPages/);
  assert.throws(() => createCrawlPolicy({ timeoutMs: 1.5 }), /CRAWL_LIMIT_INVALID:timeoutMs/);
});

test("cannot disable same-origin restriction or robots policy", () => {
  assert.throws(() => createCrawlPolicy({ sameOriginOnly: false }), /CRAWL_CROSS_ORIGIN_DISABLED/);
  assert.throws(() => createCrawlPolicy({ requireRobotsTxt: false }), /CRAWL_ROBOTS_REQUIRED/);
});

test("allows same-origin paths and blocks cross-origin targets", () => {
  assert.equal(
    isSameOriginCrawlTarget("https://example.com/", "https://example.com/products?id=1"),
    true
  );
  assert.equal(
    isSameOriginCrawlTarget("https://example.com/", "https://sub.example.com/page"),
    false
  );
  assert.equal(
    isSameOriginCrawlTarget("https://example.com/", "https://other.example/page"),
    false
  );
});

test("rejects unsafe or malformed URLs in same-origin comparison", () => {
  assert.equal(isSameOriginCrawlTarget("http://example.com", "http://example.com/a"), false);
  assert.equal(isSameOriginCrawlTarget("https://example.com", "https://127.0.0.1"), false);
  assert.equal(isSameOriginCrawlTarget("invalid", "https://example.com"), false);
});

test("documents runtime requirements for safe network crawling", () => {
  assert.ok(CRAWL_RUNTIME_REQUIREMENTS.some(item => item.includes("egress gateway")));
  assert.ok(CRAWL_RUNTIME_REQUIREMENTS.some(item => item.includes("robots.txt")));
  assert.ok(CRAWL_RUNTIME_REQUIREMENTS.some(item => item.includes("streaming")));
});
