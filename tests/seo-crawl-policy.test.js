import test from "node:test";
import assert from "node:assert/strict";
import { validateCrawlerTarget, CRAWLER_PREFLIGHT_LIMITATIONS } from "../src/seo-crawl-policy.js";

test("accepts normalized HTTPS DNS URLs without fragments", () => {
  const result = validateCrawlerTarget("https://Example.com:443/docs?q=seo#section");
  assert.equal(result.ok, true);
  assert.equal(result.normalizedUrl, "https://example.com/docs?q=seo");
});

test("rejects non-HTTPS schemes and non-standard ports", () => {
  assert.equal(validateCrawlerTarget("http://example.com").reason, "HTTPS_REQUIRED");
  assert.equal(validateCrawlerTarget("ftp://example.com").reason, "HTTPS_REQUIRED");
  assert.equal(validateCrawlerTarget("https://example.com:8443").reason, "PORT_FORBIDDEN");
});

test("rejects URL credentials and malformed input", () => {
  assert.equal(validateCrawlerTarget("https://user:pass@example.com").reason, "URL_CREDENTIALS_FORBIDDEN");
  assert.equal(validateCrawlerTarget("not a URL").reason, "URL_INVALID");
  assert.equal(validateCrawlerTarget(" ").reason, "URL_REQUIRED");
});

test("rejects IP literals including private and loopback destinations", () => {
  for (const url of [
    "https://127.0.0.1",
    "https://192.168.1.10",
    "https://10.0.0.2",
    "https://[::1]",
    "https://[::ffff:127.0.0.1]"
  ]) assert.equal(validateCrawlerTarget(url).reason, "IP_LITERAL_FORBIDDEN", url);
});

test("rejects localhost and reserved internal hostnames", () => {
  for (const url of [
    "https://localhost",
    "https://admin.localhost",
    "https://printer.local",
    "https://service.internal",
    "https://node.test"
  ]) assert.equal(validateCrawlerTarget(url).reason, "PRIVATE_OR_RESERVED_HOSTNAME", url);
});

test("rejects single-label and malformed hostnames", () => {
  assert.equal(validateCrawlerTarget("https://intranet").reason, "HOSTNAME_INVALID_OR_NON_PUBLIC");
  assert.equal(validateCrawlerTarget("https://-bad.example.com").reason, "HOSTNAME_INVALID_OR_NON_PUBLIC");
});

test("documents that DNS and redirect checks remain mandatory", () => {
  assert.ok(CRAWLER_PREFLIGHT_LIMITATIONS.some(item => item.includes("DNS rebinding")));
  assert.ok(CRAWLER_PREFLIGHT_LIMITATIONS.some(item => item.includes("egress gateway")));
});
