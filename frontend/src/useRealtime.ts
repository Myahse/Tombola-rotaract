import type { RealtimeMessage, RealtimeRole } from "../../shared/protocol";
import { useEffect, useRef, useState } from "react";

export function useRealtime(role: RealtimeRole, onMessage: (message: RealtimeMessage) => void) {
  const [connected, setConnected] = useState(false);
  const callback = useRef(onMessage);
  callback.current = onMessage;

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    let socket: WebSocket | undefined;
    let timer: number | undefined;
    let closed = false;

    const connect = () => {
      if (closed) return;
      socket = new WebSocket(`${protocol}://${window.location.host}/ws`);
      socket.onopen = () => {
        setConnected(true);
        socket?.send(JSON.stringify({ type: "hello", role }));
      };
      socket.onmessage = (event) => {
        try {
          callback.current(JSON.parse(String(event.data)) as RealtimeMessage);
        } catch {
          // ignore
        }
      };
      socket.onclose = () => {
        setConnected(false);
        if (!closed) timer = window.setTimeout(connect, 1500);
      };
    };

    connect();
    return () => {
      closed = true;
      if (timer) window.clearTimeout(timer);
      socket?.close();
    };
  }, [role]);

  return connected;
}
