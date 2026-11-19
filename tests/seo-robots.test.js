import test from "node:test";
import assert from "node:assert/strict";
import {
  parseRobotsTxt,
  isAllowedByRobots,
  ROBOTS_POLICY_LIMITS
} from "../src/seo-robots.js";

test("parses groups, comments, crawl delay and sitemap hints", () => {
  const parsed = parseRobotsTxt([
    "# global comment",
    "User-agent: *",
    "Disallow: /private # no crawl",
    "Crawl-delay: 2",
    "Sitemap: https://example.com/sitemap.xml"
  ].join("\n"));
  assert.equal(parsed.groups.length, 1);
  assert.deepEqual(parsed.groups[0].userAgents, ["*"]);
  assert.deepEqual(parsed.groups[0].rules, [{ type: "disallow", path: "/private" }]);
  assert.deepEqual(parsed.groups[0].crawlDelays, [2]);
  assert.deepEqual(parsed.sitemaps, ["https://example.com/sitemap.xml"]);
});

test("allows by default and blocks matching disallow rules", () => {
  const robots = "User-agent: *\nDisallow: /private";
  assert.equal(isAllowedByRobots(robots, "https://example.com/public").allowed, true);
  const result = isAllowedByRobots(robots, "https://example.com/private/item");
  assert.equal(result.allowed, false);
  assert.deepEqual(result.matchedRule, { type: "disallow", path: "/private" });
});

test("uses the longest matching rule and Allow wins equal-length ties", () => {
  const robots = [
    "User-agent: *",
    "Disallow: /folder/",
    "Allow: /folder/open",
    "Disallow: /equal",
    "Allow: /equal"
  ].join("\n");
  assert.equal(isAllowedByRobots(robots, "https://example.com/folder/open/file").allowed, true);
  assert.equal(isAllowedByRobots(robots, "https://example.com/folder/closed").allowed, false);
  assert.equal(isAllowedByRobots(robots, "https://example.com/equal").allowed, true);
});

test("supports wildcard and end-anchor matching", () => {
  const robots = "User-agent: *\nDisallow: /*.pdf$";
  assert.equal(isAllowedByRobots(robots, "https://example.com/files/report.pdf").allowed, false);
  assert.equal(isAllowedByRobots(robots, "https://example.com/files/report.pdf?download=1").allowed, true);
});

test("merges consecutive user-agent declarations into one group", () => {
  const robots = "User-agent: BotA\nUser-agent: BotB\nDisallow: /blocked";
  const parsed = parseRobotsTxt(robots);
  assert.deepEqual(parsed.groups[0].userAgents, ["bota", "botb"]);
  assert.equal(isAllowedByRobots(robots, "https://example.com/blocked", "BotB").allowed, false);
});

test("prefers the most specific matching agent over wildcard", () => {
  const robots = "User-agent: *\nDisallow: /\nUser-agent: HoushyarBot\nAllow: /";
  assert.equal(isAllowedByRobots(robots, "https://example.com/page", "HoushyarBot/1.0").allowed, true);
  assert.equal(isAllowedByRobots(robots, "https://example.com/page", "OtherBot/1.0").allowed, false);
});

test("combines separate groups with the same matching user-agent", () => {
  const robots = "User-agent: HoushyarBot\nDisallow: /one\n\nUser-agent: HoushyarBot\nDisallow: /two";
  assert.equal(isAllowedByRobots(robots, "https://example.com/one", "HoushyarBot").allowed, false);
  assert.equal(isAllowedByRobots(robots, "https://example.com/two", "HoushyarBot").allowed, false);
});

test("ignores empty Disallow and malformed or unknown directives", () => {
  const robots = "User-agent: *\nDisallow:\nUnknown: /blocked\nAllow: /ok";
  assert.equal(isAllowedByRobots(robots, "https://example.com/anything").allowed, true);
});

test("fails closed for invalid target, unreadable policy and oversized input", () => {
  assert.equal(isAllowedByRobots("", "file:///etc/passwd").allowed, false);
  assert.equal(isAllowedByRobots("x".repeat(ROBOTS_POLICY_LIMITS.maxBytes + 1), "https://example.com").reason, "robots_unreadable");
  assert.equal(isAllowedByRobots("User-agent: *", "https://user:pass@example.com").reason, "invalid_target");
  assert.throws(() => parseRobotsTxt("x".repeat(ROBOTS_POLICY_LIMITS.maxBytes + 1)), /ROBOTS_TEXT_TOO_LARGE/);
});

test("exports conservative non-network policy limits", () => {
  assert.equal(ROBOTS_POLICY_LIMITS.networkAccess, false);
  assert.equal(ROBOTS_POLICY_LIMITS.followsSitemaps, false);
});
