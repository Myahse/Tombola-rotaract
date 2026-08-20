export type RealtimeRole = "public" | "organizer";

export type ScratchedTicket = {
  ticketNumber: number;
  buyerName: string;
  scratchedAt: string;
  prizeRank: number | null;
  prizeNameFr: string | null;
  prizeNameEn: string | null;
};

export type RealtimeMessage =
  | { type: "hello"; role: RealtimeRole; clubId?: string }
  | { type: "public.snapshot"; event: unknown }
  | { type: "organizer.changed"; reason: "order" | "event" | "draw" | "scratch" }
  | { type: "ticket.scratched"; ticket: ScratchedTicket }
  | { type: "draw.done" };
