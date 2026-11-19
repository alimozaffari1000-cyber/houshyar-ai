import test from "node:test";
import assert from "node:assert/strict";
import { createCrawlQueue } from "../src/seo-crawl-queue.js";

test("requires robots.txt before accepting any page", () => {
  const queue = createCrawlQueue("https://example.com/");
  assert.deepEqual(queue.add("https://example.com/about"), { accepted: false, reason: "ROBOTS_NOT_SET" });
  const result = queue.setRobotsTxt("User-agent: *\nDisallow:");
  assert.equal(result.ready, true);
  assert.equal(result.seed.accepted, true);
});

test("blocks disallowed paths and rejects cross-origin URLs", () => {
  const queue = createCrawlQueue("https://example.com/");
  queue.setRobotsTxt("User-agent: *\nDisallow: /private");
  assert.equal(queue.add("https://example.com/private/page").reason, "ROBOTS_DISALLOWED");
  assert.equal(queue.add("https://other.example/page").reason, "CROSS_ORIGIN");
  assert.equal(queue.add("https://example.com/public").accepted, true);
});

test("deduplicates normalized URLs and fragments", () => {
  const queue = createCrawlQueue("https://example.com/");
  queue.setRobotsTxt("User-agent: *\nDisallow:");
  assert.equal(queue.add("https://example.com/page#first").accepted, true);
  assert.equal(queue.add("https://example.com/page#second").reason, "DUPLICATE");
});

test("enforces page budget", () => {
  const queue = createCrawlQueue("https://example.com/", { maxPages: 2 });
  queue.setRobotsTxt("User-agent: *\nDisallow:");
  assert.equal(queue.add("https://example.com/one").accepted, true);
  assert.equal(queue.add("https://example.com/two").reason, "PAGE_BUDGET_EXHAUSTED");
  assert.equal(queue.snapshot().remainingPageBudget, 0);
});

test("tracks active and completed pages and enforces response byte ceiling", () => {
  const queue = createCrawlQueue("https://example.com/", { maxResponseBytes: 100 });
  queue.setRobotsTxt("User-agent: *\nDisallow:");
  const seed = queue.takeNext();
  assert.equal(seed, "https://example.com/");
  assert.equal(queue.complete(seed, 80).completed, true);
  assert.equal(queue.add("https://example.com/large").accepted, true);
  const large = queue.takeNext();
  assert.equal(queue.complete(large, 101).reason, "RESPONSE_TOO_LARGE");
  assert.equal(queue.snapshot().completed, 1);
  assert.equal(queue.snapshot().failed, 1);
  assert.equal(queue.snapshot().totalBytes, 80);
});

test("rejects invalid completion and tracks failed work", () => {
  const queue = createCrawlQueue("https://example.com/");
  queue.setRobotsTxt("User-agent: *\nDisallow:");
  assert.equal(queue.complete("https://example.com/", 10).reason, "URL_NOT_ACTIVE");
  const seed = queue.takeNext();
  assert.equal(queue.fail(seed), true);
  assert.equal(queue.fail(seed), false);
  assert.equal(queue.snapshot().failed, 1);
});

test("fails closed when robots text is invalid or oversized", () => {
  const queue = createCrawlQueue("https://example.com/");
  assert.equal(queue.setRobotsTxt("x".repeat(512_001)).ready, false);
  assert.equal(queue.add("https://example.com/").reason, "ROBOTS_NOT_SET");
});

test("rejects unsafe seeds and invalid queue options", () => {
  assert.throws(() => createCrawlQueue("http://example.com"), /CRAWL_SEED_REJECTED/);
  assert.throws(() => createCrawlQueue("https://example.com", null), /CRAWL_QUEUE_OPTIONS_INVALID/);
  assert.throws(() => createCrawlQueue("https://example.com", { userAgent: "" }), /CRAWL_USER_AGENT_INVALID/);
});
