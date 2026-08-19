import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isAllowedOrigin } from "./lib/origins.js";
import { attachRealtime } from "./lib/realtime.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { campaignRouter } from "./routes/campaigns.js";
import { publicRouter } from "./routes/public.js";
import { pushRouter } from "./routes/push.js";
import { ensureSchema } from "./db/index.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const isVercel = Boolean(process.env.VERCEL);
const isProd = process.env.NODE_ENV === "production";

function assertRuntimeSecrets() {
  const secret = process.env.SESSION_SECRET?.trim() ?? "";
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  if (isProd && secret.length < 16) {
    throw new Error("SESSION_SECRET must be at least 16 characters");
  }
  if (isProd && !process.env.ADMIN_PASSWORD?.trim()) {
    throw new Error("ADMIN_PASSWORD must be set in production");
  }
  if (isProd && !(process.env.ADMIN_EMAIL ?? "").split(",").map((value) => value.trim()).filter(Boolean).length) {
    console.warn("ADMIN_EMAIL is empty: organizer login is disabled in production until it is set");
  }
}

assertRuntimeSecrets();

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (isProd) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
});
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, origin || true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use((req, res, next) => {
  const large =
    req.method === "POST" && /\/api\/admin\/campaigns\/[^/]+\/attachments\/?$/.test(req.path);
  express.json({ limit: large ? "6mb" : "400kb" })(req, res, next);
});
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "tombola-api" });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", authRouter);
app.use("/api", pushRouter);
app.use("/api", publicRouter);
app.use("/api/admin/campaigns", campaignRouter);
app.use("/api/admin", adminRouter);

if (process.env.NODE_ENV === "production" && process.env.SERVE_FRONTEND === "1") {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(here, "../../frontend/dist");
  app.use(express.static(dist));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof Error && err.message === "Not allowed by CORS") {
    res.status(403).json({ error: "origin_not_allowed" });
    return;
  }
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: "invalid_json" });
    return;
  }
  next(err);
});

const server = createServer(app);
attachRealtime(server);

if (!isVercel) {
  void ensureSchema()
    .then(() => {
      server.listen(port, "0.0.0.0", () => {
        console.log(`Tombola API + WebSocket on port ${port}`);
      });
    })
    .catch((error) => {
      console.error("Database schema check failed", error);
      process.exit(1);
    });
}

export default server;
