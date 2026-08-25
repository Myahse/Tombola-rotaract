import { spawnSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const appDirs = {
  frontend: "frontend",
  organizer: "organizer",
  campaign: "campaign",
  monitor: "exams/monitor",
  exam: "exams/exam",
};

function run(args, cwd) {
  const result = spawnSync("npm", args, { cwd, stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function appFromVercel() {
  if (process.env.TOMBOLA_APP && process.env.TOMBOLA_APP in appDirs) {
    return process.env.TOMBOLA_APP;
  }
  const hint = `${process.env.VERCEL_PROJECT_PRODUCTION_URL ?? ""} ${process.env.VERCEL_URL ?? ""}`.toLowerCase();
  if (hint.includes("organisateur")) return "organizer";
  if (hint.includes("campagne")) return "campaign";
  if (hint.includes("surveillance") || hint.includes("monitor")) return "monitor";
  if (hint.includes("examen") || hint.includes("exam") || hint.includes("qcm")) return "exam";
  return "frontend";
}

function buildApp(app) {
  const cwd = resolve(root, appDirs[app] ?? app);
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
  for (const app of Object.keys(appDirs)) {
    buildApp(app);
  }
}
