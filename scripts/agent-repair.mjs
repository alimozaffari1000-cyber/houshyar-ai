import { readFileSync, writeFileSync, existsSync } from "node:fs";

const changes = [];
const ignorePath = ".gitignore";
const ignore = existsSync(ignorePath) ? readFileSync(ignorePath, "utf8") : "";
const required = ["node_modules/", "dist/", ".env", ".env.*", "!.env.example", ".wrangler/"];
const lines = ignore.split(/\r?\n/).map(line => line.trim());
const missing = required.filter(rule => !lines.includes(rule));

if (missing.length) {
  const next = [ignore.trimEnd(), ...missing].filter(Boolean).join("\n") + "\n";
  writeFileSync(ignorePath, next);
  changes.push(".gitignore: added safe ignore rules for build output and local secrets");
}

const wranglerPath = "wrangler.toml";
if (existsSync(wranglerPath)) {
  const config = readFileSync(wranglerPath, "utf8");
  const isWorker = /^\s*main\s*=/m.test(config);
  const hasPagesOutput = /^\s*pages_build_output_dir\s*=/m.test(config);
  if (!hasPagesOutput && !isWorker) {
    writeFileSync(wranglerPath, config.trimEnd() + '\npages_build_output_dir = "./dist"\n');
    changes.push("wrangler.toml: restored Pages build output setting");
  }
}

if (changes.length) {
  console.log("HOUSHYAR AUTO-REPAIR APPLIED:");
  for (const change of changes) console.log("- " + change);
} else {
  console.log("HOUSHYAR AUTO-REPAIR: no safe repairs were needed.");
}
