import { readFileSync, existsSync } from "node:fs";

const failures = [];
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const wrangler = readFileSync("wrangler.toml", "utf8");

if (!pkg.scripts?.build) failures.push("Missing build script in package.json");
if (!pkg.scripts?.qa) failures.push("Missing QA test script in package.json");
if (!wrangler.includes('pages_build_output_dir = "./dist"')) {
  failures.push('wrangler.toml must declare pages_build_output_dir = "./dist"');
}
if (!existsSync("functions/api/chat.js")) failures.push("Missing Pages Function: functions/api/chat.js");
if (!existsSync("src/main.js")) failures.push("Missing frontend entry: src/main.js");

if (failures.length) {
  console.error("HOUSHYAR AGENT: CHECK FAILED");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}
console.log("HOUSHYAR AGENT: repository structure and Pages configuration checks passed.");
console.log("Note: Cloudflare dashboard deployment settings and API secrets require account-owner configuration.");
