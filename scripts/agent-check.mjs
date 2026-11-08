import { readFileSync, existsSync } from "node:fs";

const failures = [];
const warnings = [];
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const wrangler = readFileSync("wrangler.toml", "utf8");
const frontend = readFileSync("src/main.js", "utf8");
const api = readFileSync("functions/api/chat.js", "utf8");
const gitignore = existsSync(".gitignore") ? readFileSync(".gitignore", "utf8") : "";

if (!pkg.scripts?.build) failures.push("Missing build script in package.json");
if (!pkg.scripts?.qa) failures.push("Missing QA test script in package.json");
if (!wrangler.includes('pages_build_output_dir = "./dist"')) failures.push('wrangler.toml must declare pages_build_output_dir = "./dist"');
if (!existsSync("functions/api/chat.js")) failures.push("Missing Pages Function: functions/api/chat.js");
if (!existsSync("src/main.js")) failures.push("Missing frontend entry: src/main.js");
if (!api.includes("env.GROQ_API_KEY")) failures.push("API must read GROQ_API_KEY from server environment");
if (!frontend.includes("'/api/chat'") && !frontend.includes('"/api/chat"')) warnings.push("Frontend default API endpoint /api/chat was not detected");
if (/GROQ_API_KEY|Bearer\s+[A-Za-z0-9_-]{20,}/.test(frontend)) failures.push("Possible server API credential exposure in frontend source");
if (!gitignore.split(/\r?\n/).some(line => line.trim() === ".env" || line.trim() === ".env.*")) failures.push("Add .env and .env.* to .gitignore to reduce secret-leak risk");

if (failures.length) {
  console.error("HOUSHYAR AGENT: CHECK FAILED");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}
console.log("HOUSHYAR AGENT: structure, deployment, and basic secret-safety checks passed.");
for (const warning of warnings) console.warn("WARNING: " + warning);
console.log("Cloudflare account settings and runtime secrets still require owner authorization.");
