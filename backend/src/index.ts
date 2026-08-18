import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attachRealtime } from "./lib/realtime.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { publicRouter } from "./routes/public.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const isVercel = Boolean(process.env.VERCEL);
const origins = (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function isAllowedOrigin(origin: string | undefined) {
  if (!origin) return true;
  if (origins.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname.endsWith(".vercel.app") || hostname.endsWith(".onrender.com")) return true;
    if (hostname === "rotaractiugb.com" || hostname.endsWith(".rotaractiugb.com")) return true;
  } catch {
    return false;
  }
  return false;
}

app.set("trust proxy", 1);
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
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "tombola-api" });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", authRouter);
app.use("/api", publicRouter);
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
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: "invalid_json" });
    return;
  }
  next(err);
});

const server = createServer(app);
attachRealtime(server);

if (!isVercel) {
  server.listen(port, "0.0.0.0", () => {
    console.log(`Tombola API + WebSocket on port ${port}`);
  });
}

export default server;
