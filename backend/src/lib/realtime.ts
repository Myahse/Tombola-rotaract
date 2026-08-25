import { randomUUID } from "node:crypto";
import type { IncomingMessage, Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type { RealtimeMessage, RealtimeRole } from "../protocol.js";
import { hasAdminSessionFromCookieHeader, memberFromCookieHeader } from "./auth.js";
import { isAllowedOrigin } from "./origins.js";

export type { RealtimeMessage, RealtimeRole };

type Client = {
  id: string;
  socket: WebSocket;
  role: RealtimeRole;
  memberId?: string;
  name?: string;
};

const clients = new Set<Client>();

function sendJson(client: Client, message: RealtimeMessage) {
  if (client.socket.readyState === WebSocket.OPEN) {
    client.socket.send(JSON.stringify(message));
  }
}

function findClient(id: string) {
  for (const client of clients) {
    if (client.id === id) return client;
  }
  return undefined;
}

function monitors() {
  return [...clients].filter((client) => client.role === "monitor");
}

function candidates() {
  return [...clients].filter((client) => client.role === "candidate");
}

function canRelay(from: Client, to: Client) {
  return (
    (from.role === "candidate" && to.role === "monitor") ||
    (from.role === "monitor" && to.role === "candidate")
  );
}

function hangupFrom(client: Client, toId?: string) {
  const targets = toId
    ? [findClient(toId)].filter((item): item is Client => Boolean(item))
    : client.role === "candidate"
      ? monitors()
      : client.role === "monitor"
        ? candidates()
        : [];
  for (const target of targets) {
    if (target.id === client.id) continue;
    sendJson(target, { type: "qcm.call.hangup", from: client.id, to: target.id });
  }
}

export function attachRealtime(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket: WebSocket, req: IncomingMessage) => {
    if (!req.headers.origin || !isAllowedOrigin(req.headers.origin)) {
      socket.close(1008, "origin_not_allowed");
      return;
    }
    const client: Client = { id: randomUUID(), socket, role: "public" };
    clients.add(client);

    socket.on("message", (raw) => {
      void (async () => {
        try {
          const data = JSON.parse(String(raw)) as RealtimeMessage;
          if (data.type === "hello") {
            if (data.role === "organizer" || data.role === "monitor") {
              if (await hasAdminSessionFromCookieHeader(req.headers.cookie)) {
                client.role = data.role;
                client.memberId = undefined;
                client.name = undefined;
                if (client.role === "monitor") {
                  for (const candidate of candidates()) {
                    sendJson(candidate, { type: "qcm.call.ready", monitorId: client.id });
                  }
                }
              }
              return;
            }
            if (data.role === "candidate") {
              const member = await memberFromCookieHeader(req.headers.cookie);
              if (!member) {
                sendJson(client, { type: "qcm.call.denied" });
                return;
              }
              client.role = "candidate";
              client.memberId = member.id;
              client.name = member.name;
              sendJson(client, { type: "qcm.call.peers", monitorIds: monitors().map((item) => item.id) });
              return;
            }
            if (data.role === "public") {
              client.role = "public";
            }
            return;
          }

          if (data.type === "qcm.call.offer") {
            if (client.role !== "candidate" || !data.sdp) return;
            const target = findClient(data.to);
            if (!target || target.role !== "monitor") return;
            sendJson(target, {
              type: "qcm.call.offer",
              to: target.id,
              from: client.id,
              name: client.name ?? "",
              memberId: client.memberId,
              sdp: data.sdp,
            });
            return;
          }

          if (data.type === "qcm.call.answer") {
            if (client.role !== "monitor" || !data.sdp) return;
            const target = findClient(data.to);
            if (!target || target.role !== "candidate") return;
            sendJson(target, {
              type: "qcm.call.answer",
              to: target.id,
              from: client.id,
              sdp: data.sdp,
            });
            return;
          }

          if (data.type === "qcm.call.ice") {
            const target = findClient(data.to);
            if (!target || !canRelay(client, target) || !data.candidate) return;
            sendJson(target, {
              type: "qcm.call.ice",
              to: target.id,
              from: client.id,
              candidate: data.candidate,
            });
            return;
          }

          if (data.type === "qcm.call.ready") {
            if (client.role !== "monitor") return;
            for (const candidate of candidates()) {
              sendJson(candidate, { type: "qcm.call.ready", monitorId: client.id });
            }
            return;
          }

          if (data.type === "qcm.call.hangup") {
            if (client.role !== "candidate" && client.role !== "monitor") return;
            hangupFrom(client, data.to);
          }
        } catch {
          // ignore malformed frames
        }
      })();
    });

    socket.on("close", () => {
      hangupFrom(client);
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
