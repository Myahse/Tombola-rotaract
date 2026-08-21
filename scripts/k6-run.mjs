import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const script = process.argv[2];
if (!script) {
  console.error("Usage: node scripts/k6-run.mjs <k6-script.js> [k6 args...]");
  process.exit(1);
}

function resolveK6() {
  if (process.platform === "win32") {
    const installed = "C:\\Program Files\\k6\\k6.exe";
    if (existsSync(installed)) return installed;
  }
  return "k6";
}

const bin = resolveK6();
const args = ["run", path.join("k6", script), ...process.argv.slice(3)];
const result = spawnSync(bin, args, { stdio: "inherit", shell: false });

if (result.error?.code === "ENOENT") {
  console.error("");
  console.error("k6 not found. Install the MSI or reopen your terminal after install.");
  if (process.platform === "win32") {
    console.error("Expected: C:\\Program Files\\k6\\k6.exe");
  }
  process.exit(1);
}

process.exit(result.status ?? 1);
