import { spawnSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(args, cwd) {
  const result = spawnSync("npm", args, { cwd, stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function appFromVercel() {
  if (
    process.env.TOMBOLA_APP === "organizer" ||
    process.env.TOMBOLA_APP === "frontend" ||
    process.env.TOMBOLA_APP === "campaign"
  ) {
    return process.env.TOMBOLA_APP;
  }
  const hint = `${process.env.VERCEL_PROJECT_PRODUCTION_URL ?? ""} ${process.env.VERCEL_URL ?? ""}`.toLowerCase();
  if (hint.includes("organisateur")) return "organizer";
  if (hint.includes("campagne")) return "campaign";
  return "frontend";
}

function buildApp(app) {
  const cwd = resolve(root, app);
  run(["install"], cwd);
  run(["run", "build"], cwd);
  return resolve(cwd, "dist");
}

if (process.env.VERCEL) {
  const from = buildApp(appFromVercel());
  const to = resolve(root, "dist");
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
} else {
  buildApp("frontend");
  buildApp("organizer");
  buildApp("campaign");
}
