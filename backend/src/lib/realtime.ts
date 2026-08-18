import type { IncomingMessage, Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type { RealtimeMessage, RealtimeRole } from "../protocol.js";

export type { RealtimeMessage, RealtimeRole };

type Client = {
  socket: WebSocket;
  role: RealtimeRole;
};

const clients = new Set<Client>();

export function attachRealtime(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket: WebSocket, _req: IncomingMessage) => {
    const client: Client = { socket, role: "public" };
    clients.add(client);

    socket.on("message", (raw) => {
      try {
        const data = JSON.parse(String(raw)) as RealtimeMessage;
        if (data.type === "hello" && (data.role === "public" || data.role === "organizer")) {
          client.role = data.role;
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

export function broadcast(message: RealtimeMessage, role?: RealtimeRole) {
  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (role && client.role !== role) continue;
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(payload);
    }
  }
}
