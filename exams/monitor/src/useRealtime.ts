import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeMessage, RealtimeRole } from "./protocol";
import { websocketUrl } from "./config";

export function useRealtime(role: RealtimeRole, onMessage: (message: RealtimeMessage) => void) {
  const [connected, setConnected] = useState(false);
  const callback = useRef(onMessage);
  const socketRef = useRef<WebSocket | undefined>(undefined);
  callback.current = onMessage;

  const send = useCallback((message: RealtimeMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    let socket: WebSocket | undefined;
    let timer: number | undefined;
    let closed = false;

    const connect = () => {
      if (closed) return;
      socket = new WebSocket(websocketUrl());
      socketRef.current = socket;
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
        if (socketRef.current === socket) socketRef.current = undefined;
        if (!closed) timer = window.setTimeout(connect, 2500);
      };
    };

    connect();
    return () => {
      closed = true;
      if (timer) window.clearTimeout(timer);
      socketRef.current = undefined;
      socket?.close();
    };
  }, [role]);

  return { connected, send };
}
