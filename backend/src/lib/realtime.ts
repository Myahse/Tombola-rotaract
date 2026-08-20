import type { IncomingMessage, Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type { RealtimeMessage, RealtimeRole } from "../protocol.js";
import { adminClubIdFromCookieHeader } from "./auth.js";
import { isAllowedOrigin } from "./origins.js";

export type { RealtimeMessage, RealtimeRole };

type Client = {
  socket: WebSocket;
  role: RealtimeRole;
  clubId?: string;
};

const clients = new Set<Client>();

export function attachRealtime(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket: WebSocket, req: IncomingMessage) => {
    if (!isAllowedOrigin(req.headers.origin)) {
      socket.close(1008, "origin_not_allowed");
      return;
    }
    const client: Client = {
      socket,
      role: "public",
      clubId: adminClubIdFromCookieHeader(req.headers.cookie) ?? undefined,
    };
    clients.add(client);

    socket.on("message", (raw) => {
      try {
        const data = JSON.parse(String(raw)) as RealtimeMessage;
        if (data.type !== "hello") return;
        if (typeof data.clubId === "string" && data.clubId) {
          client.clubId = data.clubId;
        }
        if (data.role === "organizer") {
          const fromCookie = adminClubIdFromCookieHeader(req.headers.cookie);
          if (fromCookie) {
            client.role = "organizer";
            client.clubId = fromCookie;
          }
          return;
        }
        if (data.role === "public") {
          client.role = "public";
        }
      } catch {
        // ignore malformed frames
      }
    });

    socket.on("close", () => {
      clients.delete(client);
    });
  });
}

export function broadcast(message: RealtimeMessage, role?: RealtimeRole, clubId?: string) {
  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (role && client.role !== role) continue;
    if (clubId && client.clubId && client.clubId !== clubId) continue;
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(payload);
    }
  }
}
