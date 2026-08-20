import type { IncomingMessage, Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type { RealtimeMessage, RealtimeRole } from "../protocol.js";
import { hasAdminSessionFromCookieHeader } from "./auth.js";
import { isAllowedOrigin } from "./origins.js";

export type { RealtimeMessage, RealtimeRole };

type Client = {
  socket: WebSocket;
  role: RealtimeRole;
};

const clients = new Set<Client>();

export function attachRealtime(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket: WebSocket, req: IncomingMessage) => {
    if (!req.headers.origin || !isAllowedOrigin(req.headers.origin)) {
      socket.close(1008, "origin_not_allowed");
      return;
    }
    const client: Client = { socket, role: "public" };
    clients.add(client);

    socket.on("message", (raw) => {
      void (async () => {
        try {
          const data = JSON.parse(String(raw)) as RealtimeMessage;
          if (data.type !== "hello") return;
          if (data.role === "organizer") {
            if (await hasAdminSessionFromCookieHeader(req.headers.cookie)) {
              client.role = "organizer";
            }
            return;
          }
          if (data.role === "public") {
            client.role = "public";
          }
        } catch {
          // ignore malformed frames
        }
      })();
    });

    socket.on("close", () => {
      clients.delete(client);
    });
  });
}

export function broadcast(message: RealtimeMessage, role?: RealtimeRole) {
  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (role && client.role !== role) continue;
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(payload);
    }
  }
}
