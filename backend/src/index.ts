import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attachRealtime } from "./lib/realtime";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { publicRouter } from "./routes/public";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const origins = (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: origins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", authRouter);
app.use("/api", publicRouter);
app.use("/api/admin", adminRouter);

if (process.env.NODE_ENV === "production") {
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

server.listen(port, () => {
  console.log(`Tombola API + WebSocket on http://localhost:${port}`);
});
