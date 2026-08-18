export type RealtimeRole = "public" | "organizer";

export type RealtimeMessage =
  | { type: "hello"; role: RealtimeRole }
  | { type: "public.snapshot"; event: unknown }
  | { type: "organizer.changed"; reason: "order" | "event" | "draw" }
  | { type: "draw.done" };
